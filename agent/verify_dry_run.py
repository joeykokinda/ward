"""End-to-end DRY-mode verification harness.

Drives ONE complete incident through the real agent loop and prints the
emitted reasoning event stream:

    fault -> failed restart -> escrow -> dispatch -> accept -> work-done
          -> CRE attestation -> settle -> resolved

Runs against the LOCAL SIM if reachable, otherwise the built-in FakeSim.
Forces chain DRY mode and works with or without ANTHROPIC_API_KEY (the agent
falls back to rules-based diagnosis when the key is unset).

Usage:
    python verify_dry_run.py            # hard fault -> full L3 cycle
    python verify_dry_run.py soft       # soft fault -> resolves at L1
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys

# Force DRY chain regardless of ambient env, so the harness is hermetic.
import os

os.environ.pop("ARC_RPC_URL", None)
os.environ.pop("AGENT_PRIVATE_KEY", None)
# Tighten loop timings so the demo completes quickly.
os.environ.setdefault("WARD_ATTEST_POLL", "0.2")
os.environ.setdefault("WARD_ATTEST_TIMEOUT", "20")

from ward_agent.config import reload_config, usdc  # noqa: E402
from ward_agent.events import get_event_bus  # noqa: E402
from ward_agent.main import WardAgent  # noqa: E402


def _fmt(event: dict) -> str:
    tag = f"{event['type']:<9}"
    extra = []
    if event.get("propertyId"):
        extra.append(f"prop={event['propertyId']}")
    if event.get("jobId") is not None:
        extra.append(f"job={event['jobId']}")
    if event.get("txHash"):
        tx = event["txHash"]
        short = tx if len(tx) < 24 else tx[:18] + "..." + tx[-6:]
        extra.append(f"tx={short}")
    suffix = ("  [" + ", ".join(extra) + "]") if extra else ""
    return f"  {tag} {event['message']}{suffix}"


async def run(mode: str) -> int:
    logging.basicConfig(level=logging.WARNING)  # quiet logger; we print events ourselves
    reload_config()
    cfg = reload_config()

    agent = await WardAgent.from_environment()
    sim_kind = type(agent.sim).__name__
    print("=" * 78)
    print("WARD agent DRY-mode end-to-end verification")
    print("=" * 78)
    print(f"  sim:        {sim_kind} @ {getattr(agent.sim, 'base_url', '?')}")
    print(f"  chain:      {'DRY' if agent.chain.dry else 'LIVE'}  (agent {agent.chain.agent_address})")
    print(f"  llm:        {'Anthropic API' if cfg.llm_enabled else 'rules-based fallback (no key)'}")
    print(f"  job amount: {usdc(cfg.job_amount_units)} USDC   threshold: {usdc(cfg.owner_approval_threshold_units)} USDC")
    print(f"  fault mode: {mode}")
    print(f"  USDC balance (pre):  {usdc(agent.chain.usdc_balance_units())}")
    print("-" * 78)

    # Pick the demo target: prop-2 (Greenwich Cottage) per DEMO.md.
    fleet = await agent.sim.fleet()
    target = next((d for d in fleet if d.propertyId == "prop-2"), fleet[0])

    # Inject the fault.
    await agent.sim.fail(target.deviceId, mode=mode)

    # Kick off the worker side concurrently for the hard-fault path so the
    # full cycle settles (mirrors POST /incident/simulate autoComplete).
    async def worker_side() -> None:
        job = None
        waited = 0.0
        while waited < 15.0 and job is None:
            job = agent.jobs.active_for_property(target.propertyId)
            if job and job.job_id >= 0:
                break
            job = None
            await asyncio.sleep(0.2)
            waited += 0.2
        if job is None:
            return
        await asyncio.sleep(0.5)
        await agent.sim.repair(target.deviceId)  # field tech fixes hardware
        agent.worker_accept(job.job_id)
        await asyncio.sleep(0.3)
        agent.worker_mark_done(job.job_id)

    tasks = [asyncio.create_task(agent.handle_incident(target))]
    if mode == "hard":
        tasks.append(asyncio.create_task(worker_side()))

    job_result = await tasks[0]
    if len(tasks) > 1:
        await tasks[1]

    # Print the full emitted event stream.
    events = get_event_bus().recent(500)
    print("EMITTED EVENT STREAM")
    print("-" * 78)
    for ev in events:
        print(_fmt(ev))
    print("-" * 78)
    print(f"  USDC balance (post): {usdc(agent.chain.usdc_balance_units())}")

    # Verdict.
    print("=" * 78)
    seen_types = [e["type"] for e in events]
    if mode == "hard":
        required = ["MONITOR", "DIAGNOSE", "ACTION", "ESCROW", "DISPATCH", "RESULT", "RESOLVED"]
        ok = all(t in seen_types for t in required)
        settled = job_result is not None and job_result.state.value == "SETTLED"
        print(f"  required event types present: {ok}  ({[t for t in required if t in seen_types]})")
        print(f"  job reached SETTLED:          {settled}"
              + (f"  (job #{job_result.job_id})" if job_result else ""))
        verdict = ok and settled
    else:
        ok = "RESOLVED" in seen_types and "ESCROW" not in seen_types
        print("  resolved at Level 1 with no escrow:", ok)
        verdict = ok
    print(f"  VERDICT: {'PASS' if verdict else 'FAIL'}")
    print("=" * 78)
    return 0 if verdict else 1


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "hard"
    raise SystemExit(asyncio.run(run(mode)))
