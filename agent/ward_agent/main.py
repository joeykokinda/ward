"""The asyncio agent loop — WARD's brain.

Flow (per the shared interface contract and the escalation ladder):

  poll fleet
    -> on fault: DIAGNOSE
       -> if level 1: ACTION (remote restart) -> RESULT
            -> healed? log RESOLVED, stop
       -> if still down: conclude hardware fault
            -> ESCROW   createJob(provider, evaluator) -> setBudget -> fund
                        [respect spending caps + 100 USDC owner threshold]
            -> DISPATCH highest-reputation worker submits (provider key)
            -> repair the sim device + confirm telemetry healthy
            -> RESULT   evaluator complete() -> budget released to provider
            -> RESOLVED incident closed

The ERC-8183 (WardEscrow) lifecycle the agent drives:
OPEN -> FUNDED -> SUBMITTED -> COMPLETED. The evaluator-signed complete() is the
sensor-settled release representing the CRE attestation (agent repairs the
device, confirms healthy, then the evaluator key completes).

Spending policy: below the owner-approval threshold the agent acts
autonomously; at/above it the job is marked pending owner approval and not
escrowed until approved. Per-job and daily caps are enforced before escrow.

Designed to run continuously (poll loop) or to drive a single incident
end-to-end (run_incident) for the demo / verification harness.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from .chain import ChainClient, Worker, get_chain_client
from .config import Config, get_config, usdc
from .diagnosis import diagnose
from .events import EventBus, get_event_bus
from .fake_sim import FakeSim
from .jobs import Job, JobRegistry, JobState, get_job_registry
from .sim_client import DeviceStatus, SimClient

logger = logging.getLogger("ward.main")


class WardAgent:
    """Owns the loop state and the dependency wiring."""

    def __init__(
        self,
        sim: SimClient | FakeSim | None = None,
        chain: ChainClient | None = None,
        events: EventBus | None = None,
        jobs: JobRegistry | None = None,
        config: Config | None = None,
    ) -> None:
        self.cfg = config or get_config()
        self.sim = sim  # may be set later by from_environment()
        self.chain = chain or get_chain_client()
        self.events = events or get_event_bus()
        self.jobs = jobs or get_job_registry()
        # Properties currently being handled, so a slow fix doesn't re-trigger.
        self._in_progress: set[str] = set()
        # Per-incident reasoning history, keyed by deviceId, for the LLM.
        self._history: dict[str, list[dict[str, Any]]] = {}
        self._running = False
        self._daily_spent_units = 0

    # --------------------------------------------------------------- factory
    @classmethod
    async def from_environment(cls) -> "WardAgent":
        """Build an agent, choosing the real sim if reachable else the FakeSim."""
        cfg = get_config()
        real = SimClient()
        if await real.reachable():
            logger.info("sim: real device sim reachable at %s", real.base_url)
            sim: SimClient | FakeSim = real
        else:
            logger.info("sim: real sim unreachable -> using in-process FakeSim")
            sim = FakeSim()
        agent = cls(sim=sim, config=cfg)
        return agent

    # ----------------------------------------------------------- history helper
    def _record(self, device_id: str, event_dict: dict[str, Any]) -> None:
        self._history.setdefault(device_id, []).append(event_dict)

    async def _emit(self, *args, device_id: str | None = None, **kwargs):
        event = await self.events.emit(*args, **kwargs)
        if device_id:
            self._record(device_id, event.to_dict())
        return event

    # --------------------------------------------------------------- polling
    async def poll_once(self) -> None:
        """One fleet poll; react to any new fault not already in progress."""
        try:
            fleet = await self.sim.fleet()
        except Exception as exc:  # pragma: no cover - sim transient failure
            logger.warning("fleet poll failed: %s", exc)
            return

        unhealthy = [d for d in fleet if not d.healthy]
        await self.events.emit(
            "MONITOR",
            f"Polled fleet: {len(fleet)} devices, {len(unhealthy)} unhealthy.",
        )
        for device in unhealthy:
            if device.propertyId in self._in_progress:
                continue
            # Launch incident handling concurrently so the poll loop keeps moving.
            asyncio.create_task(self._guarded_incident(device))

    async def _guarded_incident(self, device: DeviceStatus) -> None:
        self._in_progress.add(device.propertyId)
        try:
            await self.handle_incident(device)
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("incident handler crashed for %s", device.propertyId)
            await self.events.emit(
                "RESULT",
                f"Incident handler error for {device.propertyId}: {exc}",
                propertyId=device.propertyId,
            )
        finally:
            self._in_progress.discard(device.propertyId)

    # ----------------------------------------------------------- the incident
    async def handle_incident(self, device: DeviceStatus) -> Job | None:
        """Drive one fault from detection to resolution. Returns the Job if a
        Level-3 dispatch occurred, else None (resolved at Level 1)."""
        prop = device.propertyId
        dev = device.deviceId
        # A new fault is a fresh incident: reset the per-incident reasoning
        # history so each incident replays the full L1-first narrative (the
        # permanent audit log lives in the EventBus, not here).
        self._history[dev] = []

        # Re-fetch fresh status so the diagnosis reflects the current fault,
        # not a stale fleet snapshot (the device may have changed since poll).
        try:
            device = await self.sim.status(dev)
        except Exception:
            pass
        if device.healthy:
            await self._emit(
                "MONITOR",
                f"{prop} ({dev}) already healthy on re-check; no action needed.",
                propertyId=prop,
                device_id=dev,
            )
            return None

        await self._emit(
            "MONITOR",
            f"Fault detected on {prop} ({dev}): online={device.online}, "
            f"faultMode={device.faultMode}, signal={device.signalDbm}dBm.",
            propertyId=prop,
            device_id=dev,
        )

        # --- DIAGNOSE -------------------------------------------------------
        diag = diagnose(device, self._history.get(dev, []))
        await self._emit(
            "DIAGNOSE",
            f"{diag.rationale} (cause: {diag.likely_cause}; "
            f"recommend L{diag.recommended_level}; confidence {diag.confidence:.0%}; "
            f"via {diag.source})",
            propertyId=prop,
            device_id=dev,
        )

        # --- LEVEL 1: remote self-fix --------------------------------------
        if diag.recommended_level == 1:
            await self._emit(
                "ACTION",
                f"Attempting Level 1 remote restart of {dev}.",
                propertyId=prop,
                device_id=dev,
            )
            try:
                after = await self.sim.restart(dev)
            except Exception as exc:
                await self._emit(
                    "RESULT",
                    f"Remote restart call failed: {exc}",
                    propertyId=prop,
                    device_id=dev,
                )
                after = await self.sim.status(dev)

            if after.healthy:
                await self._emit(
                    "RESULT",
                    f"{dev} recovered after remote restart (online, faultMode=none).",
                    propertyId=prop,
                    device_id=dev,
                )
                await self._emit(
                    "RESOLVED",
                    f"{prop} healed at Level 1 (free, autonomous). No human needed.",
                    propertyId=prop,
                    device_id=dev,
                )
                return None

            await self._emit(
                "RESULT",
                f"Remote restart did not heal {dev} (still offline / "
                f"faultMode={after.faultMode}). Concluding hardware fault.",
                propertyId=prop,
                device_id=dev,
            )
            # Re-diagnose with the failed-restart history so the level escalates.
            diag = diagnose(after, self._history.get(dev, []))
            await self._emit(
                "DIAGNOSE",
                f"Re-diagnosis after failed restart: {diag.rationale} "
                f"(recommend L{diag.recommended_level}; via {diag.source})",
                propertyId=prop,
                device_id=dev,
            )
            device = after  # use the post-restart status going forward

        # If even after escalation the model still says L1, force L3 since the
        # remote fix has demonstrably failed.
        if diag.recommended_level != 3:
            await self._emit(
                "DIAGNOSE",
                "Remote remediation exhausted; escalating to Level 3 dispatch.",
                propertyId=prop,
                device_id=dev,
            )

        # --- LEVEL 3: escrow + dispatch ------------------------------------
        return await self._dispatch_level3(device)

    async def _dispatch_level3(self, device: DeviceStatus) -> Job | None:
        prop = device.propertyId
        dev = device.deviceId
        amount = self.cfg.job_amount_units

        # --- one-open-job-per-property guard -------------------------------
        # While a device stays unhealthy, every poll re-runs the incident. Only
        # one unsettled job per property should exist; skip if one is already
        # open/funded/submitted (the registry excludes terminals).
        existing = self.jobs.active_for_property(prop)
        if existing is not None:
            await self._emit(
                "MONITOR",
                f"{prop} already has open job #{existing.job_id} "
                f"(state={existing.state.value}); not creating a duplicate.",
                jobId=existing.job_id,
                propertyId=prop,
                device_id=dev,
            )
            return existing

        # --- spending policy gate ------------------------------------------
        owner_required = amount >= self.cfg.owner_approval_threshold_units
        if amount > self.cfg.per_job_cap_units:
            await self._emit(
                "RESULT",
                f"Job amount {usdc(amount)} USDC exceeds per-job cap "
                f"{usdc(self.cfg.per_job_cap_units)} USDC. Not dispatching.",
                propertyId=prop,
                device_id=dev,
            )
            return None
        if self._daily_spent_units + amount > self.cfg.daily_cap_units:
            await self._emit(
                "RESULT",
                f"Daily spend cap reached ({usdc(self.cfg.daily_cap_units)} USDC). "
                "Holding dispatch.",
                propertyId=prop,
                device_id=dev,
            )
            return None

        # --- select worker (highest reputation) ----------------------------
        worker = self.chain.select_highest_reputation_worker()
        if worker is None:
            await self._emit(
                "RESULT",
                "No registered worker available to dispatch. Holding.",
                propertyId=prop,
                device_id=dev,
            )
            return None

        # Build the Job record up front so the threshold state is visible even
        # if it parks pending owner approval.
        job = Job(
            job_id=-1,  # assigned on escrow
            property_id=prop,
            device_id=dev,
            amount_units=amount,
            owner_approval_required=owner_required,
            owner_approved=not owner_required,  # below threshold = auto-approved
            worker_address=worker.address,
            worker_handle=worker.handle,
            worker_ens=worker.ensName,
        )

        if job.pending_owner_approval:
            await self._emit(
                "ESCROW",
                f"Job amount {usdc(amount)} USDC is at/above the "
                f"{usdc(self.cfg.owner_approval_threshold_units)} USDC owner-approval "
                "threshold. Marked PENDING OWNER APPROVAL; not escrowing autonomously.",
                propertyId=prop,
                device_id=dev,
            )
            # Park it; an owner-approval channel would later flip the flag.
            self.jobs.add(job)
            return job

        # --- ESCROW: createJob -> setBudget -> fund ------------------------
        # Homeowner-voiced job description recorded on-chain.
        description = (
            f"{prop} WiFi router hardware fault confirmed (faultMode="
            f"{device.faultMode}) — dispatch field tech to replace."
        )
        await self._emit(
            "ESCROW",
            f"Hardware fault confirmed. Opening an escrowed job on Arc for {prop} "
            f"({usdc(amount)} USDC < {usdc(self.cfg.owner_approval_threshold_units)} "
            "threshold -> autonomous, no owner sign-off needed). "
            f"Evaluator (CRE oracle) = {self.chain.evaluator_label}.",
            propertyId=prop,
            device_id=dev,
        )
        job_id, tx_create = self.chain.create_job(
            property_id=prop,
            device_id=dev,
            amount_units=amount,
            deadline_secs=self.cfg.job_deadline_secs,
            owner_approved=job.owner_approved,
            provider_address=worker.address,
            description=description,
        )
        job.job_id = job_id
        job.tx_create = tx_create
        self.jobs.add(job)
        self._daily_spent_units += amount

        # Set the budget, then fund (pull USDC into escrow).
        job.tx_budget = self.chain.set_budget(job_id, amount)
        job.tx_fund = self.chain.fund(job_id, amount)
        job.transition(JobState.FUNDED)
        await self._emit(
            "ESCROW",
            f"{usdc(amount)} USDC funded into WardEscrow. Job #{job_id} FUNDED.",
            jobId=job_id,
            txHash=self.chain.explorer_tx_url(job.tx_fund),
            propertyId=prop,
            device_id=dev,
        )

        # --- DISPATCH: highest-reputation worker ----------------------------
        await self._emit(
            "DISPATCH",
            f"Dispatching highest-reputation worker {worker.ensName} "
            f"(reputation {worker.reputation}) to {prop}.",
            jobId=job_id,
            propertyId=prop,
            device_id=dev,
        )

        # --- autonomous worker completion (demo) ----------------------------
        # When auto-complete is on and the agent holds the dispatched worker's
        # signing key, drive the provider side itself: submit() the deliverable,
        # then physically repair the device so telemetry recovers. With it off,
        # the worker submits via the UI and an external trigger advances chain.
        if self.cfg.auto_complete and self.chain.has_worker_key(worker.address):
            await self._auto_complete_worker(job, device)

        # --- wait for the provider's submit() ------------------------------
        await self._await_worker(job, device)
        if job.state != JobState.SUBMITTED:
            await self._emit(
                "RESULT",
                f"Job #{job_id} did not reach SUBMITTED (state={job.state.value}). "
                "Refund can be claimed after the deadline.",
                jobId=job_id,
                propertyId=prop,
                device_id=dev,
            )
            return job

        # --- evaluator-settled completion (the CRE seam) -------------------
        await self._complete_on_healthy(job, device)
        return job

    async def _auto_complete_worker(self, job: Job, device: DeviceStatus) -> None:
        """Drive the provider side autonomously (the field-tech half) when the
        agent holds the worker's key and WARD_AUTO_COMPLETE is on.

        Performs only the on-chain (or DRY) effects here — submit() and the
        physical repair so telemetry recovers. The DISPATCH event and the Job
        state transition are emitted by _await_worker observing the chain view,
        keeping a single owner of transitions (no race). The subsequent
        _complete_on_healthy then emits RESULT/RESOLVED via the evaluator.
        """
        job_id = job.job_id
        dev = job.device_id
        # Provider submits the deliverable on-chain.
        self.worker_submit(job_id)
        # Field tech does the physical repair so the device reports healthy and
        # the evaluator (CRE) can confirm it before complete().
        try:
            await self.sim.repair(dev)
        except Exception as exc:  # pragma: no cover - sim transient failure
            await self._emit(
                "RESULT",
                f"Auto-complete repair call failed for {dev}: {exc}",
                jobId=job_id,
                propertyId=job.property_id,
                device_id=dev,
            )

    async def _await_worker(self, job: Job, device: DeviceStatus) -> None:
        """Wait for the provider (worker) to submit() the deliverable.

        In a live demo the worker uses the mobile UI; in DRY/offline mode we
        let an external trigger (POST /incident/simulate worker steps, or the
        verification harness) advance it. Here we poll the chain client's view
        until SUBMITTED, or timeout.
        """
        job_id = job.job_id
        deadline = self.cfg.attestation_timeout_secs
        waited = 0.0
        interval = self.cfg.attestation_poll_secs

        while waited < deadline and job.state != JobState.SUBMITTED:
            chain_state = self.chain.get_job_state(job_id)
            if chain_state == "SUBMITTED" and job.state == JobState.FUNDED:
                job.transition(JobState.SUBMITTED)
                await self._emit(
                    "DISPATCH",
                    f"Worker {job.worker_ens} submitted the repair deliverable on "
                    f"job #{job_id}.",
                    jobId=job_id,
                    propertyId=job.property_id,
                    device_id=job.device_id,
                )
                break
            await asyncio.sleep(interval)
            waited += interval

    async def _complete_on_healthy(self, job: Job, device: DeviceStatus) -> None:
        """Confirm telemetry recovered, then have the EVALUATOR complete() the
        job (the sensor-settled release that pays the provider). This is the CRE
        attestation seam: the evaluator key signs complete() only after /status
        reports healthy."""
        job_id = job.job_id
        dev = job.device_id
        prop = job.property_id

        # Confirm telemetry recovered before the evaluator completes.
        status = await self.sim.status(dev)
        if not status.healthy:
            await self._emit(
                "RESULT",
                f"Device {dev} not yet healthy (online={status.online}, "
                f"faultMode={status.faultMode}); waiting before evaluator settles.",
                jobId=job_id,
                propertyId=prop,
                device_id=dev,
            )
            waited = 0.0
            while waited < self.cfg.attestation_timeout_secs and not status.healthy:
                await asyncio.sleep(self.cfg.attestation_poll_secs)
                waited += self.cfg.attestation_poll_secs
                status = await self.sim.status(dev)
            if not status.healthy:
                await self._emit(
                    "RESULT",
                    f"Device {dev} did not recover within the settle window. "
                    "Not completing; refund can be claimed after the deadline.",
                    jobId=job_id,
                    propertyId=prop,
                    device_id=dev,
                )
                return

        # Evaluator availability check (degrade gracefully in live mode).
        if not self.chain.evaluator_ready:
            await self._emit(
                "RESULT",
                f"Telemetry recovered for {dev}, but no evaluator key is configured "
                "(EVALUATOR_PRIVATE_KEY). Holding; the CRE evaluator must complete "
                f"job #{job_id} to release payment.",
                jobId=job_id,
                propertyId=prop,
                device_id=dev,
            )
            return

        await self._emit(
            "RESULT",
            f"Telemetry recovered for {dev}. CRE evaluator attesting the device is "
            "healthy and settling the job.",
            jobId=job_id,
            propertyId=prop,
            device_id=dev,
        )

        # --- evaluator complete() (the sensor-settled release) -------------
        tx_complete = self.chain.complete(job_id, reason="healthy")
        job.tx_complete = tx_complete
        job.transition(JobState.COMPLETED)
        await self._emit(
            "RESULT",
            f"Evaluator released {usdc(job.amount_units)} USDC to {job.worker_ens}; "
            "reputation incremented.",
            jobId=job_id,
            txHash=self.chain.explorer_tx_url(tx_complete),
            propertyId=prop,
            device_id=dev,
        )
        await self._emit(
            "RESOLVED",
            f"{prop} restored by {job.worker_ens} and settled on attested telemetry. "
            "Incident closed.",
            jobId=job_id,
            propertyId=prop,
            device_id=dev,
        )

    # ----------------------------------------------- worker-side advance hooks
    # These model the field tech's chain action (submit). It does the on-chain
    # (or DRY) effect ONLY — the agent's own Job state machine is advanced
    # exclusively by _await_worker observing the chain view, so there is a single
    # owner of transitions and DISPATCH events (no race).
    def worker_submit(self, job_id: int) -> None:
        job = self.jobs.get(job_id)
        if job is None:
            return
        tx = self.chain.submit(job_id, job.device_id)
        job.tx_submit = tx

    # --------------------------------------------------------------- run loop
    async def run_forever(self) -> None:
        self._running = True
        await self.events.emit(
            "MONITOR",
            f"WARD agent online. Chain mode: {'DRY' if self.chain.dry else 'LIVE'}; "
            f"LLM: {'on' if self.cfg.llm_enabled else 'rules-fallback'}; "
            f"sim: {getattr(self.sim, 'base_url', 'unknown')}.",
        )
        while self._running:
            await self.poll_once()
            await asyncio.sleep(self.cfg.poll_interval_secs)

    def stop(self) -> None:
        self._running = False


_agent: WardAgent | None = None


def get_agent() -> WardAgent | None:
    return _agent


def set_agent(agent: WardAgent) -> None:
    global _agent
    _agent = agent


async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    agent = await WardAgent.from_environment()
    set_agent(agent)
    await agent.run_forever()


if __name__ == "__main__":
    asyncio.run(main())
