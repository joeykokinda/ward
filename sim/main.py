import time
from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

FaultMode = Literal["none", "soft", "hard"]


class DeviceStatus(BaseModel):
    deviceId: str
    propertyId: str
    kind: Literal["router"]
    online: bool
    uptimeSec: int
    signalDbm: int
    faultMode: FaultMode
    lastChangedIso: str


# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------

_SEED = [
    {"deviceId": "prop-1-router", "propertyId": "prop-1", "kind": "router",
     "signalDbm": -52},
    {"deviceId": "prop-2-router", "propertyId": "prop-2", "kind": "router",
     "signalDbm": -58},
    {"deviceId": "prop-3-router", "propertyId": "prop-3", "kind": "router",
     "signalDbm": -61},
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _make_healthy(seed: dict) -> dict:
    return {
        "deviceId": seed["deviceId"],
        "propertyId": seed["propertyId"],
        "kind": seed["kind"],
        "online": True,
        "faultMode": "none",
        "signalDbm": seed["signalDbm"],
        "_lastChangedTs": time.monotonic(),
        "lastChangedIso": _now_iso(),
        "_seedSignalDbm": seed["signalDbm"],
    }


# Mutable state: keyed by deviceId
_state: dict[str, dict] = {s["deviceId"]: _make_healthy(s) for s in _SEED}


def _to_status(d: dict) -> DeviceStatus:
    uptime = int(time.monotonic() - d["_lastChangedTs"]) if d["online"] else 0
    return DeviceStatus(
        deviceId=d["deviceId"],
        propertyId=d["propertyId"],
        kind=d["kind"],
        online=d["online"],
        uptimeSec=uptime,
        signalDbm=d["signalDbm"],
        faultMode=d["faultMode"],
        lastChangedIso=d["lastChangedIso"],
    )


def _get(device_id: str) -> dict:
    if device_id not in _state:
        raise HTTPException(status_code=404, detail=f"Device {device_id!r} not found")
    return _state[device_id]


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="WARD Device Simulator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/fleet")
def get_fleet():
    return {"devices": [_to_status(d).model_dump() for d in _state.values()]}


@app.get("/device/{device_id}/status", response_model=DeviceStatus)
def get_device_status(device_id: str):
    return _to_status(_get(device_id))


@app.post("/device/{device_id}/fail", response_model=DeviceStatus)
def fail_device(device_id: str, mode: FaultMode = "soft"):
    if mode not in ("soft", "hard"):
        raise HTTPException(status_code=422, detail="mode must be 'soft' or 'hard'")
    d = _get(device_id)
    d["online"] = False
    d["faultMode"] = mode
    d["signalDbm"] = 0
    d["_lastChangedTs"] = time.monotonic()
    d["lastChangedIso"] = _now_iso()
    return _to_status(d)


@app.post("/device/{device_id}/restart", response_model=DeviceStatus)
def restart_device(device_id: str):
    d = _get(device_id)
    if d["faultMode"] == "soft":
        # soft fault heals on restart
        d["online"] = True
        d["faultMode"] = "none"
        d["signalDbm"] = d["_seedSignalDbm"]
        d["_lastChangedTs"] = time.monotonic()
        d["lastChangedIso"] = _now_iso()
    # hard fault: device remains offline, state unchanged except we note the attempt
    # (no state change for hard — restart has no effect)
    return _to_status(d)


@app.post("/device/{device_id}/repair", response_model=DeviceStatus)
def repair_device(device_id: str):
    d = _get(device_id)
    d["online"] = True
    d["faultMode"] = "none"
    d["signalDbm"] = d["_seedSignalDbm"]
    d["_lastChangedTs"] = time.monotonic()
    d["lastChangedIso"] = _now_iso()
    return _to_status(d)


@app.post("/reset")
def reset_all():
    for seed in _SEED:
        _state[seed["deviceId"]] = _make_healthy(seed)
    return {"reset": True, "devices": [_to_status(d).model_dump() for d in _state.values()]}


# ---------------------------------------------------------------------------
# Node console UI
# ---------------------------------------------------------------------------

