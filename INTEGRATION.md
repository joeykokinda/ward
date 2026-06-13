# WARD — Integration Notes

Running list of cross-component seams to reconcile once all agents land. Update as agents report. Drives task #10.

**Integration pass (local anvil e2e) complete.** `scripts/dev-stack.sh up` brings up
the whole stack with no external creds; a real on-chain hard-fault incident settles
end-to-end (job OPEN→SETTLED, USDC moved to worker, reputation bumped) and the
soft-fault path self-heals at L1. Reconciliation #1–#6 resolved (details below);
remaining live-only items tracked under **Open**.

## Component status (commits)

| Component | Dir | Status | Commit |
|---|---|---|---|
| Interface contract | `INTERFACES.md` | done | 03724cd |
| Device simulator | `sim/` | done, curl-verified | 74443a8 |
| Contracts | `contracts/` | done, 50 tests + anvil e2e | 9a148da |
| Agent runtime | `agent/` | done, DRY-run verified | f818995 |
| Frontend | `web/` | done, build+lint clean, incident player verified | fd5c2f2 |
| CRE + Arc spike | `cre/`, `spike/arc/` | done — GATE CLEARED (CRE→Arc=YES) | fba9535 |
| ENS + Supabase | `packages/ens/`, `db/` | done, live-resolve + Postgres verified | 0f61d0a |

## LIVE STATE (2026-06-13)

- **Backend up on `brach` (always-on PC), public via Tailscale Funnel, systemd-persistent:**
  - Sim: `https://brach.taild3399f.ts.net` (CRE telemetry source; smoke-tested `/healthz` ok)
  - Agent: `https://brach.taild3399f.ts.net:8443` (SSE feed; currently **DRY mode** — rules diagnosis, in-memory chain). Flip to live by filling brach `agent/.env` (ANTHROPIC_API_KEY, ARC_RPC_URL+funded AGENT_PRIVATE_KEY, deployments, SUPABASE_*) and `systemctl --user restart ward-agent`.
  - CRE workflow `cre/workflow/config.json` `statusUrl` now points at the live sim (`/device/prop-2-router/status`).
- **`ward-agent.eth` registered** (ENS), owner `0x87Ab…8521`. To mint worker subnames + set ENSIP-26 records we need that owner key, OR set a wallet-we-control as ENS manager, OR rex runs `packages/ens` mint with the owner wallet. DECISION NEEDED.
- **Arc deployer `0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4` is OURS** (key in `spike/arc/.env`), but **UNFUNDED** (0 native, 0 USDC). Faucet it (`https://faucet.circle.com` → Arc Testnet → USDC) → this is the gate for live Arc deploy.
- **CRE auth: REQUIRED but FREE.** Tested `cre workflow simulate` (CLI v1.20.0) headless → `authentication required: not logged in and no CRE_API_KEY set`. Need either `cre login` (interactive, browser device-code) or a free `CRE_API_KEY` (app.chain.link → Account Settings). `cre workflow build` works with no auth. Simulation is the Chainlink bounty evidence bar.
- Anthropic key received → stored in local `.env` (gitignored); also needs to go into brach `agent/.env` to flip the live agent's LLM on.
- Vercel: accessible via MCP (team `spek's projects`). No token needed; frontend deployable on demand.

## Arc / CRE deployment facts (live-verified by spike)

- Arc Testnet: RPC `https://rpc.testnet.arc.network`, **chainId 5042002**, explorer `https://testnet.arcscan.app` (Blockscout — verify with `--verifier blockscout`, no API key).
- **Gas is paid in USDC.** Native USDC ERC-20 at `0x3600000000000000000000000000000000000000`, 6 decimals. Set `USDC_ADDRESS` to this (not MockUSDC) for the live Arc deploy.
- CRE Arc forwarder: `0x76c9cf548b4179F8901cda1f8623568b58215E62`.
- CRE CLI installs headless: `curl -sSL https://cre.chain.link/install.sh | bash` → `~/.cre/bin/cre`. WASM build needs no account. **Simulation (bounty evidence) needs a free `CRE_API_KEY`** from app.chain.link → Account Settings.
- **Throwaway deployer to fund (Arc faucet, captcha/browser-only):** `0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4` (key in `spike/arc/.env`, gitignored). Circle faucet `https://faucet.circle.com` → Arc Testnet → USDC → this address (20 USDC/2h, also pays gas). This is the only blocker to deploying live on Arc.
- Caveat: do NOT trust forge local-fork dry-run of Arc USDC transfers (blocklist precompile reverts on fork); deploy/interact with `--broadcast` on live Arc only.

## DECISION — CRE verifier seam (orchestrator)

