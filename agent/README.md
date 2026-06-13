# WARD Agent — the autonomous runtime (the brain)

WARD's brain. It polls the device fleet, diagnoses faults with an LLM,
attempts a remote software fix (**Level 1**), and when that fails it escrows
USDC and dispatches a human worker (**Level 3**) on the **ERC-8183 WardEscrow**,
then the **CRE evaluator** settles the job once telemetry is healthy again. The
agent is **the first client of the rails**: it posts proof-gated jobs to the
same ERC-8183 escrow any treasury or script could.

On-chain roles (ERC-8183): **client** = the agent (`AGENT_PRIVATE_KEY`),
**provider** = the dispatched worker (`WARD_WORKER_KEYS`), **evaluator** = the
CRE oracle (`EVALUATOR_PRIVATE_KEY` / `EVALUATOR_ADDRESS`). The agent drives
`createJob → setBudget → fund` as client, the worker `submit`s as provider, and
the evaluator `complete`s — the sensor-settled release that pays the provider.

Plain Python (no uAgents): `asyncio` + `web3.py` + the Anthropic SDK. Runs
fully offline with graceful fallbacks; real keys plug in via env later.

## Escalation ladder (PROJECT.md)

```
poll fleet
  └─ fault?  → DIAGNOSE (LLM, or deterministic rules if no key)
        ├─ Level 1: ACTION remote restart → RESULT
        │     └─ healed?  → RESOLVED, stop          (free, autonomous)
        └─ remote fix failed → confirmed hardware fault
              → ESCROW  createJob(provider, evaluator) → setBudget → fund
                        (respect caps + 100 USDC owner threshold)
              → DISPATCH highest-reputation worker submit()s (provider key)
              → repair device + confirm telemetry healthy
              → RESULT  evaluator complete()  → budget released to provider
              → RESOLVED incident closed
```

ERC-8183 lifecycle: **OPEN → FUNDED → SUBMITTED → COMPLETED** (off-happy-path
REJECTED / EXPIRED → `claimRefund`). The evaluator-signed `complete()` is the
sensor-settled release representing the CRE attestation: the agent repairs the
device, confirms `/status` healthy, then the evaluator key completes the job.

Below the **100 USDC** owner-approval threshold the agent acts autonomously;
at/above it the job is marked **pending owner approval** and is not escrowed
until approved. Per-job and daily spend caps are enforced before escrow.

## Architecture

```
[device sim HTTP API]  ◀── poll + remote-fix ──  ward_agent.sim_client (real)
        (or)                                       ward_agent.fake_sim (in-proc)
                                                          │
ward_agent.main  (asyncio loop)  ───────────────────────┤
   ├─ diagnosis.py   LLM reasoning (claude-fable-5 → claude-opus-4-8)  ↺ rules fallback
   ├─ chain.py       web3.py wrapper (ERC-8183 WardEscrow): createJob / setBudget /
   │                 fund / submit / complete (evaluator) / claimRefund  ← CRE seam
   ├─ jobs.py        OPEN→FUNDED→SUBMITTED→COMPLETED state machine
   └─ events.py      decision feed (MONITOR|DIAGNOSE|ACTION|RESULT|ESCROW|
                     DISPATCH|RESOLVED) → in-memory buffer + SSE + Supabase
ward_agent.server  FastAPI: /events (SSE), /events/recent, /healthz,
                   POST /incident/simulate  (genuine end-to-end trigger)
```

### Modules

| Module | Responsibility |
|---|---|
| `config.py` | Single env seam. Resolves everything from env with safe defaults; exposes `llm_enabled` / `chain_live` / `supabase_enabled`. Never raises on missing config. |
| `diagnosis.py` | `diagnose(device_status, history) -> Diagnosis`. Anthropic API (adaptive thinking + structured output); **falls back to deterministic rules** when `ANTHROPIC_API_KEY` is unset or any LLM call fails. Diagnosis carries cause, recommended level (1/3), confidence, rationale. |
| `sim_client.py` | Async `httpx` client for the device sim (`/fleet`, `/device/{id}/status\|fail\|restart\|repair`, `/reset`). |
| `fake_sim.py` | In-process device fleet with the **same method surface** as `sim_client`, so the loop runs with zero external processes. Soft faults heal on restart; hard faults need `repair()`. |
| `chain.py` | web3.py wrapper (ERC-8183 WardEscrow) reading `deployments/<chainId>.json` + `deployments/abis/`. `create_job` (client), `set_budget` (client), `fund` (client), `submit` (provider/worker key), `complete` (**evaluator key — the sensor-settled release**), `claim_refund`, balances, worker reads. **DRY mode** when no RPC/key: logs the txs it would send, emits synthetic tx hashes, simulates the lifecycle in memory. |
| `jobs.py` | The canonical job state machine + registry (OPEN→FUNDED→SUBMITTED→COMPLETED; REJECTED/EXPIRED/REFUNDED). Guards illegal transitions. |
| `events.py` | The decision feed. Buffers events in memory, fans out to SSE subscribers, and (if Supabase configured) mirrors into `agent_events`. |
| `main.py` | The asyncio loop and incident orchestration (`WardAgent`). |
| `server.py` | FastAPI app + background poll loop. |

