"""In-process device simulator.

A drop-in replacement for SimClient when the real sim (sim/) isn't running,
so the whole loop is demoable with zero external processes. Implements the
same async method surface as SimClient and the same DeviceStatus semantics
from INTERFACES.md:

  - fail(mode="soft"): heals on restart
  - fail(mode="hard"): does NOT heal on restart (needs repair())
  - restart(): heals iff fault was soft
  - repair(): clears any fault (the human fix)
  - reset(): all devices healthy

Pre-staged demo fleet matches INTERFACES.md (prop-1/2/3 routers).
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from .sim_client import DeviceStatus


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# Pre-staged demo fleet (INTERFACES.md properties table).
_DEFAULT_FLEET = [
    ("prop-1", "prop-1-router", "The Brooklyn Loft"),
    ("prop-2", "prop-2-router", "Greenwich Cottage"),
    ("prop-3", "prop-3-router", "Hudson Studio"),
]


class FakeSim:
    """In-memory device fleet with the SimClient method surface."""

    def __init__(self) -> None:
        self.base_url = "memory://fake-sim"
        self._lock = asyncio.Lock()
        self._devices: dict[str, DeviceStatus] = {}
        self._reset_unlocked()

    def _reset_unlocked(self) -> None:
        self._devices = {}
        for property_id, device_id, _name in _DEFAULT_FLEET:
            self._devices[device_id] = DeviceStatus(
                deviceId=device_id,
                propertyId=property_id,
                kind="router",
                online=True,
                uptimeSec=86_400,
                signalDbm=-55,
                faultMode="none",
                lastChangedIso=_now_iso(),
            )

    async def reachable(self) -> bool:
        return True

    async def fleet(self) -> list[DeviceStatus]:
        async with self._lock:
            return [self._clone(d) for d in self._devices.values()]

    async def status(self, device_id: str) -> DeviceStatus:
        async with self._lock:
            return self._clone(self._require(device_id))

    async def fail(self, device_id: str, mode: str = "soft") -> DeviceStatus:
        if mode not in ("soft", "hard"):
            mode = "soft"
        async with self._lock:
            device = self._require(device_id)
            device.online = False
            device.faultMode = mode
            device.signalDbm = -99
            device.uptimeSec = 0
            device.lastChangedIso = _now_iso()
            return self._clone(device)

    async def restart(self, device_id: str) -> DeviceStatus:
        async with self._lock:
            device = self._require(device_id)
            # Restart heals soft faults only; hard faults persist.
            if device.faultMode == "soft":
                device.online = True
                device.faultMode = "none"
                device.signalDbm = -57
                device.uptimeSec = 30
                device.lastChangedIso = _now_iso()
            return self._clone(device)

    async def repair(self, device_id: str) -> DeviceStatus:
        async with self._lock:
            device = self._require(device_id)
            # The human fix: clears any fault.
            device.online = True
            device.faultMode = "none"
            device.signalDbm = -54
            device.uptimeSec = 60
            device.lastChangedIso = _now_iso()
            return self._clone(device)

    async def reset(self) -> None:
        async with self._lock:
            self._reset_unlocked()

    def _require(self, device_id: str) -> DeviceStatus:
        if device_id not in self._devices:
            raise KeyError(f"unknown device: {device_id}")
        return self._devices[device_id]

    @staticmethod
    def _clone(device: DeviceStatus) -> DeviceStatus:
        return DeviceStatus(**device.to_dict())
