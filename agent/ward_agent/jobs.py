"""Job lifecycle orchestration.

Models the ERC-8183 (WardEscrow) on-chain lifecycle:

    OPEN -> FUNDED -> SUBMITTED -> COMPLETED
    (off-happy-path: REJECTED / EXPIRED / REFUNDED)

These map 1:1 onto the contract's JobStatus enum
{0 Open, 1 Funded, 2 Submitted, 3 Completed, 4 Rejected, 5 Expired}; the agent
adds REFUNDED locally to mark a claimRefund() against an expired job.

This module is a thin, transport-agnostic state holder + transition guard. The
agent loop (main.py) drives transitions; chain.py performs the on-chain (or
DRY) effects. Keeping the state machine here makes the legal transitions
explicit and testable.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class JobState(str, Enum):
    OPEN = "OPEN"            # createJob done; budget may or may not be set yet
    FUNDED = "FUNDED"        # fund() pulled USDC into escrow
    SUBMITTED = "SUBMITTED"  # provider (worker) submit()ed the deliverable
    COMPLETED = "COMPLETED"  # evaluator complete()d -> payment released
    REJECTED = "REJECTED"    # evaluator/client reject()ed
    EXPIRED = "EXPIRED"      # past expiredAt, awaiting refund
    REFUNDED = "REFUNDED"    # claimRefund() returned the budget to the client


# Legal forward transitions (plus the off-happy-path terminals).
_LEGAL: dict[JobState, set[JobState]] = {
    JobState.OPEN: {JobState.FUNDED, JobState.REJECTED, JobState.EXPIRED, JobState.REFUNDED},
    JobState.FUNDED: {JobState.SUBMITTED, JobState.REJECTED, JobState.EXPIRED, JobState.REFUNDED},
    JobState.SUBMITTED: {JobState.COMPLETED, JobState.REJECTED, JobState.EXPIRED, JobState.REFUNDED},
    JobState.COMPLETED: set(),
    JobState.REJECTED: set(),
    JobState.EXPIRED: {JobState.REFUNDED},
    JobState.REFUNDED: set(),
}

TERMINAL_STATES = {JobState.COMPLETED, JobState.REJECTED, JobState.REFUNDED}


class IllegalTransition(Exception):
    pass


@dataclass(slots=True)
class Job:
    """Lifecycle record for a single dispatched job."""

    job_id: int
    property_id: str
    device_id: str
    amount_units: int
    state: JobState = JobState.OPEN
    worker_address: str | None = None
    worker_handle: str | None = None
    worker_ens: str | None = None
    owner_approval_required: bool = False
    owner_approved: bool = False
    tx_create: str | None = None
    tx_budget: str | None = None
    tx_fund: str | None = None
    tx_submit: str | None = None
    tx_complete: str | None = None
    created_at: float = field(default_factory=time.time)
    history: list[tuple[float, str]] = field(default_factory=list)

    def transition(self, to: JobState) -> None:
        if to not in _LEGAL.get(self.state, set()):
            raise IllegalTransition(f"{self.state.value} -> {to.value} is not allowed")
        self.history.append((time.time(), f"{self.state.value}->{to.value}"))
        self.state = to

    @property
    def is_terminal(self) -> bool:
        return self.state in TERMINAL_STATES

    @property
    def pending_owner_approval(self) -> bool:
        """At/above the threshold and not yet owner-approved => parked."""
        return self.owner_approval_required and not self.owner_approved

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "property_id": self.property_id,
            "device_id": self.device_id,
            "amount_units": self.amount_units,
            "state": self.state.value,
            "worker_address": self.worker_address,
            "worker_handle": self.worker_handle,
            "worker_ens": self.worker_ens,
            "owner_approval_required": self.owner_approval_required,
            "owner_approved": self.owner_approved,
            "tx_create": self.tx_create,
            "tx_budget": self.tx_budget,
            "tx_fund": self.tx_fund,
            "tx_submit": self.tx_submit,
            "tx_complete": self.tx_complete,
        }


class JobRegistry:
    """In-memory registry of jobs the agent is tracking this run."""

    def __init__(self) -> None:
        self._jobs: dict[int, Job] = {}

    def add(self, job: Job) -> None:
        self._jobs[job.job_id] = job

    def get(self, job_id: int) -> Job | None:
        return self._jobs.get(job_id)

    def all(self) -> list[Job]:
        return list(self._jobs.values())

    def active(self) -> list[Job]:
        return [j for j in self._jobs.values() if not j.is_terminal]

    def active_for_property(self, property_id: str) -> Job | None:
        for job in self._jobs.values():
            if job.property_id == property_id and not job.is_terminal:
                return job
        return None


_registry: JobRegistry | None = None


def get_job_registry() -> JobRegistry:
    global _registry
    if _registry is None:
        _registry = JobRegistry()
    return _registry
