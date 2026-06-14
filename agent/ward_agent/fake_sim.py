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

Pre-staged demo fleet mirrors the standalone sim (sim/main.py): one home, four
instrumented devices (home-wifi/thermostat/lock/leak). The leak sensor is
physical-only: its faults are always hard and never heal on a remote restart,
so the in-process fallback reproduces the L1->L3 escalation exactly.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from .sim_client import DeviceStatus


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# Pre-staged demo fleet — one home, four instrumented devices. Mirrors the
# standalone sim (sim/main.py) so the in-process fallback is the same fleet the
# frontend, agent loop, and CRE workflow expect (propertyId == deviceId so the
# one-open-job-per-property guard works per device).
# (device_id, property_id, kind, seed_signal_dbm)
_DEFAULT_FLEET = [
    ("home-wifi", "home-wifi", "router", -52),
    ("home-thermostat", "home-thermostat", "thermostat", -58),
    ("home-lock", "home-lock", "lock", -61),
    ("home-leak", "home-leak", "leak_sensor", 0),
]

# Healthy signal per device, restored when a fault clears.
_SEED_SIGNAL = {device_id: signal for device_id, _prop, _kind, signal in _DEFAULT_FLEET}


class FakeSim:
    """In-memory device fleet with the SimClient method surface."""

    def __init__(self) -> None:
        self.base_url = "memory://fake-sim"
        self._lock = asyncio.Lock()
        self._devices: dict[str, DeviceStatus] = {}
        self._reset_unlocked()

    def _reset_unlocked(self) -> None:
        self._devices = {}
        for device_id, property_id, kind, signal_dbm in _DEFAULT_FLEET:
            self._devices[device_id] = DeviceStatus(
                deviceId=device_id,
                propertyId=property_id,
                kind=kind,
                online=True,
                uptimeSec=86_400,
                signalDbm=signal_dbm,
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
            # A leak is physical: any fault on the leak sensor needs a human,
            # so it is always recorded as a hard fault (mirrors sim/main.py).
            if device.kind == "leak_sensor":
                mode = "hard"
            device.online = False
            device.faultMode = mode
            device.signalDbm = 0
            device.uptimeSec = 0
            device.lastChangedIso = _now_iso()
            return self._clone(device)

    async def restart(self, device_id: str) -> DeviceStatus:
        async with self._lock:
            device = self._require(device_id)
            # Restart heals soft faults only — never the leak sensor, whose
            # faults are always physical and persist until a human repair.
            if device.faultMode == "soft" and device.kind != "leak_sensor":
                device.online = True
                device.faultMode = "none"
                device.signalDbm = _SEED_SIGNAL.get(device_id, -57)
                device.uptimeSec = 30
                device.lastChangedIso = _now_iso()
            return self._clone(device)

    async def repair(self, device_id: str) -> DeviceStatus:
        async with self._lock:
            device = self._require(device_id)
            # The human fix: clears any fault.
            device.online = True
            device.faultMode = "none"
            device.signalDbm = _SEED_SIGNAL.get(device_id, -54)
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