Two implementations exist: `WardCreConsumer` (CRE-native push via `onReport`) and `AuthorizedReporterVerifier` (ECDSA sign-then-pull). **For the live demo + Chainlink bounty, wire `WardCreConsumer` as the escrow's `creVerifier`** (`setCreVerifier`) so the settlement is genuinely a CRE onchain report — the most authentic "CRE writes to Arc and releases escrow" story. Keep `AuthorizedReporterVerifier` for the agent's offline/DRY mode and as the fallback if live CRE deploy access is delayed. Reconcile reconciliation item #1 (settle signature) against whichever verifier is wired.

## Local end-to-end stack (integrator) — `scripts/dev-stack.sh`

One command brings up the whole stack on a local anvil chain with NO external
credentials, and a real on-chain incident settles end-to-end:

```bash
scripts/dev-stack.sh up       # anvil + Deploy + export-abis + Seed + sim(:8090) + agent LIVE(:8091)
scripts/dev-stack.sh down     # stop everything it started
scripts/dev-stack.sh status   # what's running
```

`up` is idempotent (reuses a running anvil, redeploys+reseeds, restarts sim+agent).
Logs in `/tmp/ward-*.log`; PIDs in `.dev-stack/`. The agent runs **LIVE against
anvil** with `MockCreVerifier` wired (auto-healthy), so `settle()` works with no
real CRE/signatures. Env wired by the script: `ARC_RPC_URL=http://127.0.0.1:8545`,
`ARC_CHAIN_ID=31337`, `AGENT_PRIVATE_KEY`=anvil acct 0 (= deployer), `USDC_ADDRESS`
= deployed MockUSDC, `SIM_BASE_URL=http://localhost:8090`, `WARD_WORKER_ROSTER`
+ `WARD_WORKER_KEYS` = the registered+staked anvil workers (mnemonic indices 1–5).

**Verified end-to-end on anvil (chainId 31337):** hard fault on `prop-2` →
agent escrows job #4 → dispatches `mike.ward-agent.eth` (acct idx 1) → mike's key
signs acceptJob + markWorkDone → device repaired → MockCreVerifier attests →
`settle()`. `cast` against anvil after the run: job #4 `jobState == 4` (Settled);
mike reputation `1 → 2`; mike USDC `75 → 150`; agent USDC `275 → 200`; escrow
balance `0`; `JobAccepted`/`WorkMarkedDone`/`JobSettled`/`ReputationBumped` all
emitted for jobId 4 with worker = mike. The agent SSE stream (`GET /events`)
showed MONITOR→DIAGNOSE→ACTION→RESULT→DIAGNOSE→ESCROW→DISPATCH→RESULT(attest,
mechanism=CRE)→RESULT(released 75 USDC)→RESOLVED. Soft fault on `prop-1`
self-heals at L1 with **no job created** (`nextJobId` unchanged), SSE:
MONITOR→DIAGNOSE→ACTION→RESULT→RESOLVED.

## Reconciliation TODO (integration phase)

1. ✅ **RESOLVED — settle() / attestation signature.** For the local e2e, `JobEscrow`
   is wired with `MockCreVerifier` (auto-healthy, ignores the signature), so `settle`
   works on anvil with the agent's placeholder signature. Confirmed the encoding
   matches both sides: contract `settle(uint256 jobId, HealthAttestation)` with
   `HealthAttestation = (uint256 jobId, bytes32 deviceId, bool healthy, uint256
   reportTimestamp, bytes signature)`; `chain.py` builds exactly that tuple in that
   order. The `bytes32 deviceId` packing also matches: `_bytes32_from_id("prop-2-router")`
   == on-chain `bytes32("prop-2-router")` (right-padded ASCII), verified via `cast`.
   For the **live Arc / Chainlink** path with `AuthorizedReporterVerifier`, the agent's
   placeholder signature must be replaced by a real reporter ECDSA over the
   domain-separated digest — see Open #A.

2. ✅ **RESOLVED — Canonical `deployments/` location.** Single canonical dir is now
   repo-root `/deployments/`. `Deploy.s.sol` writes `../deployments/<chainId>.json`,
   `export-abis.sh` writes `../deployments/abis/`, `Seed.s.sol` reads `../deployments/`,
   `foundry.toml` `fs_permissions` points at `../deployments`. The agent already
   defaulted `WARD_DEPLOYMENTS_DIR` to repo-root `/deployments`; the dev-stack sets it
   explicitly. Frontend reads addresses via `NEXT_PUBLIC_*` envs (set by dev-stack).
   No more `contracts/deployments/` copy. (Note: a clean checkout must `mkdir -p
   deployments` before the first deploy so foundry can resolve the `../deployments`
   permission path; the dev-stack does this.)

3. ✅ **RESOLVED — Agent's stub interfaces.** No `interfaces/` or `MockUSDC` stubs
   remain under `agent/`; `chain.py` reads ABIs from `/deployments/abis/`. Nothing to do.

4. ✅ **RESOLVED (local) — CRE mechanism wiring.** Local stack wires `MockCreVerifier`
   (`CRE_REPORTER` unset at deploy). Agent `request_attestation` returns a healthy
   envelope once telemetry recovers; `settle` passes it through `ICreConsumer`. The
   live Arc choice (CRE→Arc direct vs authorized-reporter) is still per SPIKES.md and
   is one verifier address + one signature change — tracked in Open #A.

