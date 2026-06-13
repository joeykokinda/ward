# WARD — STATUS (resume here)

**Last updated: 2026-06-13.** Single source of truth for current state. To resume: read this, then `README.md` / `docs/INTEGRATION.md` / `DEMO-EVIDENCE.md`.

## TL;DR
All three bounties are proven on real infra: ERC-8183 contract live + fully settled on Arc (56 tests), Chainlink CRE green CLI sim, ENS live on Sepolia (`ward-agent.eth` + 5 subnames, ENSIP-25/26 + CAIP-10 reputation pointers). Frontend = animated floor-plan hero in light Profound, deployed live at the Vercel URL (currently mock-data mode). Remaining: flip the live `brach` agent + frontend from mock to the live ERC-8183 contract (batched re-wire, in progress), then redeploy. Everything is committed/pushed to `github.com/joeykokinda/ward` (main).

## Live endpoints / addresses
| Thing | Value |
|---|---|
| Frontend (Vercel, **floor-plan hero, light Profound**, mock-data mode) | https://web-nine-ashen-75.vercel.app |
| Sim (brach, public) | https://brach.taild3399f.ts.net |
| Agent SSE (brach, public, **flip to LIVE in progress**) | https://brach.taild3399f.ts.net:8443 |
| Arc WardEscrow (ERC-8183) | `0xe118A51B105DF46F54AE4Fb01a1EF43F6a8dE5D8` |
| Arc WorkerRegistry | `0x2bdDf43350A5E79cf4fCc2A15f4a6905f9553bB4` |
| Arc Evaluator | `0xDdd0047d0664235998791fe2163Bb9b31c2Fc038` |
| Arc USDC (native, 6dp, also gas) | `0x3600000000000000000000000000000000000000` |
| Agent/deployer wallet (~18 USDC) | `0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4` |
| ENS agent name (Sepolia, ENSIP-25 verified) | `ward-agent.eth` (register tx `0x093751c8…`) |
| ENS worker subnames (Sepolia, ENSIP-26 + CAIP-10 rep) | `mike` / `sara` / `deon` / `lena` / `raj`.`ward-agent.eth` |
| Worker `mike.ward-agent.eth` (Arc registry) | `0x6d7Bc6A9Ce537950a878A97E9669B48305B0f033` |
| Arc | chainId 5042002 · RPC https://rpc.testnet.arc.network · explorer https://testnet.arcscan.app |
| CRE Arc forwarder / chain-selector | `0x76c9…E62` / `3034092155422581607` |

## Bounty status
- **Arc (USDC conditional escrow, ERC-8183)** — ✅ PROVEN: full ERC-8183 lifecycle settled on-chain (DEMO-EVIDENCE.md, complete tx `0x0cf9c5a6…`); 56 contract tests pass. Architecture diagram in ARCHITECTURE.md.
- **Chainlink CRE** — ✅ EVIDENCE: `cre workflow simulate --target local-simulation-settings` green against the live sim → dry-run WriteReport → settled (cre/sim-output-live.txt). Live-DON deploy optional (Chainlink deploys qualifying sims).
- **ENS (AI agents, ENSIP-25/26)** — ✅ LIVE on Sepolia: `ward-agent.eth` registered + ENSIP-25 verified (register tx `0x093751c8…`); 5 worker subnames (mike/sara/deon/lena/raj) with ENSIP-26 text records (skills, region, reputation) + CAIP-10 reputation pointers; agent discovers + ranks workers via ENS resolution. HARD GATE: present at ENS booth Sunday AM.

## What's done (committed)
- **ERC-8183 WardEscrow live on Arc** — full Job lifecycle (createJob → setBudget → fund → submit → complete) settled on-chain; 56 contract tests pass. Evaluator-only `complete()` releases USDC + bumps reputation.
- **Chainlink CRE** — green CLI simulation against the live sim → dry-run WriteReport → settled (cre/sim-output-live.txt). Arc chain-selector `3034092155422581607`, forwarder `0x76c9…E62`.
- **ENS live on Sepolia** — `ward-agent.eth` (ENSIP-25 verified) + 5 worker subnames with ENSIP-26 records + CAIP-10 reputation pointers. Agent discovery via ENS resolution.
- **Agent autonomy fixed + wired to ERC-8183** — poll → diagnose → L1 self-fix → L3 dispatch → createJob/fund on WardEscrow.
- **Frontend** — animated floor-plan hero in light Profound aesthetic, deployed live to Vercel (mock-data mode), three personas.
- **Backend** (sim + agent) persistent on brach via Tailscale Funnel.
- **Docs consolidated** — README, PROJECT, ARCHITECTURE(+mermaid), BOUNTIES, DEMO, PITCHES, DESIGN, SUBMISSION, CUTS, SPIKES, INTERFACES, INTEGRATION, DEMO-EVIDENCE, DEPLOY, BACKEND-SETUP.

## PENDING
1. **Flip the live `brach` agent to the ERC-8183 contract (IN PROGRESS).** Batched re-wire: re-scp `spike/arc/.env` (now carries the evaluator key) + `spike/arc/.env.worker.json` to brach → `git pull` on brach → `bash scripts/brach-live.sh`. Expect `/healthz` shows `"chain":"LIVE"` and the agent creating/funding live ERC-8183 Jobs on WardEscrow.
2. **After brach is LIVE (then Claude / autonomous):** wire live ENS resolution into the floor plan (resolve `ward-agent.eth` + subnames, render ENSIP-26 records + reputation in the UI) → flip the frontend to the live data adapter → redeploy to Vercel (`NEXT_PUBLIC_DATA_ADAPTER=live`, `NEXT_PUBLIC_AGENT_URL=https://brach.taild3399f.ts.net:8443`, live deployment addresses).
3. **Pre-stage more real Arc history** for the activity feed (cast cycle; ~0.0014 USDC/tx; recycle USDC worker→agent) so the app shows dozens of historical txs by Sunday.
4. **Backup demo video** — ≤3-min screen recording of a perfect run, on the phone, played if anything breaks live.
5. **Timed test pass** — full end-to-end dry run against the live stack on a clock, to nail the 90-second booth flow + verify the live URL from a phone on cell data.

## Honest gaps / notes
- Live demo settles via the escrow's MockCreVerifier; fully-autonomous live CRE-DON settle needs the workflow to take a dynamic jobId (currently static) — documented, not faked. CRE green sim is the bounty bar.
- Worker on-chain = mike only (1 registered worker); frontend mock fixtures show 5 for visuals. Register more on Arc later for richer live roster if desired.
- **Secrets pasted in chat (ROTATE after event): Anthropic API key, Vercel token.** Both in gitignored local `.env`. Testnet private keys live in `spike/arc/.env` + `spike/arc/.env.worker.json` (gitignored).

## Resume commands
- Local full stack: `scripts/dev-stack.sh up`
- Flip brach live: re-scp `spike/arc/.env` (evaluator key) + `.env.worker.json` → `git pull` on brach → `bash scripts/brach-live.sh` (on brach)
- Redeploy frontend live (after brach LIVE): `cd web && pnpm dlx vercel@latest deploy --prod --yes --scope speks-projects-7a61d7b1 --token $VERCEL_TOKEN` with `NEXT_PUBLIC_DATA_ADAPTER=live` + agent URL + live addresses
- Plans/strategy: judge-facing docs at root; internal docs under `docs/`. Memory index: `~/.claude/projects/-home-rex-Projects-web3-EthGlobal2026/memory/MEMORY.md`.
