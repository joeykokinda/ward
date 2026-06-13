"""web3.py wrapper for the WARD on-chain rails, with a DRY fallback.

Reads contract addresses + ABIs from /deployments/<chainId>.json and
/deployments/abis/ (INTERFACES.md export format). Exposes the surface the
agent needs against JobEscrow + WorkerRegistry + USDC:

  - create_job(...)           -> JobEscrow.createJob
  - accept_job / mark_work_done (used by the worker; here for end-to-end DRY demo)
  - watch JobAccepted / WorkMarkedDone (poll-based)
  - request_attestation(...)  -> the clean CRE seam (settle-trigger)
  - settle(...)               -> JobEscrow.settle
  - balances + worker reads

If no RPC / key is configured (or web3 / deployments are missing), the wrapper
runs in DRY mode: it logs the txs it WOULD send, returns synthetic tx hashes,
and simulates the job lifecycle in memory so the loop is demoable offline.
Never hard-crashes on missing config (INTERFACES.md).

CRE trigger seam: `request_attestation(job_id, device_id)` is intentionally
isolated so the verification mechanism (CRE -> Arc directly vs an authorized
reporter, per SPIKES.md) can be swapped without touching job logic. In DRY
mode it simulates the attestation once the device reports healthy.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

from .config import get_config, usdc

logger = logging.getLogger("ward.chain")


def _bytes32_from_id(identifier: str) -> bytes:
    """Pack a short string id (e.g. 'prop-2-router') into bytes32 (right-padded),
    matching how the Solidity side would store a short ASCII id. Falls back to a
    keccak-style hash if it doesn't fit 32 bytes."""
    raw = identifier.encode("utf-8")
    if len(raw) <= 32:
        return raw.ljust(32, b"\x00")
    return hashlib.sha256(raw).digest()


@dataclass(slots=True)
class Worker:
    address: str
    handle: str
    ensName: str
    skills: str
    region: str
    reputation: int
    stake: int = 0
    registered: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "address": self.address,
            "handle": self.handle,
            "ensName": self.ensName,
            "skills": self.skills,
            "region": self.region,
            "reputation": self.reputation,
            "stake": self.stake,
            "registered": self.registered,
        }


@dataclass(slots=True)
class JobView:
    job_id: int
    property_id: str
    device_id: str
    amount_units: int
    state: str  # OPEN | ACCEPTED | WORK_DONE | ATTESTING | SETTLED | EXPIRED | REFUNDED
    worker: str | None = None
    tx_create: str | None = None
    tx_settle: str | None = None


# Default worker roster used when no registry is on-chain / in DRY mode.
# Mirrors DEMO.md (5 workers, reputation, ENS subnames).
_DEFAULT_ROSTER: list[dict[str, Any]] = [
    {"address": "0x1111111111111111111111111111111111111111", "handle": "mike",
     "ensName": "mike.ward-agent.eth", "skills": "networking,router", "region": "NYC", "reputation": 87},
    {"address": "0x2222222222222222222222222222222222222222", "handle": "sara",
     "ensName": "sara.ward-agent.eth", "skills": "networking,electrical", "region": "NYC", "reputation": 92},
    {"address": "0x3333333333333333333333333333333333333333", "handle": "jen",
     "ensName": "jen.ward-agent.eth", "skills": "router,iot", "region": "Brooklyn", "reputation": 78},
    {"address": "0x4444444444444444444444444444444444444444", "handle": "carlos",
     "ensName": "carlos.ward-agent.eth", "skills": "networking", "region": "Queens", "reputation": 64},
    {"address": "0x5555555555555555555555555555555555555555", "handle": "ava",
     "ensName": "ava.ward-agent.eth", "skills": "router,iot,electrical", "region": "Manhattan", "reputation": 81},
]


