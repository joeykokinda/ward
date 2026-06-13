# WARD — STATUS (resume here)

**Last updated: 2026-06-13.** Single source of truth for current state. To resume: read this, then `README.md` / `INTEGRATION.md` / `DEMO-EVIDENCE.md`.

## TL;DR
Both anchor bounties are proven on real infra. Frontend is live (mock mode). Two user actions remain to fully wire the live demo: (1) flip the `brach` agent to live chain, (2) ENS subname owner key. Everything is committed/pushed to `github.com/joeykokinda/ward` (main).

## Live endpoints / addresses
| Thing | Value |
|---|---|
| Frontend (Vercel, mock mode) | https://web-nine-ashen-75.vercel.app |
| Sim (brach, public) | https://brach.taild3399f.ts.net |
| Agent SSE (brach, public, **DRY**) | https://brach.taild3399f.ts.net:8443 |
| Arc JobEscrow | `0x5585487A2EbabbE72406b72d5278dDFc5Ed706d8` |
| Arc WorkerRegistry | `0xc59fabC06Cd268F826a905Cc13eD232a90A79CAc` |
| Arc CreVerifier (MockCreVerifier) | `0x985e4CCEb3ff73C60b3F9FbF2044B4cF394b267A` |
| Arc USDC (native, 6dp, also gas) | `0x3600000000000000000000000000000000000000` |
| Agent/deployer wallet (~18 USDC) | `0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4` |
| Worker `mike.ward-agent.eth` | `0x6d7Bc6A9Ce537950a878A97E9669B48305B0f033` |
| ENS agent name (registered) | `ward-agent.eth` (owner `0x87Ab…8521`) |
| Arc | chainId 5042002 · RPC https://rpc.testnet.arc.network · explorer https://testnet.arcscan.app |
| CRE Arc forwarder / chain-selector | `0x76c9…E62` / `3034092155422581607` |

## Bounty status
- **Arc (USDC conditional escrow)** — ✅ PROVEN: full lifecycle settled on-chain (DEMO-EVIDENCE.md, settle tx `0x4e3d320e…`). Architecture diagram in ARCHITECTURE.md.
- **Chainlink CRE** — ✅ EVIDENCE: `cre workflow simulate --target local-simulation-settings` green against the live sim → dry-run WriteReport → settled (cre/sim-output-live.txt). Live-DON deploy optional (Chainlink deploys qualifying sims).
- **ENS (AI agents, ENSIP-25/26)** — 🟡 PARTIAL: name registered; `packages/ens` implements ENSIP-25 verify + ENSIP-26 records + dry-run subname mint; live subname minting blocked on owner key (below). HARD GATE: present at ENS booth Sunday AM.

## What's done (committed)
- All 6 components built + individually verified; local anvil end-to-end proven (`scripts/dev-stack.sh`).
- Contracts deployed + wired on Arc; one job settled on-chain.
- Frontend deployed to Vercel (mock mode).
- Backend (sim+agent) persistent on brach via Tailscale Funnel.
- CRE simulation green. Docs: README, PROJECT, ARCHITECTURE(+mermaid), BOUNTIES, DEMO, PITCHES, DESIGN, SUBMISSION, CUTS, SPIKES, INTERFACES, INTEGRATION, DEMO-EVIDENCE, DEPLOY, BACKEND-SETUP.

## PENDING — needs user
1. **Flip brach agent to LIVE chain.** From this dev box, push keys to brach:
   `scp ~/Projects/web3/EthGlobal2026/spike/arc/.env ~/Projects/web3/EthGlobal2026/spike/arc/.env.worker.json rex@100.64.86.64:~/EthGlobalBackend/ward/spike/arc/`
   Then on brach: `cd ~/EthGlobalBackend/ward && git pull && export ANTHROPIC_API_KEY=<key> && bash scripts/brach-live.sh` → expect `"chain":"LIVE"`.
2. **ENS subnames** — provide `ward-agent.eth` owner key (`0x87Ab…8521`), OR set a controlled wallet as its manager, OR run `cd packages/ens && pnpm mint-subname mike --execute` with the owner wallet.

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
- Plans/strategy: `docs`-less now; everything is root `*.md`. Memory index: `~/.claude/projects/-home-rex-Projects-web3-EthGlobal2026/memory/MEMORY.md`.
