# WARD — Live Deploy Runbook

Local stack already works with zero credentials: `scripts/dev-stack.sh up` (proven end-to-end on anvil). This runbook turns the filled-in `.env` into a live deployment. Do the phases in order; each says exactly what credential it needs. Arc values in `.env.example` are prefilled and verified.

## Prereqs
- `cp .env.example .env` and fill the BLANKs (see each phase).
- `export PATH="$HOME/.foundry/bin:$HOME/.cre/bin:$HOME/.local/bin:$PATH"`
- `set -a; source .env; set +a`

## L1 — Contracts on Arc  *(needs: funded DEPLOYER_PRIVATE_KEY)*
1. Fund the deployer: open https://faucet.circle.com → Arc Testnet → USDC → address `0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4` (or your own key's address). 20 USDC covers gas (gas is USDC on Arc) + escrow float.
2. `mkdir -p deployments`
3. `cd contracts && forge script script/Deploy.s.sol --rpc-url "$ARC_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --slow && ./export-abis.sh && cd ..`
   - Use `USDC_ADDRESS=0x3600000000000000000000000000000000000000` (native Arc USDC) — NOT MockUSDC.
4. Verify on Blockscout: `forge verify-contract <addr> <Contract> --verifier blockscout --verifier-url https://testnet.arcscan.app/api` (no API key).
5. Writes `deployments/5042002.json` + ABIs — frontend/agent read these.

## L2 — Chainlink CRE  *(needs: free CRE_API_KEY; then CRE deploy access + funded CRE key)*
1. Get `CRE_API_KEY` at app.chain.link → Account Settings.
2. **Bounty evidence:** `cd cre && cre workflow simulate ...` → capture the passing log (point its config at a reachable device-status URL; see L3 for the public sim URL).
3. Deploy `WardCreConsumer` to Arc (forge), then set it as the escrow verifier: `cast send <JobEscrow> "setCreVerifier(address)" <WardCreConsumer> --rpc-url "$ARC_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY"`. (This is the CRE-push path = the authentic "CRE releases escrow" demo; see INTEGRATION.md decision.)
4. `cre account access` + fund `CRE_ETH_PRIVATE_KEY`, then deploy the workflow live; set its trigger config to fetch the public sim URL (L3) and write to `WardCreConsumer`.
   - Fallback if live CRE deploy is delayed: keep `AuthorizedReporterVerifier`, set the agent's key as the authorized reporter, and implement the reporter ECDSA in `chain.py.request_attestation` (INTEGRATION.md Open #A).

## L3 — Sim + Agent public  *(needs: Railway token or use cloudflared; ANTHROPIC_API_KEY)*
- Sim: deploy `sim/` to Railway (Dockerfile + railway.json ready) → public HTTPS URL. Interim: `cloudflared tunnel --url http://localhost:8090`.
- Agent: deploy `agent/` to Railway with live env: `ARC_RPC_URL`, `ARC_CHAIN_ID=5042002`, funded `AGENT_PRIVATE_KEY`, `USDC_ADDRESS=0x3600…`, `WARD_DEPLOYMENTS_DIR`, `SIM_BASE_URL`=public sim, `ANTHROPIC_API_KEY`, `SUPABASE_*`. Exposes the SSE feed.
- Point the CRE workflow (L2) at the public sim URL.

## L4 — ENS on Sepolia  *(needs: funded CONTROLLER_PRIVATE_KEY; confirm ward-agent.eth available)*
1. Register `ward-agent.eth` on Sepolia from the controller (Sepolia ETH for gas) and wrap via NameWrapper.
2. Set `WARD_AGENT_REGISTRY`/`WARD_AGENT_ID`/`WARD_AGENT_CHAIN_ID` and the ENSIP-25 `agent-registration[...]="1"` record.
3. `cd packages/ens && pnpm mint-subname mike --execute` (repeat: sara, deon, lena, raj) — sets ENSIP-26 + worker records. Verify with `pnpm resolve mike.ward-agent.eth` and `pnpm discover --skill plumbing`.

## L5 — Supabase  *(needs: project URL + anon + service-role keys)*
1. Create a free Supabase project. `cd db`, apply `migrations/0001_init.sql` then `seed/0001_seed.sql` (SQL editor, `supabase` CLI, or psql — see db/README.md).
2. Put `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in the agent env; `NEXT_PUBLIC_SUPABASE_*` in Vercel.

## L6 — Frontend on Vercel  *(needs: connect repo OR VERCEL_TOKEN)*
- Connect `joeykokinda/ward` in the Vercel dashboard (root dir `web/`) — auto-deploys on push. Or `cd web && vercel --prod` with `VERCEL_TOKEN`.
- Env: `NEXT_PUBLIC_DATA_ADAPTER=live`, `NEXT_PUBLIC_AGENT_URL`=public agent SSE, `NEXT_PUBLIC_DEPLOYMENTS`/addresses from `deployments/5042002.json`, `NEXT_PUBLIC_ARC_EXPLORER=https://testnet.arcscan.app`, `NEXT_PUBLIC_SUPABASE_*`.

## L7 — Demo prep (SUBMISSION.md gates)
- Pre-stage history: run several incidents on live Arc so the activity feed shows real settled jobs by Sunday.
- Record the ≤3-min video (Saturday evening). Print the worker-view QR. Confirm the live URL works from a phone on cell data.
- Sunday morning: ENS booth in person (hard gate). Booth pitches in PITCHES.md.

## Smoke test (after L1–L6)
Trigger a hard fault on the public sim for prop-2 → watch the dashboard stream the incident → CRE attests → escrow releases on Arc → tx links resolve on Blockscout → worker subname + reputation update. Reset between runs.