## Setup

```bash
cd agent
uv venv --python 3.12
uv pip install -r requirements.txt        # or: uv pip install -e .
```

## Run

```bash
# Offline demo loop (no creds): in-process fake sim, rules diagnosis, DRY chain
.venv/bin/python -m ward_agent.server      # serves on :8080, starts the poll loop
# then, from anywhere:
curl -X POST localhost:8080/incident/simulate \
     -H 'content-type: application/json' \
     -d '{"propertyId":"prop-2","mode":"hard","autoComplete":true}'
curl localhost:8080/events/recent          # full reasoning stream
curl -N localhost:8080/events              # live SSE stream
curl localhost:8080/healthz                # mode summary + balances + policy

# Headless loop without the server
.venv/bin/python -m ward_agent.main

# End-to-end verification (drives one complete incident, prints the stream)
.venv/bin/python verify_dry_run.py         # hard fault -> full L3 cycle
.venv/bin/python verify_dry_run.py soft    # soft fault -> resolves at L1
```

`POST /incident/simulate` injects a **real** fault into the sim and lets the
agent's own poll loop react — the agent's reasoning is not scripted. In the
DRY/demo path (`autoComplete: true`, `mode: "hard"`) it also drives the field
tech's side (physical repair + accept + mark-done) so the full
fault → failed restart → escrow → dispatch → accept → work-done → attest →
settle cycle completes for the frontend.

## DRY vs LIVE

| Concern | DRY (default, offline) | LIVE |
|---|---|---|
| Diagnosis | deterministic rules engine | Anthropic API, with rules fallback on any failure |
| Device sim | in-process `FakeSim` | real sim over HTTP at `SIM_BASE_URL` |
| Chain | synthetic tx hashes, in-memory job ledger | real txs via web3.py to Arc |
| CRE attestation | evaluator `complete()` simulated once telemetry is healthy | evaluator key signs the real ERC-8183 `complete()` |
| Workers | built-in roster (or `WARD_WORKER_ROSTER`) | registry reads enrich roster reputation |

The agent **never hard-crashes on missing config** — each subsystem degrades
independently. You can run with a live chain but rules-based diagnosis, or a
real sim but DRY chain, etc.

## Env vars — what flips DRY → LIVE

Full list in `.env.example`. The switches that change behavior:

| Flips to LIVE when set | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Diagnosis uses the Anthropic API (`claude-fable-5`, auto-falling back to `claude-opus-4-8` if fable is unavailable). Unset ⇒ deterministic rules diagnosis. |
| `ARC_RPC_URL` **and** `AGENT_PRIVATE_KEY` | Chain goes LIVE (both required; plus a reachable RPC, a matching `deployments/<chainId>.json`, and `web3` installed). Otherwise DRY. `ARC_CHAIN_ID` selects the deployment file; `USDC_ADDRESS` / `MockUSDC` in the deployment back balance reads. The ERC-8183 escrow is the deployment's `JobEscrow` (= WardEscrow). |
| `EVALUATOR_PRIVATE_KEY` (+ `EVALUATOR_ADDRESS`) | Lets the agent sign the ERC-8183 evaluator-only `complete()` (the sensor-settled release that pays the provider). `EVALUATOR_ADDRESS` is set as the evaluator on `createJob`. If the key is missing in LIVE mode, `complete()` is skipped (job stays SUBMITTED) and logged; DRY mode simulates the evaluator. |
| (sim) `SIM_BASE_URL` reachable | The real device sim is used; otherwise the in-process `FakeSim`. (No flag — auto-detected at startup.) |
| `SUPABASE_URL` **and** `SUPABASE_ANON_KEY` | Events are mirrored into the `agent_events` table (best-effort, never blocks the loop). Otherwise in-memory only. |

Policy knobs (USDC 6-decimal units): `WARD_JOB_AMOUNT` (default `75000000` =
75 USDC), `WARD_OWNER_THRESHOLD` (`100000000` = 100 USDC), `WARD_PER_JOB_CAP`,
`WARD_DAILY_CAP`, `WARD_JOB_DEADLINE`. Loop timing: `WARD_POLL_INTERVAL`,
`WARD_ATTEST_POLL`, `WARD_ATTEST_TIMEOUT`. Server: `WARD_HOST`, `WARD_PORT`.