_CONSOLE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WARD // Device Console</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:        #0a0a0f;
      --bg2:       #0f0f18;
      --border:    #1e1e2e;
      --amber:     #f5a623;
      --amber-dim: #7a5012;
      --green:     #22c55e;
      --red:       #ef4444;
      --muted:     #4b5563;
      --text:      #e2e8f0;
      --mono:      'JetBrains Mono', 'Fira Mono', 'Cascadia Code', monospace;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--mono);
      font-size: 13px;
      min-height: 100vh;
      padding: 24px;
    }

    header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 14px;
      margin-bottom: 24px;
      display: flex;
      align-items: baseline;
      gap: 12px;
    }

    header h1 {
      color: var(--amber);
      font-size: 18px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    header span {
      color: var(--muted);
      font-size: 11px;
      letter-spacing: 0.08em;
    }

    #reset-bar {
      margin-bottom: 20px;
    }

    .fleet {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }

    .card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 16px;
      position: relative;
    }

    .card.online  { border-left: 3px solid var(--green); }
    .card.offline { border-left: 3px solid var(--red); }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .device-id {
      color: var(--amber);
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.05em;
    }

    .badge {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 2px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .badge-online  { background: #14532d; color: var(--green); }
    .badge-offline { background: #450a0a; color: var(--red); }

    .fields {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 12px;
      margin-bottom: 14px;
      color: var(--muted);
      font-size: 11px;
    }

    .fields .val {
      color: var(--text);
      text-align: right;
    }

    .fault-none { color: var(--green); }
    .fault-soft { color: var(--amber); }
    .fault-hard { color: var(--red); }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    button {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.06em;
      cursor: pointer;
      border: none;
      border-radius: 2px;
      padding: 5px 10px;
      text-transform: uppercase;
      transition: opacity 0.15s;
    }

    button:hover { opacity: 0.8; }
    button:active { opacity: 0.6; }

    .btn-fail-soft { background: var(--amber-dim); color: var(--amber); }
    .btn-fail-hard { background: #450a0a;          color: var(--red); }
    .btn-restart   { background: #1e293b;          color: #93c5fd; }
    .btn-repair    { background: #14532d;          color: var(--green); }
    .btn-reset     { background: var(--amber-dim); color: var(--amber); font-size: 12px; padding: 7px 18px; }

    #log {
      margin-top: 28px;
      border-top: 1px solid var(--border);
      padding-top: 14px;
    }

    #log h2 {
      color: var(--muted);
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    #log-lines {
      max-height: 180px;
      overflow-y: auto;
      font-size: 11px;
      line-height: 1.6;
      color: var(--muted);
    }

    #log-lines span { display: block; }
    #log-lines .ts  { color: var(--amber-dim); }
    #log-lines .msg { color: var(--text); }
  </style>
</head>
<body>

<header>
  <h1>WARD // Device Console</h1>
  <span>fleet telemetry simulator</span>
</header>

<div id="reset-bar">
  <button class="btn-reset" onclick="resetAll()">Reset All Devices</button>
</div>

<div class="fleet" id="fleet"></div>

<div id="log">
  <h2>Activity Log</h2>
  <div id="log-lines"></div>
</div>

<script>
const BASE = '';  // same origin

function ts() {
  return new Date().toISOString().replace('T',' ').slice(0,19);
}

function log(msg) {
  const el = document.getElementById('log-lines');
  const line = document.createElement('span');
  line.innerHTML = `<span class="ts">[${ts()}]</span> <span class="msg">${msg}</span>`;
  el.prepend(line);
  while (el.children.length > 60) el.removeChild(el.lastChild);
}

function faultClass(f) {
  if (f === 'none') return 'fault-none';
  if (f === 'soft') return 'fault-soft';
  return 'fault-hard';
}

function renderCard(d) {
  const isOnline = d.online;
  const cardClass = isOnline ? 'online' : 'offline';
  const badgeClass = isOnline ? 'badge-online' : 'badge-offline';
  const badgeText  = isOnline ? 'online' : 'offline';
  const fClass = faultClass(d.faultMode);

  return `
    <div class="card ${cardClass}" id="card-${d.deviceId}">
      <div class="card-header">
        <div class="device-id">${d.deviceId}</div>
        <span class="badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="fields">
        <span>property</span>  <span class="val">${d.propertyId}</span>
        <span>kind</span>      <span class="val">${d.kind}</span>
        <span>uptime</span>    <span class="val">${d.uptimeSec}s</span>
        <span>signal</span>    <span class="val">${d.signalDbm} dBm</span>
        <span>fault</span>     <span class="val ${fClass}">${d.faultMode}</span>
        <span>changed</span>   <span class="val">${d.lastChangedIso}</span>
      </div>
      <div class="actions">
        <button class="btn-fail-soft" onclick="fail('${d.deviceId}','soft')">Fail soft</button>
        <button class="btn-fail-hard" onclick="fail('${d.deviceId}','hard')">Fail hard</button>
        <button class="btn-restart"   onclick="restart('${d.deviceId}')">Restart</button>
        <button class="btn-repair"    onclick="repair('${d.deviceId}')">Repair</button>
      </div>
    </div>`;
}

async function fetchFleet() {
  const r = await fetch(`${BASE}/fleet`);
  const data = await r.json();
  const fleet = document.getElementById('fleet');
  fleet.innerHTML = data.devices.map(renderCard).join('');
}

async function fail(id, mode) {
  const r = await fetch(`${BASE}/device/${id}/fail?mode=${mode}`, { method: 'POST' });
  const d = await r.json();
  log(`FAIL [${mode}] -> ${id} | online=${d.online} fault=${d.faultMode}`);
  await fetchFleet();
}

async function restart(id) {
  const r = await fetch(`${BASE}/device/${id}/restart`, { method: 'POST' });
  const d = await r.json();
  log(`RESTART -> ${id} | online=${d.online} fault=${d.faultMode}`);
  await fetchFleet();
}

async function repair(id) {
  const r = await fetch(`${BASE}/device/${id}/repair`, { method: 'POST' });
  const d = await r.json();
  log(`REPAIR -> ${id} | online=${d.online} fault=${d.faultMode}`);
  await fetchFleet();
}

async function resetAll() {
  const r = await fetch(`${BASE}/reset`, { method: 'POST' });
  log('RESET ALL devices -> healthy');
  await fetchFleet();
}

// Initial load + poll every 5s
fetchFleet();
setInterval(fetchFleet, 5000);
</script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def console():
    return HTMLResponse(content=_CONSOLE_HTML)
