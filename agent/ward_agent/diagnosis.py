"""LLM-backed fault diagnosis with a deterministic offline fallback.

Single public function: `diagnose(device_status, history) -> Diagnosis`.

Uses the Anthropic API (model from WARD_LLM_MODEL, default `claude-haiku-4-5`;
key from ANTHROPIC_API_KEY). If no key is set, falls back
to a deterministic rules-based diagnosis so the loop runs fully offline
(INTERFACES.md: "if ANTHROPIC_API_KEY is unset, fall back to a deterministic
scripted diagnosis ... Never hard-crash on missing key").

A Diagnosis carries:
  - likely_cause:        human-readable cause string
  - recommended_level:   1 (remote fix) or 3 (dispatch a human)
  - confidence:          0.0 - 1.0
  - rationale:           sentence used in the DIAGNOSE reasoning-stream event
  - source:              "llm" | "rules" (provenance, for the feed)
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any

from .config import get_config
from .sim_client import DeviceStatus

logger = logging.getLogger("ward.diagnosis")


@dataclass(slots=True)
class Diagnosis:
    likely_cause: str
    recommended_level: int  # 1 = remote fix, 3 = dispatch human
    confidence: float
    rationale: str
    source: str = "rules"

    def to_dict(self) -> dict[str, Any]:
        return {
            "likely_cause": self.likely_cause,
            "recommended_level": self.recommended_level,
            "confidence": round(self.confidence, 3),
            "rationale": self.rationale,
            "source": self.source,
        }


# JSON schema for structured output (Fable 5 / Opus 4.8 support this).
_DIAGNOSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "likely_cause": {"type": "string"},
        "recommended_level": {"type": "integer", "enum": [1, 3]},
        "confidence": {"type": "number"},
        "rationale": {"type": "string"},
    },
    "required": ["likely_cause", "recommended_level", "confidence", "rationale"],
    "additionalProperties": False,
}

_SYSTEM_PROMPT = (
    "You are WARD, an autonomous property-operations agent monitoring "
    "instrumented devices (routers) at short-term rental properties. A device "
    "has reported a fault. Decide the cheapest fix that will work.\n\n"
    "Escalation ladder:\n"
    "- Level 1 (remote self-fix, free, autonomous): a remote reboot/reconfig "
    "is likely to resolve the issue. Most incidents end here.\n"
    "- Level 3 (dispatch a human, escrowed, proof-settled): a confirmed "
    "hardware fault that a remote reboot cannot fix.\n\n"
    "A device that just went offline with no prior failed reboot should "
    "normally be tried at Level 1 first. Only recommend Level 3 when the "
    "evidence (e.g. a prior failed restart, or a persistent hard fault) shows "
    "remote action will not work. Be decisive and concise."
)


def _rules_diagnosis(device: DeviceStatus, history: list[dict[str, Any]]) -> Diagnosis:
    """Deterministic fallback used when the LLM is unavailable.

    Mirrors the escalation logic: a fresh fault is a Level-1 candidate; a
    fault that survived a remote restart (faultMode 'hard', or history shows a
    failed restart) is a confirmed hardware fault -> Level 3.
    """
    restart_failed = any(
        h.get("type") == "ACTION" and "restart" in str(h.get("message", "")).lower()
        for h in history
    ) and not device.healthy

    if device.healthy:
        return Diagnosis(
            likely_cause="No active fault detected.",
            recommended_level=1,
            confidence=0.99,
            rationale=f"{device.deviceId} reports online with faultMode=none; no action required.",
            source="rules",
        )

    # A remote restart has already been attempted and the device is still down:
    # the fault is not remotely recoverable -> confirmed hardware fault (L3).
    if restart_failed:
        return Diagnosis(
            likely_cause="Confirmed hardware fault (router did not recover on remote reboot).",
            recommended_level=3,
            confidence=0.92,
            rationale=(
                f"{device.deviceId} stayed offline after a remote restart. A remote fix "
                "cannot clear this fault; a field technician is required."
            ),
            source="rules",
        )

    # First sighting of an offline device: attempt the free Level-1 remote
    # reboot before spending money. Most incidents end here (PROJECT.md). If
    # the reboot fails, the re-diagnosis above escalates to Level 3.
    return Diagnosis(
        likely_cause="Device offline; attempting remote reboot before escalating.",
        recommended_level=1,
        confidence=0.7,
        rationale=(
            f"{device.deviceId} went offline (faultMode={device.faultMode}). Trying a "
            "free Level-1 remote reboot first; will escalate to dispatch if it fails."
        ),
        source="rules",
    )


def _build_user_prompt(device: DeviceStatus, history: list[dict[str, Any]]) -> str:
    trimmed_history = history[-12:]
    return (
        "Device status (JSON):\n"
        f"{json.dumps(device.to_dict(), indent=2)}\n\n"
        "Recent reasoning history for this incident (JSON, oldest first):\n"
        f"{json.dumps(trimmed_history, indent=2)}\n\n"
        "Diagnose the fault and recommend a level."
    )


def _llm_diagnosis(device: DeviceStatus, history: list[dict[str, Any]]) -> Diagnosis | None:
    """Attempt an LLM diagnosis; return None on any failure so the caller can
    fall back to the rules engine. Never raises."""
    cfg = get_config()
    try:
        import anthropic  # imported lazily so the package works without the SDK
    except ImportError:
        logger.warning("anthropic SDK not installed; using rules-based diagnosis")
        return None

    client = anthropic.Anthropic(api_key=cfg.anthropic_api_key)

    def _call(model: str):
        # Fable 5 / Opus 4.8: adaptive thinking only, no temperature/budget_tokens,
        # structured output via output_config.format.
        return client.messages.create(
            model=model,
            max_tokens=2000,
            system=_SYSTEM_PROMPT,
            thinking={"type": "adaptive"},
            output_config={"format": {"type": "json_schema", "schema": _DIAGNOSIS_SCHEMA}},
            messages=[{"role": "user", "content": _build_user_prompt(device, history)}],
        )

    model_used = cfg.llm_model_primary
    try:
        try:
            response = _call(cfg.llm_model_primary)
        except anthropic.NotFoundError:
            # claude-fable-5 not available on this key -> fall back to opus-4-8.
            model_used = cfg.llm_model_fallback
            logger.info("model %s unavailable; falling back to %s", cfg.llm_model_primary, model_used)
            response = _call(cfg.llm_model_fallback)

        # Safety classifiers may decline (HTTP 200, stop_reason refusal).
        if getattr(response, "stop_reason", None) == "refusal":
            logger.warning("LLM refused diagnosis request; using rules fallback")
            return None

        text = next((b.text for b in response.content if b.type == "text"), None)
        if not text:
            return None
        data = json.loads(text)
        level = int(data["recommended_level"])
        if level not in (1, 3):
            level = 1 if level < 2 else 3
        confidence = float(data.get("confidence", 0.7))
        confidence = max(0.0, min(1.0, confidence))
        return Diagnosis(
            likely_cause=str(data["likely_cause"]),
            recommended_level=level,
            confidence=confidence,
            rationale=str(data["rationale"]),
            source=f"llm:{model_used}",
        )
    except Exception as exc:  # pragma: no cover - network / parse failure path
        logger.warning("LLM diagnosis failed (%s); using rules fallback", exc)
        return None


def diagnose(device_status: DeviceStatus, history: list[dict[str, Any]] | None = None) -> Diagnosis:
    """Diagnose a device fault.

    Tries the Anthropic API when ANTHROPIC_API_KEY is set; otherwise (or on any
    failure) returns a deterministic rules-based Diagnosis so the loop runs
    offline. Never raises on missing config.
    """
    history = history or []
    cfg = get_config()

    if cfg.llm_enabled:
        result = _llm_diagnosis(device_status, history)
        if result is not None:
            return result
    # Fallback path: no key, no SDK, or any LLM failure.
    return _rules_diagnosis(device_status, history)
