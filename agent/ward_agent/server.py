"""FastAPI server exposing the decision feed and an incident trigger.

Endpoints (per the shared interface contract / task spec):
  GET  /events             -> SSE stream of reasoning events
  GET  /events/recent      -> last N events (JSON)
  GET  /healthz            -> liveness + mode summary
  POST /incident/simulate  -> inject a fault via the sim and let the REAL loop
                              react (a genuine end-to-end incident, not a
                              scripted animation)

The server boots the WardAgent (real sim if reachable, else FakeSim),
starts the background poll loop, and shares the in-memory EventBus so the
SSE stream reflects exactly what the loop is reasoning about.
"""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from .config import get_config, usdc
from .events import get_event_bus
from .main import WardAgent, get_agent, set_agent
from .sim_client import DeviceStatus
from .triage import triage

logger = logging.getLogger("ward.server")


class SimulateRequest(BaseModel):
    propertyId: str | None = None
    deviceId: str | None = None
    mode: str = "hard"  # "soft" heals on restart (-> resolves at L1); "hard" -> L3
    autoComplete: bool = True  # in DRY/demo, auto-advance the worker to work-done


class DescribeRequest(BaseModel):
    text: str  # free-text resident report; triaged to a device at runtime
    autoComplete: bool = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = get_config()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    agent = await WardAgent.from_environment()
    set_agent(agent)
    app.state.agent = agent
    # Run the poll loop in the background for the life of the server.
    loop_task = asyncio.create_task(agent.run_forever())
    app.state.loop_task = loop_task
    logger.info(
        "WARD server up: chain=%s, llm=%s, sim=%s",
        "DRY" if agent.chain.dry else "LIVE",
        "on" if cfg.llm_enabled else "rules",
        getattr(agent.sim, "base_url", "unknown"),
    )
    try:
        yield
    finally:
        agent.stop()
        loop_task.cancel()
        try:
            await loop_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="WARD Agent", version="0.1.0", lifespan=lifespan)

# Permissive CORS so the frontend / demo can connect from anywhere.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    cfg = get_config()
    agent = get_agent()
    chain = agent.chain if agent else None
    return {
        "status": "ok",
        "mode": {
            "chain": "DRY" if (chain is None or chain.dry) else "LIVE",
            "evaluator": "ready" if (chain and chain.evaluator_ready) else "missing-key",
            "llm": "on" if cfg.llm_enabled else "rules-fallback",
            "supabase": "on" if cfg.supabase_enabled else "off",
            "sim": getattr(agent.sim, "base_url", "unknown") if agent else "unknown",
        },
        "agent_address": chain.agent_address if chain else None,
        "usdc_balance": usdc(chain.usdc_balance_units()) if chain else None,
        "policy": {
            "job_amount_usdc": usdc(cfg.job_amount_units),
            "owner_approval_threshold_usdc": usdc(cfg.owner_approval_threshold_units),
            "per_job_cap_usdc": usdc(cfg.per_job_cap_units),
            "daily_cap_usdc": usdc(cfg.daily_cap_units),
        },
    }


@app.get("/events/recent")
async def events_recent(limit: int = Query(default=100, ge=1, le=500)) -> JSONResponse:
    bus = get_event_bus()
    return JSONResponse(bus.recent(limit))


@app.get("/events")
async def events_stream() -> StreamingResponse:
    bus = get_event_bus()

    async def gen():
        # Replay recent buffer first so a fresh subscriber has context, then
        # stream live events.
        for item in bus.recent(50):
            yield f"data: {json.dumps(item)}\n\n"
        async for event in bus.subscribe():
            yield f"data: {json.dumps(event.to_dict())}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/incident/simulate")
async def incident_simulate(req: SimulateRequest) -> dict[str, Any]:
    """Inject a fault via the sim and let the real loop react.

    Resolves the target device (default: prop-2 / Greenwich Cottage),
    fails it via the sim, and — in the demo / DRY path — schedules
    the human-side worker steps (repair + accept + mark-done) so the full
    fault->...->settle cycle completes for the frontend without manual nudging.
    The agent's poll loop picks up the fault on its own; this endpoint does not
    script the agent's reasoning.
    """
    agent = get_agent()
    if agent is None:
        return {"error": "agent not initialized"}

    device_id = req.deviceId
    if device_id is None:
        # Resolve from propertyId (default prop-2), else first device.
        fleet = await agent.sim.fleet()
        target_prop = req.propertyId or "prop-2"
        match = next((d for d in fleet if d.propertyId == target_prop), None)
        if match is None and fleet:
            match = fleet[0]
        if match is None:
            return {"error": "no devices in fleet"}
        device_id = match.deviceId

    mode = req.mode if req.mode in ("soft", "hard") else "hard"
    after = await _inject_and_drive(agent, device_id, mode, req.autoComplete)

    return {
        "injected": after.to_dict(),
        "mode": mode,
        "autoComplete": req.autoComplete,
        "note": "The agent poll loop will react autonomously; watch /events.",
    }


