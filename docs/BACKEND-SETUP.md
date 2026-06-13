# WARD — Backend on the always-on PC (`brach`)

Goal: host the **device simulator** and the **agent** on the always-on box and expose them at **stable public HTTPS URLs** so (a) the Chainlink CRE workflow can fetch the sim and (b) the Vercel frontend can read the agent's SSE feed — 24/7, through async judging, at ~$0 infra cost (replaces Railway).

`brach` already has `cloudflared` and is on Tailscale (100.64.x.x). Either path gives a stable URL:
- **Cloudflare named tunnel** (best if you own a Cloudflare domain): stable `https://<sub>.<yourdomain>`, survives restarts.
- **Tailscale Funnel** (no domain needed): stable `https://brach.<tailnet>.ts.net`. Good fallback.
- Quick tunnel (`cloudflared tunnel --url`) is last resort — the URL changes on restart and breaks the CRE/Vercel config.

Persistence: run sim, agent, and the tunnel as **systemd user services** (or pm2) so they auto-restart and survive reboots.

## Services
- Sim: `sim/` (FastAPI) on `127.0.0.1:8090`. Public path must serve `GET /device/{id}/status` etc.
- Agent: `agent/` (FastAPI/SSE) on `127.0.0.1:8091`. Public path serves `GET /events`, `/events/recent`, `/healthz`, `POST /incident/simulate`.
- Two stable public URLs (or one host with `/sim` and `/agent` path prefixes via the tunnel/ingress).

## Env (agent, live mode)
`ARC_RPC_URL=https://rpc.testnet.arc.network`, `ARC_CHAIN_ID=5042002`, funded `AGENT_PRIVATE_KEY`, `USDC_ADDRESS=0x3600000000000000000000000000000000000000`, `WARD_DEPLOYMENTS_DIR=<repo>/deployments`, `SIM_BASE_URL=http://127.0.0.1:8090`, `ANTHROPIC_API_KEY` (optional; Haiku default, cheap), `SUPABASE_*` (optional). See root `.env.example` + `agent/.env.example`.

## After it's up
- Point the CRE workflow config (`cre/`) at the public **sim** URL.
- Set Vercel `NEXT_PUBLIC_AGENT_URL` to the public **agent** URL and `NEXT_PUBLIC_DATA_ADAPTER=live`.
- Smoke test from another network: `curl https://<sim-url>/device/prop-2-router/status` and `curl https://<agent-url>/healthz`.

## ⚠ Hardware note
The login banner showed **Temperature: 126.0 C**. If that's a real CPU/package sensor the box will throttle or shut down mid-judging — check `sensors` / `nvme smart-log`. Likely a misreporting sensor, but confirm before relying on it all weekend.
