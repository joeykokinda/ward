"""Runtime triage of a free-text resident report -> instrumented device.

Single public function: `triage(text) -> Triage`.

The /live page lets a judge describe a problem in their own words instead of
clicking a preset. To keep the on-chain story honest (the sensor genuinely
faults and genuinely heals, the CRE evaluator attests that telemetry), the
typed report must resolve to one of the four instrumented devices. This module
does exactly that mapping, at runtime, with Claude:

  free text -> { deviceId, mode (soft|hard), interpretation, confidence }

If the report matches no instrumented sensor, deviceId is None and the caller
reports that honestly instead of fabricating a job. Uses the same Anthropic
seam as diagnosis.py; falls back to a deterministic keyword map when the LLM is
unavailable so the endpoint never hard-crashes.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any

from .config import get_config

logger = logging.getLogger("ward.triage")

# The four instrumented devices WARD can actually act on and attest. Order and
# ids mirror sim/main.py's seed; propertyId == deviceId for each.
DEVICE_IDS = ("home-wifi", "home-thermostat", "home-lock", "home-leak")
_NONE = "none"


@dataclass(slots=True)
class Triage:
    device_id: str | None  # one of DEVICE_IDS, or None if nothing matches
    mode: str  # "soft" (remote reboot may fix -> L1) | "hard" (physical -> L3)
    interpretation: str  # human-readable, shown in the reasoning feed
    confidence: float
    source: str = "rules"

    def to_dict(self) -> dict[str, Any]:
        return {
            "deviceId": self.device_id,
            "mode": self.mode,
            "interpretation": self.interpretation,
            "confidence": round(self.confidence, 3),
            "source": self.source,
        }


_TRIAGE_SCHEMA = {
    "type": "object",
    "properties": {
        "deviceId": {"type": "string", "enum": [*DEVICE_IDS, _NONE]},
        "mode": {"type": "string", "enum": ["soft", "hard"]},
        "interpretation": {"type": "string"},
        "confidence": {"type": "number"},
    },
    "required": ["deviceId", "mode", "interpretation", "confidence"],
    "additionalProperties": False,
}

_SYSTEM_PROMPT = (
    "You are WARD, an autonomous home-operations agent. A resident has described "
    "a problem in their own words. Map it to exactly ONE of the four instrumented "
    "devices WARD can monitor and repair, and judge how severe it is.\n\n"
    "Devices:\n"
    "- home-wifi (router): internet/wifi down, slow, dropping, no connectivity.\n"
    "- home-thermostat (thermostat): heating/cooling/temperature/HVAC wrong or unresponsive.\n"
    "- home-lock (smart lock): front door won't lock/unlock, lock unresponsive or jammed.\n"
    "- home-leak (leak sensor): water, leak, flooding, dripping, damp, burst pipe.\n\n"
    "Severity:\n"
    "- mode 'soft' = a remote reboot/reconfigure is likely to fix it (free, Level 1). "
    "Use for connectivity glitches, an unresponsive thermostat, a lock that just needs a reset.\n"
    "- mode 'hard' = a physical/hardware fault needing a dispatched human (escrowed, Level 3). "
    "ALWAYS use 'hard' for any water/leak report (a plumber is required) and for clear "
    "physical damage (burst pipe, mechanically jammed lock, dead hardware).\n\n"
    "If the report does not plausibly match ANY of the four devices, set deviceId to "
    "'none'. Do not force an unrelated issue onto a device. Write 'interpretation' as one "
    "short sentence a judge can read, naming the device and what you think is wrong."
)


def _keyword_triage(text: str) -> Triage:
    """Deterministic fallback used when the LLM is unavailable."""
    t = text.lower()

    def has(*words: str) -> bool:
        return any(w in t for w in words)

    if has("leak", "water", "flood", "drip", "damp", "wet", "pipe", "plumb", "moist", "burst"):
        return Triage("home-leak", "hard", "Water/leak reported -> leak sensor; dispatch a plumber.", 0.8, "rules")
    if has("wifi", "wi-fi", "internet", "router", "network", "connection", "offline", "online", "signal", "dropping"):
        return Triage("home-wifi", "soft", "Connectivity issue -> router; try a remote reboot first.", 0.75, "rules")
    if has("lock", "door", "deadbolt", "latch", "unlock", "locked out", "jam"):
        mode = "hard" if has("jam", "stuck", "broke", "won't", "wont", "mechanical") else "soft"
        return Triage("home-lock", mode, "Lock issue -> smart lock.", 0.7, "rules")
    if has("therm", "heat", "cool", "ac", "a/c", "hvac", "temperature", "temp", "cold", "hot", "furnace"):
        return Triage("home-thermostat", "soft", "Climate issue -> thermostat; try a remote reconfigure.", 0.7, "rules")
    return Triage(None, "hard", "No instrumented sensor matches that report.", 0.6, "rules")


def _llm_triage(text: str) -> Triage | None:
    """Attempt an LLM triage; return None on any failure. Never raises."""
    cfg = get_config()
    try:
        import anthropic  # lazy import so the package works without the SDK
    except ImportError:
        logger.warning("anthropic SDK not installed; using keyword triage")
        return None

    client = anthropic.Anthropic(api_key=cfg.anthropic_api_key)

    def _call(model: str):
        return client.messages.create(
            model=model,
            max_tokens=1200,
            system=_SYSTEM_PROMPT,
            thinking={"type": "adaptive"},
            output_config={"format": {"type": "json_schema", "schema": _TRIAGE_SCHEMA}},
            messages=[{"role": "user", "content": f"Resident report:\n{text.strip()[:500]}"}],
        )

    model_used = cfg.llm_model_primary
    try:
        try:
            response = _call(cfg.llm_model_primary)
        except anthropic.NotFoundError:
            model_used = cfg.llm_model_fallback
            logger.info("model %s unavailable; falling back to %s", cfg.llm_model_primary, model_used)
            response = _call(cfg.llm_model_fallback)

        if getattr(response, "stop_reason", None) == "refusal":
            logger.warning("LLM refused triage; using keyword fallback")
            return None

        out = next((b.text for b in response.content if b.type == "text"), None)
        if not out:
            return None
        data = json.loads(out)
        device = str(data["deviceId"])
        device_id = None if device == _NONE else device
        if device_id is not None and device_id not in DEVICE_IDS:
            device_id = None
        mode = data.get("mode", "hard")
        mode = mode if mode in ("soft", "hard") else "hard"
        confidence = max(0.0, min(1.0, float(data.get("confidence", 0.7))))
        return Triage(
            device_id=device_id,
            mode=mode,
            interpretation=str(data["interpretation"]),
            confidence=confidence,
            source=f"llm:{model_used}",
        )
    except Exception as exc:  # pragma: no cover - network / parse failure path
        logger.warning("LLM triage failed (%s); using keyword fallback", exc)
        return None


def triage(text: str) -> Triage:
    """Map a free-text resident report to an instrumented device + severity.

    Tries the Anthropic API when ANTHROPIC_API_KEY is set; otherwise (or on any
    failure) returns a deterministic keyword-based Triage. Never raises.
    """
    cfg = get_config()
    if cfg.llm_enabled:
        result = _llm_triage(text)
        if result is not None:
            return result
    return _keyword_triage(text)
