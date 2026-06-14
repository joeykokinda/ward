"""web3.py wrapper for the WARD on-chain rails (ERC-8183 / WardEscrow), with a
DRY fallback.

Reads contract addresses + ABIs from /deployments/<chainId>.json and
/deployments/abis/. The escrow is now ERC-8183 (the deployment's `JobEscrow`
key points at the WardEscrow contract). Exposes the lifecycle the agent drives:

  - create_job(...)  -> WardEscrow.createJob(provider, evaluator, expiredAt,
                        description, hook)        signed by AGENT (client)
  - set_budget(...)  -> WardEscrow.setBudget(jobId, amount, "")  signed by AGENT
  - fund(...)        -> WardEscrow.fund(jobId, optParams)        signed by AGENT
  - submit(...)      -> WardEscrow.submit(jobId, deliverable, "") signed by WORKER
  - complete(...)    -> WardEscrow.complete(jobId, reason, "")    signed by the
                        EVALUATOR key — the sensor-settled release (evaluator
                        only): transfers the budget to the provider + bumps
                        reputation. Called after telemetry is healthy again,
                        representing the CRE attestation.
  - claim_refund(...)-> WardEscrow.claimRefund(jobId)            (expiry path)
  - jobStatus / getJob reads, balances, worker reads.

Roles: client = the agent (AGENT_PRIVATE_KEY); provider = the dispatched worker
(WARD_WORKER_KEYS); evaluator = the CRE oracle (EVALUATOR_PRIVATE_KEY /
EVALUATOR_ADDRESS).

If no RPC / agent key is configured (or web3 / deployments are missing), the
wrapper runs in DRY mode: it logs the txs it WOULD send, returns synthetic tx
hashes, and simulates the ERC-8183 lifecycle in memory so the loop is demoable
offline. Never hard-crashes on missing config.

The evaluator-signed complete() is the seam representing the CRE attestation:
the agent repairs the sim device, confirms /status healthy, then the evaluator
key completes the job. If the evaluator key is missing in live mode, complete()
is skipped (logged) and the job stays SUBMITTED.
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
    # ERC-8183 lifecycle: OPEN | FUNDED | SUBMITTED | COMPLETED | REJECTED |
    # EXPIRED | REFUNDED.
    state: str
    provider: str | None = None
    evaluator: str | None = None
    description: str | None = None
    tx_create: str | None = None
    tx_complete: str | None = None


# Default worker roster used when no registry is on-chain / in DRY mode.
# Mirrors the demo spec (5 workers, reputation, ENS subnames).
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
        # Worker address -> web3 account, for signing the field-tech's on-chain
        # submit() in the local end-to-end run (WARD_WORKER_KEYS).
        self._worker_accounts: dict[str, Any] = {}
        # The ERC-8183 evaluator account (the CRE oracle) that signs complete().
        self._evaluator_account: Any | None = None

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
            self._load_worker_keys(w3)
            self._load_evaluator_key(w3)
            self._load_deployment(int(w3.eth.chain_id))
            self._wire_contracts()
            self.dry = False
            logger.info(
                "chain: LIVE on chainId=%s as %s (evaluator %s)",
                w3.eth.chain_id,
                self._account.address,
                self._evaluator_account.address if self._evaluator_account else "MISSING",
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

    def _load_worker_keys(self, w3: Any) -> None:
        """Load WARD_WORKER_KEYS (address -> privkey) so the agent can sign the
        provider-side submit() in the local end-to-end run."""
        if not self.cfg.worker_keys_json:
            return
        try:
            mapping = json.loads(self.cfg.worker_keys_json)
        except Exception:
            logger.warning("invalid WARD_WORKER_KEYS json; worker signing disabled")
            return
        from web3 import Web3

        for addr, key in mapping.items():
            try:
                acct = w3.eth.account.from_key(key)
                self._worker_accounts[Web3.to_checksum_address(addr)] = acct
            except Exception:
                logger.warning("WARD_WORKER_KEYS: bad key for %s; skipping", addr)

    def _load_evaluator_key(self, w3: Any) -> None:
        """Load EVALUATOR_PRIVATE_KEY so the agent can sign the ERC-8183
        evaluator-only complete() (the sensor-settled release). Optional: if
        unset, complete() degrades to a logged skip in live mode."""
        if not self.cfg.evaluator_private_key:
            logger.warning(
                "chain: EVALUATOR_PRIVATE_KEY unset; live complete() will be "
                "skipped (job stays SUBMITTED until the evaluator runs)"
            )
            return
        try:
            self._evaluator_account = w3.eth.account.from_key(
                self.cfg.evaluator_private_key
            )
        except Exception:
            logger.warning("EVALUATOR_PRIVATE_KEY invalid; evaluator signing disabled")
            self._evaluator_account = None

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

    def _send_as(self, account: Any, contract_name: str, fn_name: str, *args: Any) -> str:
        """Build, sign, and send a tx from an arbitrary account (e.g. a worker
        wallet for submit(), or the evaluator wallet for complete()). Live only."""
        assert self._w3 is not None
        contract = self._contracts[contract_name]
        fn = getattr(contract.functions, fn_name)(*args)
        tx = fn.build_transaction(
            {
                "from": account.address,
                "nonce": self._w3.eth.get_transaction_count(account.address),
            }
        )
        signed = account.sign_transaction(tx)
        tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        return tx_hash.hex()

    # ------------------------------------------------------------- balances
    def usdc_balance_units(self, address: str | None = None) -> int:
        address = address or self.agent_address
        if self.dry or "MockUSDC" not in self._contracts:
            # In DRY mode, report the demo-funded 500 USDC less funded-but-unreleased
            # jobs. USDC is only pulled into escrow at fund(), so OPEN doesn't count.
            escrowed = sum(
                j.amount_units
                for j in self._jobs.values()
                if j.state in ("FUNDED", "SUBMITTED")
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

    # ------------------------------------------------------------- jobs (ERC-8183)
    def create_job(
        self,
        property_id: str,
        device_id: str,
        amount_units: int,
        deadline_secs: int,
        owner_approved: bool,
        provider_address: str,
        description: str,
    ) -> tuple[int, str]:
        """WardEscrow.createJob(provider, evaluator, expiredAt, description,
        hook), signed by the AGENT (client). Returns (job_id, tx_hash).

        provider = the dispatched worker; evaluator = the configured CRE oracle
        (EVALUATOR_ADDRESS); hook = address(0); expiredAt = now + deadline_secs;
        description = homeowner-voiced summary. owner_approved is recorded on the
        local JobView only (the contract gates funding above its threshold via
        setOwnerApproved; below threshold no approval is needed).
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
                provider=provider_address,
                evaluator=self.cfg.evaluator_address,
                description=description,
                tx_create=tx_hash,
            )
            logger.info(
                "[DRY] createJob(provider=%s, evaluator=%s, amount=%s USDC, desc=%r) "
                "-> job %s tx %s",
                provider_address, self.cfg.evaluator_address, usdc(amount_units),
                description, job_id, tx_hash,
            )
            return job_id, tx_hash

        # Live path. createJob takes provider, evaluator, expiredAt, description, hook.
        from web3 import Web3

        provider = Web3.to_checksum_address(provider_address)
        evaluator = Web3.to_checksum_address(
            self.cfg.evaluator_address or self._evaluator_account.address
        )
        hook = "0x" + "00" * 20  # address(0)
        expired_at = int(time.time()) + deadline_secs
        tx_hash = self._send(
            "JobEscrow", "createJob", provider, evaluator, expired_at, description, hook
        )
        job_id = self._read_latest_job_id(tx_hash)
        self._jobs[job_id] = JobView(
            job_id=job_id,
            property_id=property_id,
            device_id=device_id,
            amount_units=amount_units,
            state="OPEN",
            provider=provider,
            evaluator=evaluator,
            description=description,
            tx_create=tx_hash,
        )
        return job_id, tx_hash

    def set_budget(self, job_id: int, amount_units: int) -> str:
        """WardEscrow.setBudget(jobId, amount, b""), signed by the AGENT."""
        if self.dry:
            tx_hash = self._synthetic_tx_hash("setBudget", job_id, amount_units)
            logger.info("[DRY] setBudget(%s, %s USDC) tx %s", job_id, usdc(amount_units), tx_hash)
            return tx_hash
        return self._send("JobEscrow", "setBudget", job_id, amount_units, b"")

    def fund(self, job_id: int, amount_units: int) -> str:
        """WardEscrow.fund(jobId, optParams), signed by the AGENT — pulls USDC
        into escrow (allowance must already be set; ensured here for live).

        optParams = b"" below the contract's owner-approval threshold; for the
        demo amount (1 USDC < 100 USDC) that's always the case. If a future
        amount exceeds the threshold, encode the approval flag as
        eth_abi.encode(['bool'], [True]).
        """
        if self.dry:
            tx_hash = self._synthetic_tx_hash("fund", job_id)
            job = self._jobs.get(job_id)
            if job:
                job.state = "FUNDED"
            logger.info("[DRY] fund(%s) -> tx %s (USDC pulled into escrow)", job_id, tx_hash)
            return tx_hash

        self._ensure_escrow_allowance(amount_units)
        opt_params = self._fund_opt_params(amount_units)
        tx_hash = self._send("JobEscrow", "fund", job_id, opt_params)
        job = self._jobs.get(job_id)
        if job:
            job.state = "FUNDED"
        return tx_hash

    def _fund_opt_params(self, amount_units: int) -> bytes:
        """b"" when below the owner-approval threshold; the abi-encoded approval
        flag when at/above it (the contract requires owner approval there)."""
        if amount_units < self.cfg.owner_approval_threshold_units:
            return b""
        try:
            from eth_abi import encode

            return encode(["bool"], [True])
        except Exception as exc:  # pragma: no cover - eth_abi always present with web3
            logger.warning("could not abi-encode fund optParams (%s); sending empty", exc)
            return b""

    def submit(self, job_id: int, device_id: str) -> str:
        """WardEscrow.submit(jobId, deliverable, b""), signed by the WORKER
        (provider). deliverable = right-padded bytes32 of the device id."""
        deliverable = _bytes32_from_id(device_id)
        if self.dry:
            tx_hash = self._synthetic_tx_hash("submit", job_id, device_id)
            job = self._jobs.get(job_id)
            if job:
                job.state = "SUBMITTED"
            logger.info("[DRY] submit(%s, deliverable=%s) tx %s", job_id, device_id, tx_hash)
            return tx_hash
        job = self._jobs.get(job_id)
        provider = job.provider if job else None
        acct = self._worker_account_for(provider)
        tx_hash = self._send_as(acct, "JobEscrow", "submit", job_id, deliverable, b"")
        if job:
            job.state = "SUBMITTED"
        return tx_hash

    def complete(self, job_id: int, reason: str = "healthy") -> str:
        """WardEscrow.complete(jobId, reason, b""), signed by the EVALUATOR key.

        This is the sensor-settled release (evaluator-only): it transfers the
        budget to the provider and bumps reputation, representing the CRE
        attestation that telemetry is healthy again. Caller must confirm the
        device is healthy first. In live mode, requires the evaluator key.
        """
        reason_b32 = _bytes32_from_id(reason)
        if self.dry:
            tx_hash = self._synthetic_tx_hash("complete", job_id, reason)
            job = self._jobs.get(job_id)
            if job:
                job.state = "COMPLETED"
                job.tx_complete = tx_hash
            logger.info(
                "[DRY] complete(%s, reason=%r) -> tx %s (evaluator-signed; budget "
                "released to provider, reputation bumped)",
                job_id, reason, tx_hash,
            )
            return tx_hash

        if self._evaluator_account is None:
            raise RuntimeError(
                "no evaluator signing key for complete() (set EVALUATOR_PRIVATE_KEY)"
            )
        tx_hash = self._send_as(
            self._evaluator_account, "JobEscrow", "complete", job_id, reason_b32, b""
        )
        job = self._jobs.get(job_id)
        if job:
            job.state = "COMPLETED"
            job.tx_complete = tx_hash
        return tx_hash

    def claim_refund(self, job_id: int) -> str:
        """WardEscrow.claimRefund(jobId), signed by the AGENT (client) — the
        expiry path; returns the budget once the job is past expiredAt."""
        if self.dry:
            tx_hash = self._synthetic_tx_hash("claimRefund", job_id)
            job = self._jobs.get(job_id)
            if job:
                job.state = "REFUNDED"
            logger.info("[DRY] claimRefund(%s) -> tx %s", job_id, tx_hash)
            return tx_hash
        tx_hash = self._send("JobEscrow", "claimRefund", job_id)
        job = self._jobs.get(job_id)
        if job:
            job.state = "REFUNDED"
        return tx_hash

    @property
    def evaluator_ready(self) -> bool:
        """True if complete() can be signed: DRY mode always, else the evaluator
        key must be loaded."""
        return self.dry or self._evaluator_account is not None

    @property
    def evaluator_label(self) -> str:
        """A short label for the configured evaluator address (for event text)."""
        addr = self.cfg.evaluator_address
        if self._evaluator_account is not None:
            addr = self._evaluator_account.address
        if not addr:
            return "DRY-SIMULATED-CRE"
        return f"{addr[:6]}…{addr[-4:]}"

    # A large one-time approval so repeated fund() calls don't each need an
    # approve tx. 2^256 - 1 (max uint256), the standard "infinite approval".
    _MAX_UINT256 = (1 << 256) - 1

    def _ensure_escrow_allowance(self, amount_units: int) -> None:
        """Approve the escrow to pull USDC from the agent if the current allowance
        is below the job amount. Sends a large (max) approve once so subsequent
        jobs reuse the same allowance. Live only; no-op if contracts missing."""
        from web3 import Web3

        usdc_c = self._contracts.get("MockUSDC")
        escrow = self._deployment.get("JobEscrow")
        if usdc_c is None or not escrow:
            return
        spender = Web3.to_checksum_address(escrow)
        try:
            allowance = int(
                usdc_c.functions.allowance(self._account.address, spender).call()
            )
        except Exception as exc:  # pragma: no cover - read failure
            logger.warning("could not read USDC allowance (%s); attempting approve", exc)
            allowance = 0
        if allowance >= amount_units:
            return
        logger.info(
            "USDC allowance %s < job amount %s; approving escrow for max",
            allowance, amount_units,
        )
        self._send("MockUSDC", "approve", spender, self._MAX_UINT256)

    def _read_latest_job_id(self, tx_hash: str) -> int:
        try:
            receipt = self._w3.eth.get_transaction_receipt(tx_hash)
            escrow = self._contracts["JobEscrow"]
            logs = escrow.events.JobCreated().process_receipt(receipt)
            if logs:
                # jobId is the indexed topic1 of JobCreated.
                return int(logs[0]["args"]["jobId"])
        except Exception as exc:  # pragma: no cover
            logger.warning("could not read JobCreated event (%s)", exc)
        # Fallback monotonic id so the lifecycle still progresses.
        jid = self._next_job_id
        self._next_job_id += 1
        return jid

    def has_worker_key(self, worker_address: str | None) -> bool:
        """True if the agent holds the signing key for this worker (so it can
        autonomously drive the worker-side submit()). In DRY mode the worker
        side is simulated in-memory, so always True."""
        if self.dry:
            return True
        if not worker_address:
            return False
        try:
            from web3 import Web3

            return Web3.to_checksum_address(worker_address) in self._worker_accounts
        except Exception:
            return False

    def _worker_account_for(self, worker_address: str | None) -> Any:
        """Resolve the signing account for a worker address (WARD_WORKER_KEYS).
        Raises if no key is configured, so the live run fails loudly rather than
        silently sending from the wrong account."""
        from web3 import Web3

        if not worker_address:
            raise RuntimeError("no worker address to sign provider-side tx")
        acct = self._worker_accounts.get(Web3.to_checksum_address(worker_address))
        if acct is None:
            raise RuntimeError(
                f"no worker signing key for {worker_address} (set WARD_WORKER_KEYS)"
            )
        return acct

    # WardEscrow JobStatus enum -> agent lifecycle string.
    _ONCHAIN_STATE = {
        0: "OPEN",       # Open
        1: "FUNDED",     # Funded
        2: "SUBMITTED",  # Submitted
        3: "COMPLETED",  # Completed
        4: "REJECTED",   # Rejected
        5: "EXPIRED",    # Expired
    }

    def get_job_state(self, job_id: int) -> str | None:
        job = self._jobs.get(job_id)
        if not self.dry and "JobEscrow" in self._contracts:
            # On-chain status is the source of truth in live mode so the agent
            # observes the worker's submit() and the evaluator's complete().
            try:
                code = int(self._contracts["JobEscrow"].functions.jobStatus(job_id).call())
                onchain = self._ONCHAIN_STATE.get(code)
                if onchain is not None:
                    if job is not None:
                        job.state = onchain
                    return onchain
            except Exception as exc:  # pragma: no cover
                logger.warning("could not read on-chain jobStatus(%s): %s", job_id, exc)
        if job is None:
            return None
        return job.state

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