@app.post("/incident/describe")
async def incident_describe(req: DescribeRequest) -> dict[str, Any]:
    """Triage a free-text resident report and inject the matching real fault.

    The judge types a problem in their own words; Claude maps it (at runtime) to
    one of the four instrumented devices and a severity, the agent emits its
    interpretation to the reasoning feed, and the mapped fault is injected into
    the sim. From there the normal poll loop reacts on its own: diagnose, escrow,
    dispatch, and CRE-attested settle — so the sensor genuinely faults and heals
    and the contract genuinely settles. A report that matches no instrumented
    sensor is reported honestly instead of fabricating a job.
    """
    agent = get_agent()
    if agent is None:
        return {"error": "agent not initialized"}

    text = (req.text or "").strip()
    if not text:
        return {"error": "empty report"}

    result = await asyncio.to_thread(triage, text)
    await agent.events.emit(
        "DIAGNOSE",
        f"Resident reported: “{text[:200]}” — {result.interpretation}",
        propertyId=result.device_id,
    )

    if result.device_id is None:
        await agent.events.emit(
            "RESULT",
            "No instrumented sensor matches that report. WARD only acts on faults "
            "it can attest on-chain (wifi, thermostat, lock, leak).",
        )
        return {"matched": False, **result.to_dict()}

    after = await _inject_and_drive(agent, result.device_id, result.mode, req.autoComplete)
    return {
        "matched": True,
        "injected": after.to_dict(),
        "autoComplete": req.autoComplete,
        **result.to_dict(),
    }


async def _inject_and_drive(
    agent: WardAgent, device_id: str, mode: str, auto_complete: bool
) -> DeviceStatus:
    """Fail a device in the sim, announce it, and (when needed) drive the worker
    side so the cycle completes end-to-end. Shared by /incident/simulate and
    /incident/describe so both paths behave identically once a device is chosen."""
    after = await agent.sim.fail(device_id, mode=mode)
    await agent.events.emit(
        "MONITOR",
        f"Incident injected: {device_id} set to fault mode '{after.faultMode}'.",
        propertyId=after.propertyId,
    )
    if auto_complete and after.faultMode == "hard" and not get_config().auto_complete:
        # Drive the human side so the demo runs end-to-end. Only needed when the
        # agent's own autonomous completion is disabled (WARD_AUTO_COMPLETE off);
        # otherwise the agent loop already accepts + marks done + repairs +
        # settles on its own, and driving it again would double the worker txs.
        asyncio.create_task(_drive_worker_side(agent, device_id, after.propertyId))
    return after


async def _drive_worker_side(agent: WardAgent, device_id: str, property_id: str) -> None:
    """Wait for the agent to escrow + dispatch a job for this property, then
    perform the worker action (physical repair + submit the deliverable). This
    is the field-tech half of the demo; the agent half (and the evaluator-signed
    complete that releases payment) runs on its own loop."""
    cfg = get_config()
    # Wait for a job to be created for this property.
    job = None
    waited = 0.0
    while waited < 30.0 and job is None:
        job = agent.jobs.active_for_property(property_id)
        if job and job.job_id >= 0:
            break
        job = None
        await asyncio.sleep(0.5)
        waited += 0.5
    if job is None:
        return

    # Field tech does the physical repair (clears the hard fault).
    await asyncio.sleep(1.0)
    await agent.sim.repair(device_id)
    # Provider (worker) submits the deliverable via the chain client; the
    # evaluator complete() that releases payment is driven by the agent loop
    # once telemetry confirms healthy.
    await asyncio.sleep(0.5)
    agent.worker_submit(job.job_id)


def run() -> None:
    import uvicorn

    cfg = get_config()
    uvicorn.run(
        "ward_agent.server:app",
        host=cfg.server_host,
        port=cfg.server_port,
        log_level="info",
    )


if __name__ == "__main__":
    run()
