"""End-to-end DRY-mode verification harness.

Drives ONE complete incident through the real agent loop and prints the
emitted reasoning event stream (ERC-8183 / WardEscrow lifecycle):

    fault -> failed restart -> escrow (createJob/setBudget/fund) -> dispatch
          -> worker submit -> repair + healthy -> evaluator complete -> resolved
    (OPEN -> FUNDED -> SUBMITTED -> COMPLETED)

Runs against the LOCAL SIM if reachable, otherwise the built-in FakeSim.
Forces chain DRY mode and works with or without ANTHROPIC_API_KEY (the agent
falls back to rules-based diagnosis when the key is unset).

Usage:
    python verify_dry_run.py            # hard fault -> full autonomous L3 cycle
    python verify_dry_run.py soft       # soft fault -> resolves at L1
    python verify_dry_run.py persist    # persistent hard fault over several
                                        #   poll cycles -> only ONE job created
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
    print(f"  auto-complete:       WARD_AUTO_COMPLETE={cfg.auto_complete}")
    print(f"  USDC balance (pre):  {usdc(agent.chain.usdc_balance_units())}")
    print("-" * 78)

    # Pick the demo target: prop-2 (Greenwich Cottage).
    fleet = await agent.sim.fleet()
    target = next((d for d in fleet if d.propertyId == "prop-2"), fleet[0])

    # Inject the fault. "persist" exercises the dedup guard with a hard fault.
    fault_mode = "hard" if mode in ("hard", "persist") else "soft"
    await agent.sim.fail(target.deviceId, mode=fault_mode)

    if mode == "persist":
        # Persistent hard fault: re-run the incident several times WITHOUT ever
        # repairing the device (the device stays unhealthy across poll cycles),
        # to prove the one-open-job-per-property guard prevents duplicate escrow
        # jobs. Auto-complete repairs the device, so disable it here; and keep
        # the no-worker wait short so each incident returns quickly (the worker
        # never acts, so the job stays OPEN — exactly the duplicate-trigger
        # condition the guard must catch).
        agent.cfg.auto_complete = False
        agent.cfg.attestation_timeout_secs = 0.4
        for _ in range(3):
            await agent.handle_incident(target)
        job_result = agent.jobs.active_for_property(target.propertyId)
    else:
        # Hard / soft: let the agent drive ONE incident fully on its own. No
        # external worker driver — the agent auto-completes the worker side.
        job_result = await agent.handle_incident(target)

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
        completed = job_result is not None and job_result.state.value == "COMPLETED"
        print(f"  required event types present: {ok}  ({[t for t in required if t in seen_types]})")
        print(f"  job reached COMPLETED autonomously: {completed}"
              + (f"  (job #{job_result.job_id})" if job_result else ""))
        verdict = ok and completed
    elif mode == "persist":
        created = sum(1 for e in events if e["type"] == "ESCROW" and "FUNDED" in e["message"])
        deduped = sum(1 for e in events if "already has open job" in e["message"])
        all_jobs = len(agent.jobs.all())
        print(f"  ESCROW jobs funded:           {created}  (expected exactly 1)")
        print(f"  duplicate attempts skipped:   {deduped}")
        print(f"  total jobs in registry:       {all_jobs}")
        verdict = created == 1 and all_jobs == 1 and deduped >= 1
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
