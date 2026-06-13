# WARD — Integration Notes

Running list of cross-component seams to reconcile once all agents land. Update as agents report. Drives task #10.

## Component status (commits)

| Component | Dir | Status | Commit |
|---|---|---|---|
| Interface contract | `INTERFACES.md` | done | 03724cd |
| Device simulator | `sim/` | done, curl-verified | 74443a8 |
| Contracts | `contracts/` | done, 50 tests + anvil e2e | 9a148da |
| Agent runtime | `agent/` | done, DRY-run verified | f818995 |
| Frontend | `web/` | building | — |
| CRE + Arc spike | `cre/`, `spike/arc/` | building | — |
| ENS + Supabase | `packages/ens/`, `db/` | building | — |

## Reconciliation TODO (integration phase)

1. **settle() / attestation signature.** Agent `chain.py` packs the report as `(jobId, bytes32 deviceId, bool healthy, uint256 reportTimestamp, bytes signature)`. Contracts use `ICreConsumer.verifyHealthy(HealthAttestation) → bool` with `AuthorizedReporterVerifier` doing ECDSA over a domain-separated (chainid+verifier address) message + freshness window. **Action:** align `chain.py`'s struct field order + signature construction with the final `JobEscrow.settle` signature and `AuthorizedReporterVerifier`'s expected digest. Verify the EIP-191/712 digest layout matches on both sides with a round-trip test on anvil.

2. **Canonical `deployments/` location.** Contracts `Deploy.s.sol` writes to `contracts/deployments/<chainId>.json` + `abis/`. Agent `chain.py` and frontend `web/lib` both expect to read deployments. **Action:** pick ONE canonical path (propose repo-root `/deployments/`); either point Deploy output there or copy on deploy, and set `NEXT_PUBLIC_DEPLOYMENTS` / agent `DEPLOYMENTS` path accordingly. Don't leave three copies.

3. **Agent's stub interfaces.** `agent/` built local `interfaces/`+`MockUSDC` stubs before contracts landed; `chain.py` uses ABIs from `deployments/abis/` so this is harmless, but remove/ignore the stubs to avoid confusion.

4. **CRE mechanism wiring.** Both sides isolated the seam (agent `request_attestation`, contracts `setCreVerifier`/`ICreConsumer`). Final choice — CRE→Arc direct vs authorized-reporter relay — comes from the CRE+Arc spike (SPIKES.md matrix). Wire only after the spike reports; one function changes on the agent side, one verifier address on the contract side.

5. **Frontend data adapter → live.** Frontend mock incident player and the agent SSE feed implement the same event shape (INTERFACES.md). **Action:** confirm the `supabase`/live adapter consumes `GET /events` (agent SSE) and `agent_events` rows identically to the mock player, so flipping `NEXT_PUBLIC_DATA_ADAPTER` is the only change.

6. **Demo fixtures alignment.** Frontend mock fixtures, `db/` Supabase seed, and contracts `Seed.s.sol` all encode the canonical 5 workers / 3 properties / 3 historical jobs from INTERFACES.md. **Action:** spot-check the three agree (handles, ENS names, reputations) so a judge sees the same data in mock and live modes.

## Credentials still needed to go live (mirror of the user ask)

`ANTHROPIC_API_KEY`; Arc RPC + funded deployer/agent wallet (faucet) + `USDC_ADDRESS`; Sepolia funded controller + `ward-agent.eth`; Vercel + Railway deploy method; Supabase URL/keys; CRE reporter/account (pending spike). Exact wallet addresses to fund come from the CRE+Arc spike agent.
