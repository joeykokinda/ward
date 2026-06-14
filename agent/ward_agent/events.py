"""The decision feed.

Emits reasoning events conforming to the shared log types:
    MONITOR | DIAGNOSE | ACTION | RESULT | ESCROW | DISPATCH | RESOLVED

Event shape:
    { ts: iso, type: LogType, message: string,
      jobId?: number, txHash?: string, propertyId?: string }

Events are buffered in memory (so /events/recent and the SSE stream work with
no external dependencies) and, if Supabase is configured, mirrored into the
`agent_events` table. Never hard-crashes on a missing or failing Supabase.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import AsyncIterator, Literal

import httpx

from .config import get_config

logger = logging.getLogger("ward.events")

LogType = Literal[
    "MONITOR",
    "DIAGNOSE",
    "ACTION",
    "RESULT",
    "ESCROW",
    "DISPATCH",
    "RESOLVED",
]

VALID_TYPES: set[str] = {
    "MONITOR",
    "DIAGNOSE",
    "ACTION",
    "RESULT",
    "ESCROW",
    "DISPATCH",
    "RESOLVED",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class Event:
    """A single reasoning-stream event."""

    type: LogType
    message: str
    ts: str = field(default_factory=_now_iso)
    jobId: int | None = None
    txHash: str | None = None
    propertyId: str | None = None

    def to_dict(self) -> dict:
        out: dict = {"ts": self.ts, "type": self.type, "message": self.message}
        # Optional fields are only included when set, matching the interface
        # contract's `?` optionality.
        if self.jobId is not None:
            out["jobId"] = self.jobId
        if self.txHash is not None:
            out["txHash"] = self.txHash
        if self.propertyId is not None:
            out["propertyId"] = self.propertyId
        return out


class EventBus:
    """In-memory event buffer + fan-out to live SSE subscribers + Supabase mirror."""

    def __init__(self, buffer_size: int = 500) -> None:
        self._buffer: deque[Event] = deque(maxlen=buffer_size)
        self._subscribers: set[asyncio.Queue[Event]] = set()
        self._lock = asyncio.Lock()
        self._config = get_config()
        self._supabase_warned = False

    async def emit(
        self,
        type: LogType,
        message: str,
        *,
        jobId: int | None = None,
        txHash: str | None = None,
        propertyId: str | None = None,
    ) -> Event:
        if type not in VALID_TYPES:
            raise ValueError(f"invalid event type: {type!r}")
        event = Event(
            type=type,
            message=message,
            jobId=jobId,
            txHash=txHash,
            propertyId=propertyId,
        )
        self._buffer.append(event)

        # Console mirror so the loop is observable without the SSE server.
        logger.info("[%s] %s", event.type, event.message)

        # Fan out to any connected SSE clients. Drop on full queues rather than
        # blocking the loop.
        async with self._lock:
            dead: list[asyncio.Queue[Event]] = []
            for queue in self._subscribers:
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    dead.append(queue)
            for queue in dead:
                self._subscribers.discard(queue)

        # Best-effort Supabase mirror (fire-and-forget, never blocks the loop).
        if self._config.supabase_enabled:
            asyncio.create_task(self._mirror_to_supabase(event))

        return event

    def recent(self, limit: int = 100) -> list[dict]:
        items = list(self._buffer)[-limit:]
        return [e.to_dict() for e in items]

    async def subscribe(self) -> AsyncIterator[Event]:
        """Yield events as they arrive. Used by the SSE endpoint."""
        queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=256)
        async with self._lock:
            self._subscribers.add(queue)
        try:
            while True:
                event = await queue.get()
                yield event
        finally:
            async with self._lock:
                self._subscribers.discard(queue)

    async def _mirror_to_supabase(self, event: Event) -> None:
        cfg = self._config
        url = f"{cfg.supabase_url}/rest/v1/agent_events"
        headers = {
            "apikey": cfg.supabase_anon_key or "",
            "Authorization": f"Bearer {cfg.supabase_anon_key or ''}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
        # Map camelCase event keys to the snake_case column names used by db/.
        payload = {
            "ts": event.ts,
            "type": event.type,
            "message": event.message,
            "job_id": event.jobId,
            "tx_hash": event.txHash,
            "property_id": event.propertyId,
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(url, headers=headers, content=json.dumps(payload))
                if resp.status_code >= 400 and not self._supabase_warned:
                    self._supabase_warned = True
                    logger.warning(
                        "supabase insert failed (%s): %s — continuing in-memory only",
                        resp.status_code,
                        resp.text[:200],
                    )
        except Exception as exc:  # pragma: no cover - network failure path
            if not self._supabase_warned:
                self._supabase_warned = True
                logger.warning(
                    "supabase mirror unavailable (%s) — continuing in-memory only", exc
                )


_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    global _bus
    if _bus is None:
        _bus = EventBus()
    return _bus
