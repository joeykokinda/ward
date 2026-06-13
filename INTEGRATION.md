# WARD — Integration Notes

Running list of cross-component seams to reconcile once all agents land. Update as agents report. Drives task #10.

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

## Arc / CRE deployment facts (live-verified by spike)

- Arc Testnet: RPC `https://rpc.testnet.arc.network`, **chainId 5042002**, explorer `https://testnet.arcscan.app` (Blockscout — verify with `--verifier blockscout`, no API key).
- **Gas is paid in USDC.** Native USDC ERC-20 at `0x3600000000000000000000000000000000000000`, 6 decimals. Set `USDC_ADDRESS` to this (not MockUSDC) for the live Arc deploy.
- CRE Arc forwarder: `0x76c9cf548b4179F8901cda1f8623568b58215E62`.
- CRE CLI installs headless: `curl -sSL https://cre.chain.link/install.sh | bash` → `~/.cre/bin/cre`. WASM build needs no account. **Simulation (bounty evidence) needs a free `CRE_API_KEY`** from app.chain.link → Account Settings.
- **Throwaway deployer to fund (Arc faucet, captcha/browser-only):** `0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4` (key in `spike/arc/.env`, gitignored). Circle faucet `https://faucet.circle.com` → Arc Testnet → USDC → this address (20 USDC/2h, also pays gas). This is the only blocker to deploying live on Arc.
- Caveat: do NOT trust forge local-fork dry-run of Arc USDC transfers (blocklist precompile reverts on fork); deploy/interact with `--broadcast` on live Arc only.

## DECISION — CRE verifier seam (orchestrator)

Two implementations exist: `WardCreConsumer` (CRE-native push via `onReport`) and `AuthorizedReporterVerifier` (ECDSA sign-then-pull). **For the live demo + Chainlink bounty, wire `WardCreConsumer` as the escrow's `creVerifier`** (`setCreVerifier`) so the settlement is genuinely a CRE onchain report — the most authentic "CRE writes to Arc and releases escrow" story. Keep `AuthorizedReporterVerifier` for the agent's offline/DRY mode and as the fallback if live CRE deploy access is delayed. Reconcile reconciliation item #1 (settle signature) against whichever verifier is wired.

## Reconciliation TODO (integration phase)

1. **settle() / attestation signature.** Agent `chain.py` packs the report as `(jobId, bytes32 deviceId, bool healthy, uint256 reportTimestamp, bytes signature)`. Contracts use `ICreConsumer.verifyHealthy(HealthAttestation) → bool` with `AuthorizedReporterVerifier` doing ECDSA over a domain-separated (chainid+verifier address) message + freshness window. **Action:** align `chain.py`'s struct field order + signature construction with the final `JobEscrow.settle` signature and `AuthorizedReporterVerifier`'s expected digest. Verify the EIP-191/712 digest layout matches on both sides with a round-trip test on anvil.

2. **Canonical `deployments/` location.** Contracts `Deploy.s.sol` writes to `contracts/deployments/<chainId>.json` + `abis/`. Agent `chain.py` and frontend `web/lib` both expect to read deployments. **Action:** pick ONE canonical path (propose repo-root `/deployments/`); either point Deploy output there or copy on deploy, and set `NEXT_PUBLIC_DEPLOYMENTS` / agent `DEPLOYMENTS` path accordingly. Don't leave three copies.

3. **Agent's stub interfaces.** `agent/` built local `interfaces/`+`MockUSDC` stubs before contracts landed; `chain.py` uses ABIs from `deployments/abis/` so this is harmless, but remove/ignore the stubs to avoid confusion.

4. **CRE mechanism wiring.** Both sides isolated the seam (agent `request_attestation`, contracts `setCreVerifier`/`ICreConsumer`). Final choice — CRE→Arc direct vs authorized-reporter relay — comes from the CRE+Arc spike (SPIKES.md matrix). Wire only after the spike reports; one function changes on the agent side, one verifier address on the contract side.

5. **Frontend data adapter → live.** Frontend mock incident player and the agent SSE feed implement the same event shape (INTERFACES.md). **Action:** confirm the `supabase`/live adapter consumes `GET /events` (agent SSE) and `agent_events` rows identically to the mock player, so flipping `NEXT_PUBLIC_DATA_ADAPTER` is the only change.

6. **Demo fixtures alignment.** Frontend mock fixtures, `db/` Supabase seed, and contracts `Seed.s.sol` all encode the canonical 5 workers / 3 properties / 3 historical jobs from INTERFACES.md. **Action:** spot-check the three agree (handles, ENS names, reputations) so a judge sees the same data in mock and live modes.

7. **`workers.skills` column type.** db schema stores `skills` as Postgres `text[]`; frontend `web/lib/data/supabase.ts` `rowToWorker` does `String(r.skills).split(",")`. supabase-js returns the array and `String([...])` coerces to a comma string, so it works — but confirm during integration, or switch the column to plain `text`. Low risk.

8. **Stray `pnpm-workspace.yaml` files.** Auto-created in `packages/ens/` and `db/` by pnpm install (install isolation, harmless). If a root pnpm workspace is set up later, reconcile so nested ones don't shadow it.

9. **ENS live config.** Going live needs `WARD_AGENT_REGISTRY` / `WARD_AGENT_ID` / `_CHAIN_ID` set once the agent has a real onchain registry entry, then the `agent-registration[...]="1"` record on `ward-agent.eth`, then `pnpm mint-subname <handle> --execute` per worker. ENS subnames decided to live on **L1 Sepolia via NameWrapper** (PublicResolver for text records).

## Credentials still needed to go live (mirror of the user ask)

`ANTHROPIC_API_KEY`; Arc RPC + funded deployer/agent wallet (faucet) + `USDC_ADDRESS`; Sepolia funded controller + `ward-agent.eth`; Vercel + Railway deploy method; Supabase URL/keys; CRE reporter/account (pending spike). Exact wallet addresses to fund come from the CRE+Arc spike agent.
