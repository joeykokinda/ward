# WARD Device Simulator

FastAPI app that simulates the three instrumented-property routers polled by the WARD agent and fetched by the Chainlink CRE workflow.

## Run locally

```sh
cd sim/
uv venv --python 3.12      # already done if .venv/ exists
uv pip install fastapi uvicorn
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8090 --reload
```

Console UI: http://localhost:8090/

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Returns `{"status":"ok"}` |
| GET | `/` | Node-console HTML dashboard |
| GET | `/fleet` | `{ devices: DeviceStatus[] }` for all 3 devices |
| GET | `/device/{id}/status` | Single `DeviceStatus` |
| POST | `/device/{id}/fail?mode=soft\|hard` | Trigger a fault |
| POST | `/device/{id}/restart` | Remote reboot (heals soft only) |
| POST | `/device/{id}/repair` | Human fix — clears any fault |
| POST | `/reset` | All devices back to healthy |

### DeviceStatus shape

```json
{
  "deviceId":       "prop-2-router",
  "propertyId":     "prop-2",
  "kind":           "router",
  "online":         false,
  "uptimeSec":      0,
  "signalDbm":      0,
  "faultMode":      "hard",
  "lastChangedIso": "2026-06-13T10:00:00+00:00"
}
```

CRE reads `online === true && faultMode === "none"` as "fixed".

## Fault-mode semantics

| Fault | `online` after fail | `online` after /restart | `online` after /repair |
|-------|---------------------|------------------------|------------------------|
| `none` | n/a | n/a | already healthy |
| `soft` | `false` | `true` (healed) | `true` |
| `hard` | `false` | `false` (no effect) | `true` |

Demo flow: `POST /device/prop-2-router/fail?mode=hard` simulates the router that won't self-heal, forcing the agent to dispatch a human worker. After the worker marks complete, `POST /device/prop-2-router/repair` restores health so CRE attestation passes.

## Canonical devices

| deviceId | propertyId | Property name |
|----------|------------|---------------|
| `prop-1-router` | `prop-1` | The Brooklyn Loft |
| `prop-2-router` | `prop-2` | Greenwich Cottage |
| `prop-3-router` | `prop-3` | Hudson Studio |

## Public exposure

### Railway (production)

1. Push repo; in Railway dashboard create a new service, point at the repo root.
2. In service settings set **Root Directory** to `sim/` and **Dockerfile path** to `Dockerfile`.
3. Railway auto-assigns a public HTTPS URL. Set `SIM_BASE_URL` in agent and CRE env vars.

The `railway.json` at repo root configures the build. If deploying the sim as its own Railway project (separate from the monorepo), use the `Dockerfile` directly.

### cloudflared (dev tunnel, no account needed)

```sh
cloudflared tunnel --url http://localhost:8090
```

Outputs a public `https://*.trycloudflare.com` URL. Give it to the CRE workflow as `SIM_BASE_URL`.

## Docker

```sh
cd sim/
docker build -t ward-sim .
docker run -p 8090:8090 ward-sim
```
