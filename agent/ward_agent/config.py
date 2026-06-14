"""Central configuration, read entirely from environment with safe defaults.

This is the single env seam for the agent. Conforms to the shared interface
contract's env seams. Nothing here ever raises on missing config; instead it
exposes flags
(`dry_mode`, `llm_enabled`, `supabase_enabled`) the rest of the runtime
consults to degrade gracefully.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    return value.strip()


def _env_int(name: str, default: int) -> int:
    raw = _env(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = _env(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = _env(name)
    if raw is None:
        return default
    return raw.lower() in ("1", "true", "yes", "on")


# USDC has 6 decimals.
USDC_DECIMALS = 6


def usdc(amount_units: int) -> str:
    """Render raw 6-decimal USDC units as a human string, e.g. 75_000000 -> '75'."""
    whole = amount_units // (10**USDC_DECIMALS)
    frac = amount_units % (10**USDC_DECIMALS)
    if frac == 0:
        return str(whole)
    return f"{whole}.{frac:0{USDC_DECIMALS}d}".rstrip("0")


@dataclass
class Config:
    """Runtime configuration resolved from the environment."""

    # --- LLM (diagnosis.py) ---
    anthropic_api_key: str | None = field(default_factory=lambda: _env("ANTHROPIC_API_KEY"))
    # Diagnosis is a small classification task -> default to Haiku (cheapest;
    # ~10-20x cheaper than Opus/Fable) and only call on a NEW fault, not per poll.
    # Override with WARD_LLM_MODEL. Any LLM failure degrades to the rules engine.
    llm_model_primary: str = field(default_factory=lambda: _env("WARD_LLM_MODEL", "claude-haiku-4-5"))
    llm_model_fallback: str = "claude-haiku-4-5"

    # --- Device sim (sim_client.py) ---
    sim_base_url: str = field(
        default_factory=lambda: _env("SIM_BASE_URL", "http://localhost:8090")
    )

    # --- Chain (chain.py) ---
    arc_rpc_url: str | None = field(default_factory=lambda: _env("ARC_RPC_URL"))
    arc_chain_id: int = field(default_factory=lambda: _env_int("ARC_CHAIN_ID", 0))
    agent_private_key: str | None = field(default_factory=lambda: _env("AGENT_PRIVATE_KEY"))
    usdc_address: str | None = field(default_factory=lambda: _env("USDC_ADDRESS"))
    # ERC-8183 evaluator role (the CRE oracle). The evaluator key signs the
    # sensor-settled complete() that releases the budget to the provider. Live
    # complete() needs this key; if missing, the agent logs and skips complete()
    # (the job stays SUBMITTED until the evaluator runs). DRY mode simulates it.
    evaluator_private_key: str | None = field(
        default_factory=lambda: _env("EVALUATOR_PRIVATE_KEY")
    )
    evaluator_address: str | None = field(default_factory=lambda: _env("EVALUATOR_ADDRESS"))
    # Where deployments/<chainId>.json + abis/ live. Default: repo-root /deployments.
    deployments_dir: str = field(
        default_factory=lambda: _env(
            "WARD_DEPLOYMENTS_DIR",
            os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "..", "deployments")
            ),
        )
    )

    # --- Supabase (events.py) ---
    supabase_url: str | None = field(default_factory=lambda: _env("SUPABASE_URL"))
    supabase_anon_key: str | None = field(default_factory=lambda: _env("SUPABASE_ANON_KEY"))

    # --- Server (server.py) ---
    server_host: str = field(default_factory=lambda: _env("WARD_HOST", "0.0.0.0"))
    server_port: int = field(default_factory=lambda: _env_int("WARD_PORT", 8080))

    # --- Policy (spending caps) ---
    # Demo job amount 75 USDC = 75_000000. Owner-approval threshold 100 USDC.
    job_amount_units: int = field(default_factory=lambda: _env_int("WARD_JOB_AMOUNT", 75_000000))
    owner_approval_threshold_units: int = field(
        default_factory=lambda: _env_int("WARD_OWNER_THRESHOLD", 100_000000)
    )
    per_job_cap_units: int = field(default_factory=lambda: _env_int("WARD_PER_JOB_CAP", 100_000000))
    daily_cap_units: int = field(default_factory=lambda: _env_int("WARD_DAILY_CAP", 500_000000))
    job_deadline_secs: int = field(default_factory=lambda: _env_int("WARD_JOB_DEADLINE", 3600))

    # --- Loop timing ---
    poll_interval_secs: float = field(
        default_factory=lambda: _env_float("WARD_POLL_INTERVAL", 5.0)
    )
    # How long to wait for telemetry to recover after the human marks work done,
    # before the CRE attestation is allowed to confirm.
    attestation_poll_secs: float = field(
        default_factory=lambda: _env_float("WARD_ATTEST_POLL", 2.0)
    )
    attestation_timeout_secs: float = field(
        default_factory=lambda: _env_float("WARD_ATTEST_TIMEOUT", 60.0)
    )

    # --- Worker roster (fallback when no on-chain registry) ---
    # JSON list of workers; used when chain is in DRY mode or registry empty.
    worker_roster_json: str | None = field(default_factory=lambda: _env("WARD_WORKER_ROSTER"))

    # --- Worker signing keys (LIVE end-to-end only) ---
    # JSON map { "0xWorkerAddr": "0xprivkey", ... } so the agent can sign the
    # provider-side submit() tx in the local end-to-end run (the field tech's
    # wallet). Unused in DRY mode and in production (real workers sign on their
    # own phones). Keys are read from env; nothing is hardcoded.
    worker_keys_json: str | None = field(default_factory=lambda: _env("WARD_WORKER_KEYS"))

    # --- Autonomous worker completion (demo) ---
    # When True (default for the demo), after DISPATCH the agent autonomously
    # drives the provider side end-to-end (submit -> repair the device) using the
    # dispatched worker's key from WARD_WORKER_KEYS (DRY mode always has the
    # synthetic worker), then the evaluator key completes the job. Set FALSE to
    # hand off to a human "worker submits via UI" path instead.
    auto_complete: bool = field(default_factory=lambda: _env_bool("WARD_AUTO_COMPLETE", True))

    @property
    def llm_enabled(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def chain_live(self) -> bool:
        """Chain runs live only if we have an RPC and the agent (client) key."""
        return bool(self.arc_rpc_url and self.agent_private_key)

    @property
    def evaluator_ready(self) -> bool:
        """True if the evaluator key is configured so the agent can sign the
        ERC-8183 evaluator-only complete() (the sensor-settled release)."""
        return bool(self.evaluator_private_key)

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)


_config: Config | None = None


def get_config() -> Config:
    """Return a process-wide singleton Config (re-read with reload_config())."""
    global _config
    if _config is None:
        _config = Config()
    return _config


def reload_config() -> Config:
    global _config
    _config = Config()
    return _config
