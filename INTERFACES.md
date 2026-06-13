# WARD — Shared Interface Contract

**Every component must conform to this so the parts integrate without rework.** If you need to deviate, note it in your component README; do not silently diverge.

## Naming / identity

- Agent ENS: `ward-agent.eth` (Sepolia).
- Workers: subnames `<handle>.ward-agent.eth` (e.g. `mike.ward-agent.eth`).
- USDC: 6 decimals. Demo job amount: **75 USDC** = `75_000000`. Owner-approval threshold: **100 USDC**.

## Properties (pre-staged demo fleet)

| id | name | device id | device kind |
|---|---|---|---|
| `prop-1` | The Brooklyn Loft | `prop-1-router` | router |
| `prop-2` | Greenwich Cottage | `prop-2-router` | router |
| `prop-3` | Hudson Studio | `prop-3-router` | router |

Demo failure is triggered on `prop-2` (Greenwich Cottage).

## Device simulator HTTP API (`sim/`)

Base path `/` , JSON, permissive CORS. Public-HTTPS reachable (CRE must fetch it).

- `GET /fleet` → `{ devices: DeviceStatus[] }`
- `GET /device/{id}/status` → `DeviceStatus`
- `POST /device/{id}/fail?mode=soft|hard` → sets fault; `soft` heals on restart, `hard` does not
- `POST /device/{id}/restart` → heals iff fault was `soft`; returns resulting `DeviceStatus`
- `POST /device/{id}/repair` → clears any fault (the human fix); returns `DeviceStatus`
- `POST /reset` → all devices healthy

```
DeviceStatus = {
  deviceId: string, propertyId: string, kind: "router",
  online: boolean, uptimeSec: number, signalDbm: number,
  faultMode: "none" | "soft" | "hard", lastChangedIso: string
}
```
CRE attestation reads `online === true` (and `faultMode === "none"`) as "fixed".

## Job lifecycle (canonical state machine)

`OPEN → ACCEPTED → WORK_DONE → ATTESTING → SETTLED`  (off-happy-path: `EXPIRED`/`REFUNDED`)

## Contracts (`contracts/`, Arc testnet; ABIs + addresses exported to `deployments/`)

`WorkerRegistry`:
- `register(string handle, string ensName, string skills, string region)`
- `stake()` payable-equivalent in USDC (`stakeUSDC(uint256)`)
- `reputationOf(address) → uint256`, `getWorker(address) → Worker`
- event `WorkerRegistered(address worker, string ensName)`, `ReputationBumped(address worker, uint256 newRep)`

`JobEscrow` (holds USDC, releases on attested fix):
- `createJob(bytes32 propertyId, bytes32 deviceId, uint256 amount, uint256 deadline) → uint256 jobId` (pulls USDC from agent; enforces per-job cap + daily cap; if `amount > threshold` requires `ownerApproved`)
- `acceptJob(uint256 jobId)` (registered+staked workers only)
- `markWorkDone(uint256 jobId)` (assigned worker)
- `settle(uint256 jobId, <CRE report/proof args>)` — verifies the CRE attestation that the device is healthy, transfers USDC to worker, bumps reputation
- `refundExpired(uint256 jobId)` — after deadline if unsettled
- events: `JobCreated(uint256 jobId, bytes32 propertyId, bytes32 deviceId, uint256 amount)`, `JobAccepted(uint256 jobId, address worker)`, `WorkMarkedDone(uint256 jobId)`, `JobSettled(uint256 jobId, address worker, uint256 amount)`, `JobRefunded(uint256 jobId)`
- The CRE settlement entrypoint must be isolated behind an interface (`ICreConsumer` / authorized reporter) so the verification mechanism can be swapped per the SPIKES.md decision matrix without touching job logic.

Export after deploy: `deployments/<chain>.json` = `{ chainId, WorkerRegistry, JobEscrow, MockUSDC, blockExplorer }` and ABIs to `deployments/abis/`. Frontend + agent read from here.

## Agent (`agent/`) decision feed

- Reasoning events conform to DESIGN.md log types: `MONITOR | DIAGNOSE | ACTION | RESULT | ESCROW | DISPATCH | RESOLVED`.
- Event shape: `{ ts: iso, type: LogType, message: string, jobId?: number, txHash?: string, propertyId?: string }`
- Agent exposes `GET /events` (SSE stream) and `GET /events/recent` (last N), and persists events to Supabase `agent_events`.
- Claude API is accessed behind `agent/diagnosis.py`; if `ANTHROPIC_API_KEY` is unset, fall back to a deterministic scripted diagnosis so the loop runs offline. Never hard-crash on missing key.

## Supabase schema (`db/`)

Tables: `properties`, `workers` (handle, ens_name, address, skills, region, reputation), `jobs` (job_id, property_id, device_id, worker, amount, state, tx_create, tx_settle, created_at), `agent_events`. Provide SQL migrations + a seed script (3 properties, 5 workers, 3+ historical jobs, agent wallet note). Frontend reads via `@supabase/supabase-js`; all config via env (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Provide a local mock fallback so `web/` runs with no Supabase.

## Frontend (`web/`)

- Next.js (app router) + Tailwind, strictly per DESIGN.md tokens/bans. Three personas via header dropdown: Host / Worker / Agent (DEMO.md).
- Data layer in `web/lib/data/` with two adapters: `supabase` and `mock` (env-switched), exposing the same interface. Reads contract addresses/ABIs from `deployments/`.
- Worker view mobile-first (QR target). Every onchain reference renders an Arc explorer link + the ENS name (never a raw address where an ENS name exists).
- Must `pnpm build` clean with no credentials (mock adapter).

## Env seams (single source: `.env.example` at root, never commit real `.env`)

`ANTHROPIC_API_KEY, ARC_RPC_URL, ARC_CHAIN_ID, SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, AGENT_PRIVATE_KEY, USDC_ADDRESS, SUPABASE_URL, SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SIM_BASE_URL, NEXT_PUBLIC_DEPLOYMENTS, CRE_*`
