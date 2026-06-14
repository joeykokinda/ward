# WARD — frontend

UI for WARD, the autonomous agent for YOUR HOME: it watches every device, fixes
what it can, hires a verified human when it can't, and tells you what happened —
so you stop being on-call for your own house. One home, four instrumented devices
(WiFi router, thermostat, front-door lock, leak sensor). Three personas
(Home / Worker / Agent) behind a header dropdown, built to the
v2 Profound-style light theme. Ships with a fully scripted, backend-free
demo so the whole flow is judge-ready with zero credentials.

Roadmap: today homeowners · tomorrow property managers & DePIN — same protocol.

Stack: Next.js 16 (app router) + Tailwind 4 + TypeScript. JetBrains Mono + Inter
via `next/font`. pnpm.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production build (clean, no creds needed)
pnpm start      # serve the production build
pnpm lint       # eslint (clean)
```

The default `mock` adapter needs no environment at all — `pnpm build` and the
demo work out of the box.

> Build note: `pnpm-workspace.yaml` sets `strictDepBuilds: false` so the optional
> native build scripts (`sharp`, `unrs-resolver`) stay a warning instead of failing
> Next's internal dependency check. Nothing in WARD depends on them.

## Personas

Switch with the dropdown in the header (top right).

- **Home** (homeowner) — the device grid (4 home devices: WiFi router, thermostat,
  front-door lock, leak sensor — each with a friendly name, lucide icon, status,
  uptime, signal). The agent reasoning timeline leads; the device grid + on-chain
  activity feed (tx hashes → Arc explorer, USDC, ENS names) sit beside it. An
  active-job bar appears while a job is live. The Simulate control is
  **Simulate: WiFi outage** (the hero). Header shows the agent ENS name, a live
  indicator, and the USDC treasury.
- **Worker** (local tech) — mobile-first single column (the QR target). Reputation
  header, jobs at homes near you ("WiFi outage at a home nearby"), big Accept /
  Mark-Complete touch targets, recent payouts.
- **Agent** — identity card (ENS name, address, live USDC balance), spending-policy
  panel (per-job cap, daily cap, owner-approval threshold = 100 USDC), decision
  history, and the recent reasoning trace.

## Data layer / adapter switch

All UI reads a single `WardSnapshot` shape (`lib/data/types.ts`). Two adapters
implement the same `WardAdapter` interface and are selected by env:

```
NEXT_PUBLIC_DATA_ADAPTER = mock        # default — self-contained, scripted demo
NEXT_PUBLIC_DATA_ADAPTER = supabase    # reads NEXT_PUBLIC_SUPABASE_*
```

- `lib/data/mock.ts` — pre-staged fixtures + the scripted incident player (below).
- `lib/data/supabase.ts` — hydrates from Supabase tables (`workers`, `jobs`,
  `agent_events`) and subscribes to realtime inserts. Falls back to fixtures if the
  env vars are missing, so it never hard-crashes.
- `lib/data/index.ts` — env-switched singleton factory shared across all personas.

The React seam is `lib/useWard.ts` (`useSyncExternalStore` + a 1 Hz tick for the
live timers). Components never touch an adapter directly.

## Env vars

Copy `.env.local.example` → `.env.local`. Everything is optional under the mock
adapter.

| Var | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_DATA_ADAPTER` | `mock` or `supabase` | `mock` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (supabase adapter) | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (supabase adapter) | — |
| `NEXT_PUBLIC_ARC_EXPLORER` | Arc explorer base for tx/address links | `https://explorer.arc.network` |
| `NEXT_PUBLIC_ARC_CHAIN_ID` | Arc chain id shown in Agent view | `8008` |
| `NEXT_PUBLIC_WORKER_REGISTRY` | WorkerRegistry address | placeholder |
| `NEXT_PUBLIC_JOB_ESCROW` | JobEscrow address | placeholder |
| `NEXT_PUBLIC_USDC_ADDRESS` | USDC address | placeholder |

Contract addresses + explorer base live in `lib/config.ts`. When the contracts are
deployed, point the env vars at the real values (or wire
`deployments/<chain>.json` directly into `readDeployment()`); no UI changes needed.

## Scripted incident player (the demo)

In the **Home** view, **Simulate: WiFi outage** (the hero — your WiFi just died at
2am, device `home-wifi`) runs the entire flow as a timed sequence — no backend:

1. detect (home WiFi router goes offline, hard fault) →
2. diagnose telemetry →
3. attempt remote reboot →
4. reboot **FAILS** (hard fault) →
5. query the worker registry via ENS for skill `network`, rank by reputation,
   select `mike.ward-agent.eth` →
6. note 75 USDC < the 100 USDC owner-approval threshold → escrow **75 USDC** on Arc
   (realistic tx hash + explorer link), job `OPEN`, treasury 500 → 425 →
7. worker accepts (judge's phone in the Worker view, or auto-pilot for unattended
   demos) → marks complete →
8. device recovers → Chainlink CRE attests `online && faultMode === none` → escrow
   auto-releases to the worker → reputation 98 → 99 →
9. activity feed updates, home WiFi returns to **HEALTHY**.

**⟲ RESET** returns to the clean pre-staged state (4 healthy home devices, 5 ENS
techs with reputation, agent wallet 500 USDC, 3 historical settled jobs in the
feed). Designed to be used 50+ times over a weekend.

Pre-staged fixtures (`lib/data/fixtures.ts`): devices `home-wifi` (router, hero),
`home-thermostat`, `home-lock`, `home-leak` (leak sensor); techs
`mike/sara/deon/lena/raj.ward-agent.eth` with skills network / hvac / locksmith /
plumber; agent `ward-agent.eth`; jobs `#1041/#1042/#1043`.

## Live wiring (later)

The mock player is just one `WardAdapter` implementation. To go live:

- Point `NEXT_PUBLIC_DATA_ADAPTER=supabase` and set the Supabase env vars; the
  agent persists `agent_events` / `jobs` and the UI streams them in realtime.
- For a direct agent SSE feed, add a third adapter that consumes the agent's
  `GET /events` stream and maps it onto the same `AgentEvent` / `Job` shapes — the
  interface is identical, so no persona component changes.
- Tx hashes already render as Arc explorer links and worker names as ENS profile
  links, so real on-chain data lights up automatically once the addresses resolve.