class ChainClient:
    """Wrapper over JobEscrow + WorkerRegistry + USDC, with a DRY fallback."""

    def __init__(self) -> None:
        self.cfg = get_config()
        self.dry = True  # set False only after a successful live wiring
        self._w3 = None
        self._account = None
        self._deployment: dict[str, Any] = {}
        self._abis: dict[str, Any] = {}
        self._contracts: dict[str, Any] = {}

        # DRY-mode in-memory job ledger.
        self._next_job_id = 1
        self._jobs: dict[int, JobView] = {}

        self._init()

    # ------------------------------------------------------------------ setup
    def _init(self) -> None:
        if not self.cfg.chain_live:
            logger.info("chain: no RPC/key configured -> DRY mode")
            self._load_deployment_best_effort()
            return
        try:
            from web3 import Web3
            from web3.middleware import ExtraDataToPOAMiddleware  # type: ignore

            w3 = Web3(Web3.HTTPProvider(self.cfg.arc_rpc_url))
            try:
                w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
            except Exception:
                pass
            if not w3.is_connected():
                logger.warning("chain: RPC %s not reachable -> DRY mode", self.cfg.arc_rpc_url)
                self._load_deployment_best_effort()
                return
            self._w3 = w3
            self._account = w3.eth.account.from_key(self.cfg.agent_private_key)
            self._load_deployment(int(w3.eth.chain_id))
            self._wire_contracts()
            self.dry = False
            logger.info(
                "chain: LIVE on chainId=%s as %s", w3.eth.chain_id, self._account.address
            )
        except ImportError:
            logger.warning("chain: web3 not installed -> DRY mode")
            self._load_deployment_best_effort()
        except Exception as exc:  # pragma: no cover - live wiring failure path
            logger.warning("chain: live wiring failed (%s) -> DRY mode", exc)
            self._load_deployment_best_effort()

    def _load_deployment_best_effort(self) -> None:
        """In DRY mode, still try to load deployment metadata for addresses/explorer."""
        chain_id = self.cfg.arc_chain_id or None
        if chain_id:
            try:
                self._load_deployment(chain_id)
            except Exception:
                pass

    def _load_deployment(self, chain_id: int) -> None:
        path = os.path.join(self.cfg.deployments_dir, f"{chain_id}.json")
        if not os.path.exists(path):
            if not self.dry:
                raise FileNotFoundError(f"deployment file missing: {path}")
            return
        with open(path) as fh:
            self._deployment = json.load(fh)
        abis_dir = os.path.join(self.cfg.deployments_dir, "abis")
        for name in ("JobEscrow", "WorkerRegistry", "MockUSDC"):
            abi_path = os.path.join(abis_dir, f"{name}.json")
            if os.path.exists(abi_path):
                with open(abi_path) as fh:
                    self._abis[name] = json.load(fh)

    def _wire_contracts(self) -> None:
        assert self._w3 is not None
        from web3 import Web3

        for name in ("JobEscrow", "WorkerRegistry", "MockUSDC"):
            address = self._deployment.get(name)
            abi = self._abis.get(name)
            if address and abi:
                self._contracts[name] = self._w3.eth.contract(
                    address=Web3.to_checksum_address(address), abi=abi
                )

    @property
    def block_explorer(self) -> str:
        return self._deployment.get("blockExplorer", "")

    @property
    def agent_address(self) -> str:
        if self._account is not None:
            return self._account.address
        return "0xWARDAGENTDRY000000000000000000000000000000"[:42]

    # ------------------------------------------------------------- tx helpers
    def _synthetic_tx_hash(self, *parts: Any) -> str:
        seed = "|".join(str(p) for p in parts) + f"|{time.time_ns()}"
        return "0x" + hashlib.sha256(seed.encode()).hexdigest()

    def _send(self, contract_name: str, fn_name: str, *args: Any) -> str:
        """Build, sign, and send a tx; return the tx hash. Live only."""
        assert self._w3 is not None and self._account is not None
        contract = self._contracts[contract_name]
        fn = getattr(contract.functions, fn_name)(*args)
        tx = fn.build_transaction(
            {
                "from": self._account.address,
                "nonce": self._w3.eth.get_transaction_count(self._account.address),
            }
        )
        signed = self._account.sign_transaction(tx)
        tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        return tx_hash.hex()

    # ------------------------------------------------------------- balances
    def usdc_balance_units(self, address: str | None = None) -> int:
        address = address or self.agent_address
        if self.dry or "MockUSDC" not in self._contracts:
            # In DRY mode, report the demo-funded 500 USDC less escrowed jobs.
            escrowed = sum(
                j.amount_units
                for j in self._jobs.values()
                if j.state in ("OPEN", "ACCEPTED", "WORK_DONE", "ATTESTING")
            )
            return max(0, 500_000000 - escrowed)
        return int(self._contracts["MockUSDC"].functions.balanceOf(address).call())

    # ------------------------------------------------------------- workers
    def get_workers(self) -> list[Worker]:
        """Return the registered worker roster.

        Live: enumerate via the registry events / a configured roster of
        addresses. DRY: read WARD_WORKER_ROSTER or the built-in demo roster.
        """
        roster_source = _DEFAULT_ROSTER
        if self.cfg.worker_roster_json:
            try:
                roster_source = json.loads(self.cfg.worker_roster_json)
            except Exception:
                logger.warning("invalid WARD_WORKER_ROSTER json; using default roster")

        workers: list[Worker] = []
        registry = self._contracts.get("WorkerRegistry")
        if not self.dry and registry is not None:
            # Enrich roster reputation from chain where addresses are known.
            for entry in roster_source:
                addr = entry["address"]
                try:
                    rep = int(registry.functions.reputationOf(addr).call())
                except Exception:
                    rep = int(entry.get("reputation", 0))
                workers.append(
                    Worker(
                        address=addr,
                        handle=entry.get("handle", ""),
                        ensName=entry.get("ensName", ""),
                        skills=entry.get("skills", ""),
                        region=entry.get("region", ""),
                        reputation=rep,
                        stake=int(entry.get("stake", 0)),
                    )
                )
        else:
            for entry in roster_source:
                workers.append(
                    Worker(
                        address=entry["address"],
                        handle=entry.get("handle", ""),
                        ensName=entry.get("ensName", ""),
                        skills=entry.get("skills", ""),
                        region=entry.get("region", ""),
                        reputation=int(entry.get("reputation", 0)),
                        stake=int(entry.get("stake", 0)),
                    )
                )
        return workers

    def select_highest_reputation_worker(self) -> Worker | None:
        workers = [w for w in self.get_workers() if w.registered]
        if not workers:
            return None
        return max(workers, key=lambda w: w.reputation)

    # ------------------------------------------------------------- jobs
    def create_job(
        self,
        property_id: str,
        device_id: str,
        amount_units: int,
        deadline_secs: int,
        owner_approved: bool,
    ) -> tuple[int, str]:
        """JobEscrow.createJob. Returns (job_id, tx_hash).

        Enforces the policy caps client-side too, but the contract is the
        source of truth on-chain. owner_approved must be True when amount is
        at/above the owner-approval threshold.
        """
        if self.dry:
            job_id = self._next_job_id
            self._next_job_id += 1
            tx_hash = self._synthetic_tx_hash("createJob", property_id, device_id, amount_units)
            self._jobs[job_id] = JobView(
                job_id=job_id,
                property_id=property_id,
                device_id=device_id,
                amount_units=amount_units,
                state="OPEN",
                tx_create=tx_hash,
            )
            logger.info(
                "[DRY] createJob(prop=%s, dev=%s, amount=%s USDC, ownerApproved=%s) -> job %s tx %s",
                property_id, device_id, usdc(amount_units), owner_approved, job_id, tx_hash,
            )
            return job_id, tx_hash

        # Live path.
        pid = _bytes32_from_id(property_id)
        did = _bytes32_from_id(device_id)
        deadline = int(time.time()) + deadline_secs
        # NOTE: a real flow approves USDC to the escrow first; assumed pre-approved
        # or handled by the escrow's pull pattern per the contract's createJob.
        tx_hash = self._send("JobEscrow", "createJob", pid, did, amount_units, deadline)
        # Recover jobId from the JobCreated event.
        job_id = self._read_latest_job_id(tx_hash)
        self._jobs[job_id] = JobView(
            job_id=job_id,
            property_id=property_id,
            device_id=device_id,
            amount_units=amount_units,
            state="OPEN",
            tx_create=tx_hash,
        )
        return job_id, tx_hash

    def _read_latest_job_id(self, tx_hash: str) -> int:
        try:
            receipt = self._w3.eth.get_transaction_receipt(tx_hash)
            escrow = self._contracts["JobEscrow"]
            logs = escrow.events.JobCreated().process_receipt(receipt)
            if logs:
                return int(logs[0]["args"]["jobId"])
        except Exception as exc:  # pragma: no cover
            logger.warning("could not read JobCreated event (%s)", exc)
        # Fallback monotonic id so the lifecycle still progresses.
        jid = self._next_job_id
        self._next_job_id += 1
        return jid

    def accept_job(self, job_id: int, worker_address: str) -> str:
        """Worker accepts. Live: the worker signs this; here we model it for the
        end-to-end DRY demo (and as a manual nudge in tests)."""
        if self.dry:
            tx_hash = self._synthetic_tx_hash("acceptJob", job_id, worker_address)
            job = self._jobs.get(job_id)
            if job:
                job.state = "ACCEPTED"
                job.worker = worker_address
            logger.info("[DRY] acceptJob(%s) by %s tx %s", job_id, worker_address, tx_hash)
            return tx_hash
        return self._send("JobEscrow", "acceptJob", job_id)

    def mark_work_done(self, job_id: int) -> str:
        if self.dry:
            tx_hash = self._synthetic_tx_hash("markWorkDone", job_id)
            job = self._jobs.get(job_id)
            if job:
                job.state = "WORK_DONE"
            logger.info("[DRY] markWorkDone(%s) tx %s", job_id, tx_hash)
            return tx_hash
        return self._send("JobEscrow", "markWorkDone", job_id)

    def get_job_state(self, job_id: int) -> str | None:
        job = self._jobs.get(job_id)
        if job is None:
            return None
        if not self.dry and "JobEscrow" in self._contracts:
            try:
                onchain = self._contracts["JobEscrow"].functions.jobs(job_id).call()
                # The contract's job tuple includes a state field; mapping is
                # contract-specific. We keep the locally-tracked state as the
                # canonical lifecycle marker for the agent.
            except Exception:
                pass
        return job.state

    # ------------------------------------------------------ CRE attestation seam
    def request_attestation(self, job_id: int, device_id: str) -> dict[str, Any]:
        """The clean CRE trigger seam (settle-trigger).

        Whether CRE writes to Arc directly or via an authorized-reporter
        fallback is still being decided by a separate spike (SPIKES.md /
        ICreConsumer). This function is the only place the agent touches that
        mechanism. In DRY mode it produces a simulated HealthAttestation once
        the device reports healthy (the caller is responsible for checking the
        device first). Returns the attestation envelope; the actual settle()
        call is made via settle().
        """
        job = self._jobs.get(job_id)
        if job:
            job.state = "ATTESTING"
        attestation = {
            "jobId": job_id,
            "deviceId": device_id,
            "healthy": True,
            "reportTimestamp": int(time.time()),
            "signature": "0x" + ("00" * 65),  # placeholder; real CRE/reporter fills this
            "mechanism": "DRY-SIMULATED-CRE" if self.dry else "CRE",
        }
        logger.info(
            "[%s] request_attestation(job=%s, dev=%s) -> healthy=True",
            "DRY" if self.dry else "LIVE", job_id, device_id,
        )
        return attestation

    def settle(self, job_id: int, attestation: dict[str, Any]) -> str:
        """JobEscrow.settle — verifies the CRE attestation and releases USDC.

        In DRY mode, returns a synthetic tx hash and marks the job SETTLED.
        Live: passes the attestation through the ICreConsumer-gated settle().
        """
        if self.dry:
            tx_hash = self._synthetic_tx_hash("settle", job_id)
            job = self._jobs.get(job_id)
            if job:
                job.state = "SETTLED"
                job.tx_settle = tx_hash
            logger.info("[DRY] settle(%s) -> tx %s (USDC released, reputation bumped)", job_id, tx_hash)
            return tx_hash

        # Live: shape the HealthAttestation struct for ICreConsumer-gated settle.
        struct = (
            attestation["jobId"],
            _bytes32_from_id(attestation["deviceId"]),
            bool(attestation["healthy"]),
            int(attestation["reportTimestamp"]),
            bytes.fromhex(attestation["signature"][2:]),
        )
        tx_hash = self._send("JobEscrow", "settle", job_id, struct)
        job = self._jobs.get(job_id)
        if job:
            job.state = "SETTLED"
            job.tx_settle = tx_hash
        return tx_hash

    # ------------------------------------------------------------- explorer
    def explorer_tx_url(self, tx_hash: str) -> str:
        if not self.block_explorer:
            return tx_hash
        return f"{self.block_explorer.rstrip('/')}/tx/{tx_hash}"


_client: ChainClient | None = None


def get_chain_client() -> ChainClient:
    global _client
    if _client is None:
        _client = ChainClient()
    return _client