`WARD_AUTO_COMPLETE` (default `true`): when on, after DISPATCH the agent drives
the provider side autonomously — signs `submit()` as the dispatched worker (key
from `WARD_WORKER_KEYS`; DRY mode simulates it), repairs the device so telemetry
recovers, then the evaluator key signs `complete()`. The incident closes
`OPEN→FUNDED→SUBMITTED→COMPLETED` with no human. Set `false` to hand off to a
"worker submits via UI" path (the agent still escrows + dispatches, then waits;
the evaluator still completes once telemetry is healthy).

**One open job per property:** while a device stays unhealthy, the poll loop
re-runs the incident, but the agent will not create a second escrow job for a
property that already has an unsettled one (`OPEN/FUNDED/SUBMITTED`); it logs
`MONITOR  prop-N already has open job #M …` and skips. The guard clears when the
job completes/refunds (terminal) or the device recovers.

## How it plugs into the rest of WARD

- **Sim** (`sim/`): `sim_client` speaks the INTERFACES.md HTTP API; the same
  public HTTPS endpoint is what CRE fetches telemetry from.
- **Contracts** (`contracts/` → `deployments/`): `chain.py` reads
  `deployments/<chainId>.json` + `deployments/abis/{JobEscrow,WorkerRegistry,MockUSDC}.json`.
  The escrow is **ERC-8183 (WardEscrow)** — the deployment's `JobEscrow` key
  points at it. The agent drives `createJob → setBudget → fund` as client; the
  worker `submit`s; the evaluator `complete`s to release payment.
- **CRE**: isolated behind the evaluator-signed `chain.complete(jobId, reason)`.
  The agent confirms `/status` healthy, then the evaluator key (`EVALUATOR_*`)
  completes the job — the sensor-settled release. DRY mode simulates the
  evaluator; live mode signs the real `complete()`.
- **Supabase** (`db/`): events written to `agent_events` (camelCase event keys
  mapped to snake_case columns). Frontend reads the feed from there or via the
  agent's SSE endpoint.
- **Frontend** (`web/`): consumes `/events` (SSE) for the reasoning stream,
  `/events/recent` for backfill, `/healthz` for the Agent persona (ENS,
  balance, spending policy), and `POST /incident/simulate` for the
  "Simulate Router Failure" button.

## Captured DRY-run event stream

`verify_dry_run.py hard` (no `ANTHROPIC_API_KEY` — rules fallback, in-process
fake sim, DRY chain) drives one complete ERC-8183 incident **fully autonomously**
(no external worker nudge — the agent funds, the worker submits, the agent
repairs, and the evaluator completes on its own under `WARD_AUTO_COMPLETE=true`).
Lifecycle **OPEN → FUNDED → SUBMITTED → COMPLETED**:

```
MONITOR   Fault detected on prop-2 (prop-2-router): online=False, faultMode=hard, signal=-99dBm.
DIAGNOSE  prop-2-router went offline (faultMode=hard). Trying a free Level-1 remote reboot first; will escalate to dispatch if it fails. (recommend L1; confidence 70%; via rules)
ACTION    Attempting Level 1 remote restart of prop-2-router.
RESULT    Remote restart did not heal prop-2-router (still offline / faultMode=hard). Concluding hardware fault.
DIAGNOSE  Re-diagnosis after failed restart: prop-2-router stayed offline after a remote restart. A remote fix cannot clear this fault; a field technician is required. (recommend L3; via rules)
ESCROW    Hardware fault confirmed. Opening an escrowed job on Arc for prop-2 (75 USDC < 100 threshold -> autonomous, no owner sign-off needed). Evaluator (CRE oracle) = DRY-SIMULATED-CRE.
ESCROW    75 USDC funded into WardEscrow. Job #1 FUNDED.               [job=1, tx=0x…]
DISPATCH  Dispatching highest-reputation worker sara.ward-agent.eth (reputation 92) to prop-2.   [job=1]
DISPATCH  Worker sara.ward-agent.eth submitted the repair deliverable on job #1.   [job=1]
RESULT    Telemetry recovered for prop-2-router. CRE evaluator attesting the device is healthy and settling the job.   [job=1]
RESULT    Evaluator released 75 USDC to sara.ward-agent.eth; reputation incremented.   [job=1, tx=0x…]
RESOLVED  prop-2 restored by sara.ward-agent.eth and settled on attested telemetry. Incident closed.   [job=1]
```

`verify_dry_run.py soft` resolves at Level 1 with **no escrow**
(MONITOR → DIAGNOSE → ACTION → RESULT → RESOLVED). `verify_dry_run.py persist`
exercises the dedup guard: one funded job over three poll cycles, the rest
skipped (`already has open job #1 (state=FUNDED)`).