5. ✅ **RESOLVED — Frontend data adapter → live.** Added `web/lib/data/live.ts`
   (`NEXT_PUBLIC_DATA_ADAPTER=live`), a read-only adapter that hydrates from the
   agent's `GET /events/recent` + `GET /healthz` and maps onto the same
   `WardSnapshot`/`AgentEvent` shapes (falls back to fixtures if the agent is
   unreachable, like the supabase adapter). Wired into `lib/data/index.ts`; mock stays
   the default. `pnpm build` passes with the live adapter + live deployment envs, and
   the built bundle inlines the live JobEscrow/USDC/chainId/agent-URL — confirmed the
   frontend reads the live deployment addresses. Mock default verified unchanged
   (placeholder addresses, no live address in the clean build).

6. ✅ **RESOLVED (handles/ENS/regions) — Demo fixtures alignment.** Handles + ENS
   names agree across all three (mike/sara/deon/lena/raj.ward-agent.eth). Fixed the
   one real discrepancy: `Seed.s.sol` worker **regions** now match the canonical
   `web/lib/data/fixtures.ts` + `db/seed` (Greenwich/Stamford/Brooklyn/Hudson/Greenwich
   CT/NY). Remaining intentional divergences (documented, not a bug): worker
   **addresses** differ (web/db use `0x111…`–`0x555…` placeholders; on-chain Seed uses
   the anvil mnemonic-derived addrs — the db seed already notes "live demo overwrites
   them with real subname-owner wallets"); **reputations** differ (web fixtures show
   curated 98/91/87/84/79; a fresh on-chain Seed starts everyone at 0 and bumps the 3
   historical-job workers to 1 — these are different layers, mock-curated vs
   chain-truth). Also note `chain.py` `_DEFAULT_ROSTER` (DRY fallback only) still lists
   `jen/carlos/ava`; harmless because the dev-stack overrides it via
   `WARD_WORKER_ROSTER`, but see Open #B.

7. **`workers.skills` column type.** db schema stores `skills` as Postgres `text[]`; frontend `web/lib/data/supabase.ts` `rowToWorker` does `String(r.skills).split(",")`. supabase-js returns the array and `String([...])` coerces to a comma string, so it works — but confirm during integration, or switch the column to plain `text`. Low risk.

8. **Stray `pnpm-workspace.yaml` files.** Auto-created in `packages/ens/` and `db/` by pnpm install (install isolation, harmless). If a root pnpm workspace is set up later, reconcile so nested ones don't shadow it.

9. **ENS live config.** Going live needs `WARD_AGENT_REGISTRY` / `WARD_AGENT_ID` / `_CHAIN_ID` set once the agent has a real onchain registry entry, then the `agent-registration[...]="1"` record on `ward-agent.eth`, then `pnpm mint-subname <handle> --execute` per worker. ENS subnames decided to live on **L1 Sepolia via NameWrapper** (PublicResolver for text records).

## Open (need a component-owner decision — integrator did not guess)

- **#A — Live Arc settle signature (CRE / AuthorizedReporterVerifier).** The local
  e2e uses `MockCreVerifier`, which ignores the signature. For the live Arc deploy
  with `AuthorizedReporterVerifier`, `chain.py.request_attestation` currently returns a
  **placeholder 65-byte zero signature**. Before the live demo, the agent (or the CRE
  workflow) must produce a real ECDSA signature from the trusted `reporter` over the
  verifier's domain-separated digest (chainid + verifier address + jobId + deviceId +
  healthy + reportTimestamp, with the freshness window). This is a contracts+agent
  owner call (which key signs, EIP-191 vs EIP-712 digest layout) — left unwired
  because guessing the digest preimage would silently fail on-chain. The seam is
  isolated: only `request_attestation`'s `signature` field and the deployed verifier
  address change.

- **#B — `chain.py` `_DEFAULT_ROSTER` handles.** The DRY-mode fallback roster lists
  `mike/sara/jen/carlos/ava`, diverging from the canonical `mike/sara/deon/lena/raj`
  (web/db/contracts). It only matters when the agent runs in pure DRY mode with no
  `WARD_WORKER_ROSTER` override (the dev-stack always overrides it, so the live e2e is
  unaffected). Agent owner should decide whether to update the built-in default to the
  canonical five; left as-is to avoid changing agent-author intent.

## Credentials still needed to go live (mirror of the user ask)

`ANTHROPIC_API_KEY`; Arc RPC + funded deployer/agent wallet (faucet) + `USDC_ADDRESS`; Sepolia funded controller + `ward-agent.eth`; Vercel + Railway deploy method; Supabase URL/keys; CRE reporter/account (pending spike). Exact wallet addresses to fund come from the CRE+Arc spike agent.
