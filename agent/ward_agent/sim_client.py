"""Async HTTP client for the device simulator API.

Conforms to the sim HTTP API in the shared interface contract:

    GET  /fleet                          -> { devices: DeviceStatus[] }
    GET  /device/{id}/status             -> DeviceStatus
    POST /device/{id}/fail?mode=soft|hard
    POST /device/{id}/restart            -> DeviceStatus
    POST /device/{id}/repair             -> DeviceStatus
    POST /reset

DeviceStatus = {
    deviceId, propertyId, kind:"router",
    online, uptimeSec, signalDbm,
    faultMode: "none"|"soft"|"hard", lastChangedIso
}

If the real sim is unreachable, the runtime falls back to FakeSim (see
fake_sim.py) so the loop is fully demoable offline. This module only speaks
to a real (or fake-but-HTTP-shaped) endpoint; the caller decides which.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from .config import get_config


@dataclass(slots=True)
class DeviceStatus:
    deviceId: str
    propertyId: str
    kind: str
    online: bool
    uptimeSec: int
    signalDbm: int
    faultMode: str
    lastChangedIso: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "DeviceStatus":
        return cls(
            deviceId=data["deviceId"],
            propertyId=data["propertyId"],
            kind=data.get("kind", "router"),
            online=bool(data["online"]),
            uptimeSec=int(data.get("uptimeSec", 0)),
            signalDbm=int(data.get("signalDbm", 0)),
            faultMode=data.get("faultMode", "none"),
            lastChangedIso=data.get("lastChangedIso", ""),
        )

    @property
    def healthy(self) -> bool:
        """CRE "fixed" condition: online AND no fault."""
        return self.online and self.faultMode == "none"

    def to_dict(self) -> dict[str, Any]:
        return {
            "deviceId": self.deviceId,
            "propertyId": self.propertyId,
            "kind": self.kind,
            "online": self.online,
            "uptimeSec": self.uptimeSec,
            "signalDbm": self.signalDbm,
            "faultMode": self.faultMode,
            "lastChangedIso": self.lastChangedIso,
        }


class SimClient:
    """Async client over the device simulator HTTP API."""

    def __init__(self, base_url: str | None = None, timeout: float = 8.0) -> None:
        cfg = get_config()
        self.base_url = (base_url or cfg.sim_base_url).rstrip("/")
        self._timeout = timeout

    async def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.base_url, timeout=self._timeout)

    async def reachable(self) -> bool:
        """True iff GET /fleet returns 2xx. Used to decide real-vs-fake sim."""
        try:
            async with await self._client() as client:
                resp = await client.get("/fleet")
                return resp.status_code < 400
        except Exception:
            return False

    async def fleet(self) -> list[DeviceStatus]:
        async with await self._client() as client:
            resp = await client.get("/fleet")
            resp.raise_for_status()
            data = resp.json()
            return [DeviceStatus.from_dict(d) for d in data.get("devices", [])]

    async def status(self, device_id: str) -> DeviceStatus:
        async with await self._client() as client:
            resp = await client.get(f"/device/{device_id}/status")
            resp.raise_for_status()
            return DeviceStatus.from_dict(resp.json())

    async def fail(self, device_id: str, mode: str = "soft") -> DeviceStatus:
        async with await self._client() as client:
            resp = await client.post(f"/device/{device_id}/fail", params={"mode": mode})
            resp.raise_for_status()
            return DeviceStatus.from_dict(resp.json())

    async def restart(self, device_id: str) -> DeviceStatus:
        async with await self._client() as client:
            resp = await client.post(f"/device/{device_id}/restart")
            resp.raise_for_status()
            return DeviceStatus.from_dict(resp.json())

    async def repair(self, device_id: str) -> DeviceStatus:
        async with await self._client() as client:
            resp = await client.post(f"/device/{device_id}/repair")
            resp.raise_for_status()
            return DeviceStatus.from_dict(resp.json())

    async def reset(self) -> None:
        async with await self._client() as client:
            resp = await client.post("/reset")
            resp.raise_for_status()
