# WARD — STATUS (resume here)

**Last updated: 2026-06-13.** Single source of truth for current state. To resume: read this, then `README.md` / `docs/INTEGRATION.md` / `DEMO-EVIDENCE.md`.

## TL;DR
Both anchor bounties are proven on real infra. Frontend is live (mock mode). Two user actions remain to fully wire the live demo: (1) flip the `brach` agent to live chain, (2) ENS subname owner key. Everything is committed/pushed to `github.com/joeykokinda/ward` (main).

## Live endpoints / addresses
| Thing | Value |
|---|---|
| Frontend (Vercel, **v2 light UI live**, mock mode) | https://web-nine-ashen-75.vercel.app |
| Sim (brach, public) | https://brach.taild3399f.ts.net |
| Agent SSE (brach, public, **DRY**) | https://brach.taild3399f.ts.net:8443 |
| Arc WardEscrow (ERC-8183) | `0xe118A51B105DF46F54AE4Fb01a1EF43F6a8dE5D8` |
| Arc WorkerRegistry | `0x2bdDf43350A5E79cf4fCc2A15f4a6905f9553bB4` |
| Arc Evaluator | `0xDdd0047d0664235998791fe2163Bb9b31c2Fc038` |
| Arc USDC (native, 6dp, also gas) | `0x3600000000000000000000000000000000000000` |
| Agent/deployer wallet (~18 USDC) | `0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4` |
| Worker `mike.ward-agent.eth` | `0x6d7Bc6A9Ce537950a878A97E9669B48305B0f033` |
| ENS agent name (registered) | `ward-agent.eth` (owner `0x87Ab…8521`) |
| Arc | chainId 5042002 · RPC https://rpc.testnet.arc.network · explorer https://testnet.arcscan.app |
| CRE Arc forwarder / chain-selector | `0x76c9…E62` / `3034092155422581607` |

## Bounty status
- **Arc (USDC conditional escrow, ERC-8183)** — ✅ PROVEN: full ERC-8183 lifecycle settled on-chain (DEMO-EVIDENCE.md, complete tx `0x0cf9c5a6…`). Architecture diagram in ARCHITECTURE.md.
- **Chainlink CRE** — ✅ EVIDENCE: `cre workflow simulate --target local-simulation-settings` green against the live sim → dry-run WriteReport → settled (cre/sim-output-live.txt). Live-DON deploy optional (Chainlink deploys qualifying sims).
- **ENS (AI agents, ENSIP-25/26)** — 🟡 PARTIAL: name registered; `packages/ens` implements ENSIP-25 verify + ENSIP-26 records + dry-run subname mint; live subname minting blocked on owner key (below). HARD GATE: present at ENS booth Sunday AM.

## What's done (committed)
- All 6 components built + individually verified; local anvil end-to-end proven (`scripts/dev-stack.sh`).
- Contracts deployed + wired on Arc; one job settled on-chain.
- Frontend deployed to Vercel (mock mode).
- Backend (sim+agent) persistent on brach via Tailscale Funnel.
- CRE simulation green. Docs: README, PROJECT, ARCHITECTURE(+mermaid), BOUNTIES, DEMO, PITCHES, DESIGN, SUBMISSION, CUTS, SPIKES, INTERFACES, INTEGRATION, DEMO-EVIDENCE, DEPLOY, BACKEND-SETUP.

## PENDING — needs user
1. **Flip brach agent to LIVE chain.** brach is FULLY STAGED (repo pulled, sim+agent systemd-persistent, `agent/.env` has empty `ANTHROPIC_API_KEY=` placeholder picked up via EnvironmentFile on restart, no key present anywhere on brach). Only two things missing on brach: the secret key files + a real Anthropic key. Steps:
   - a) From this dev box (`linux`), push the keys (will prompt for brach's password):
     `scp ~/Projects/web3/EthGlobal2026/spike/arc/.env ~/Projects/web3/EthGlobal2026/spike/arc/.env.worker.json rex@100.64.86.64:~/EthGlobalBackend/ward/spike/arc/`
   - b) On brach: `cd ~/EthGlobalBackend/ward && export ANTHROPIC_API_KEY=<key> && bash scripts/brach-live.sh` → expect `/healthz` shows `"chain":"LIVE"`.
   - (Anthropic key is also in this dev box's gitignored `.env` if needed.)
   - After `chain:LIVE`, Claude flips the Vercel frontend to the live adapter (next section).
2. **ENS on Sepolia (decided 2026-06-13: use a name I control).** rex's registered `ward-agent.eth` is NOT on mainnet/Sepolia L1 (verified; likely ENS v2/L2) — so we're doing the ENS bounty on **Sepolia with the deployer wallet** instead (seed not needed; seed-derived key deleted). `ward-agent.eth` is available on Sepolia → register it there + mint worker subnames + ENSIP-25/26 records. **BLOCKER: Sepolia ETH** — fund controller `0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4` (currently 0) via a Sepolia faucet (~0.05 ETH covers registration + subname mints). Then Claude registers + mints + wires live resolution.

## PENDING — UI redesign (rex feedback 2026-06-13)
- Current frontend is "slop": too many colors + too many elements on screen, not soothing/calm. **Make it cleaner**: shrink the in-use palette (most text → fg/muted; reserve amber for money/active, green/red for status only; drop the rainbow of per-log-type colors to ~2-3), add whitespace/breathing room, reduce simultaneous dense panels, calmer hierarchy. Keep mission-control identity but restrained (Bloomberg calm, not arcade). Then redeploy to Vercel. See docs/DESIGN.md "Restraint pass".

## PENDING — Claude does (after #1 / autonomous)
- After brach is LIVE: redeploy frontend live → `cd web && pnpm dlx vercel@latest deploy --prod --yes --scope speks-projects-7a61d7b1 --token $VERCEL_TOKEN` with env `NEXT_PUBLIC_DATA_ADAPTER=live`, `NEXT_PUBLIC_AGENT_URL=https://brach.taild3399f.ts.net:8443`, deployment addresses.
- Build more settled-job history on Arc for the activity feed (cast cycle; ~0.0014 USDC/tx; recycle USDC worker→agent).
- Verify contracts on Blockscout (`forge verify-contract … --verifier blockscout`).
- Submission artifacts (task #8): ≤3-min demo video (Sat eve), per-bounty submission text (SUBMISSION.md), confirm live URL from a phone.

## Honest gaps / notes
- Live demo settles via the escrow's MockCreVerifier; fully-autonomous live CRE-DON settle needs the workflow to take a dynamic jobId (currently static) — documented, not faked. CRE green sim is the bounty bar.
- Worker on-chain = mike only (1 registered worker); frontend mock fixtures show 5 for visuals. Register more on Arc later for richer live roster if desired.
- **Secrets pasted in chat (ROTATE after event): Anthropic API key, Vercel token.** Both in gitignored local `.env`. Testnet private keys live in `spike/arc/.env` + `spike/arc/.env.worker.json` (gitignored).

## Resume commands
- Local full stack: `scripts/dev-stack.sh up`
- Redeploy frontend: see above
- Flip brach live: `scripts/brach-live.sh` (on brach)
- Plans/strategy: judge-facing docs at root; internal docs under `docs/`. Memory index: `~/.claude/projects/-home-rex-Projects-web3-EthGlobal2026/memory/MEMORY.md`.
