# WARD — frontend

Mission-control terminal UI for WARD, the autonomous property-operations agent.
Three personas (Host / Worker / Agent) behind a header dropdown, built strictly to
`DESIGN.md` tokens. Ships with a fully scripted, backend-free demo so the whole
flow is judge-ready with zero credentials.

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

- **Host** — three columns. Left: fleet grid (3 properties, dense rows with status
  dot + name + device id + ticking uptime + signal). Middle: agent reasoning stream
  in terminal-log style `[HH:MM:SS] [TYPE] message` with the per-type colors from
  `DESIGN.md`. Right: onchain activity feed (tx hashes → Arc explorer, USDC in amber,
  ENS names). Bottom: active-job bar (property // worker ENS // amount // status //
  elapsed) with an amber border-opacity pulse, shown only while a job is live.
  Header shows the agent ENS name, a blinking LIVE indicator, and the USDC treasury.
- **Worker** — mobile-first single column (the QR target). Reputation header,
  available jobs (amount in amber, distance, property), big Accept / Mark-Complete
  touch targets, recent payouts.
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

In the **Host** view, **▶ SIMULATE ROUTER FAILURE** (targets Greenwich Cottage,
`prop-2`) runs the entire `DEMO.md` 90-second flow as a timed sequence — no backend:

1. detect (router goes offline, hard fault) →
2. diagnose telemetry →
3. attempt remote reboot →
4. reboot **FAILS** (hard fault) →
5. query the worker registry via ENS, rank by reputation, select
   `mike.ward-agent.eth` →
6. note 75 USDC < the 100 USDC owner-approval threshold → escrow **75 USDC** on Arc
   (realistic tx hash + explorer link), job `OPEN`, treasury 500 → 425 →
7. worker accepts (judge's phone in the Worker view, or auto-pilot for unattended
   demos) → marks complete →
8. device recovers → Chainlink CRE attests `online && faultMode === none` → escrow
   auto-releases to the worker → reputation 98 → 99 →
9. activity feed updates, property returns to **HEALTHY**.

**⟲ RESET** returns to the clean pre-staged state (3 healthy properties, 5 workers
with ENS subnames + reputation, agent wallet 500 USDC, 3 historical settled jobs in
the feed). Designed to be used 50+ times over a weekend.

Pre-staged fixtures (`lib/data/fixtures.ts`) match the `INTERFACES.md` canonical
list: properties `prop-1/2/3`, workers `mike/sara/deon/lena/raj.ward-agent.eth`,
agent `ward-agent.eth`, jobs `#1041/#1042/#1043`.

## Live wiring (later)

The mock player is just one `WardAdapter` implementation. To go live:

- Point `NEXT_PUBLIC_DATA_ADAPTER=supabase` and set the Supabase env vars; the
  agent persists `agent_events` / `jobs` and the UI streams them in realtime.
- For a direct agent SSE feed, add a third adapter that consumes the agent's
  `GET /events` stream and maps it onto the same `AgentEvent` / `Job` shapes — the
  interface is identical, so no persona component changes.
- Tx hashes already render as Arc explorer links and worker names as ENS profile
  links, so real on-chain data lights up automatically once the addresses resolve.
