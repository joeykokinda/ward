# WARD — STATUS (resume anchor)

**Last updated 2026-06-13.** If you're resuming with fresh context: read this top-to-bottom, then `README.md` + `BOUNTY-AUDIT.md`. Memory index: `~/.claude/projects/-home-rex-Projects-web3-EthGlobal2026/memory/MEMORY.md`.

## TL;DR
WARD is judge-ready. **All three bounties (Chainlink CRE · Arc · ENS) materially PASS**, plus the ETHGlobal Finalist play (the animated floor-plan hero). It's a working **ERC-8183 (Agentic Commerce)** implementation live on Arc testnet: a home agent (Client) hires a field tech (Provider), escrows USDC, and a Chainlink CRE workflow (Evaluator) releases it when device telemetry attests the fix. Frontend live on Vercel; backend live on `brach`. What's left is human-only (record video, ENS Sunday booth, rotate keys) + one in-flight UI polish.

## Live endpoints / addresses
| Thing | Value |
|---|---|
| Live demo (Vercel, floor-plan hero, mock cinematic + live ENS + real Arc history) | https://web-nine-ashen-75.vercel.app |
| Repo | https://github.com/joeykokinda/ward |
| Backend sim (brach, Tailscale Funnel) | https://brach.taild3399f.ts.net |
| Backend agent SSE (brach, LIVE on ERC-8183) | https://brach.taild3399f.ts.net:8443 |
| Arc WardEscrow (ERC-8183, verified) | `0xe118A51B105DF46F54AE4Fb01a1EF43F6a8dE5D8` |
| Arc WorkerRegistry (verified) | `0x2bdDf43350A5E79cf4fCc2A15f4a6905f9553bB4` |
| Arc Evaluator (CRE oracle EOA) | `0xDdd0047d0664235998791fe2163Bb9b31c2Fc038` |
| Arc USDC (native, 6dp, also gas) | `0x3600000000000000000000000000000000000000` |
| Agent/deployer wallet (~9.8 USDC) | `0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4` |
| Worker `mike.ward-agent.eth` | `0xA39542BedbF17c63a6c5543Da4460DCd9bBadECE` |
| ENS (Sepolia) | `ward-agent.eth` (ENSIP-25 verify=YES) + mike/sara/deon/lena/raj subnames |
| Arc | chainId 5042002 · RPC https://rpc.testnet.arc.network · explorer https://testnet.arcscan.app |
| CRE | green sim `cre/sim-output-live.txt` · chain-selector 3034092155422581607 · forwarder 0x76c9…E62 |

## Bounty status — all PASS (see BOUNTY-AUDIT.md for the verified run)
- **Chainlink CRE** ✅ — green CLI simulation fetches the live device API → consensus → WriteReport that drives `complete()`. The CRE workflow IS the ERC-8183 Evaluator. (Honest: sim settle is the qualifying dry-run; on-chain `complete()` is signed by the evaluator EOA, not yet the live DON forwarder.)
- **Arc — Advanced Stablecoin Logic** ✅ — WardEscrow (ERC-8183) holds native USDC, auto-releases on attestation; both contracts source-verified on Blockscout; full lifecycle settled live (DEMO-EVIDENCE.md), ~12s end-to-end, 56 forge tests.
- **ENS — AI Agents** ✅ — ward-agent.eth ENSIP-25 verify=YES; 5 worker subnames with ENSIP-26 records + live reputation pointers (discover ranks mike, live rep); resolved live in the UI (`/api/ens`), zero hardcoded. HARD GATE: present at the ENS booth Sunday morning, in person.

## What's done (committed + pushed to main)
6 components built + verified; ERC-8183 contract live + verified on Arc; agent autonomous (one-job guard, auto-complete, evaluator signs complete); CRE green sim; ENS live + hardened on Sepolia; animated floor-plan hero deployed (light Profound) with live ENS + real clickable Arc history; backend live + persistent on brach; docs consolidated (judge-facing at root, internal in `docs/`); per-bounty SUBMISSION.md; PITCHES.md (booth scripts + objection answers); VIDEO-SCRIPT.md (3-min); BOUNTY-AUDIT.md.

## In flight / pending
- **(in flight) UI polish** — floor-plan made architectural (shared walls, door arc), calmer healthy palette so faults pop, better hierarchy, balanced layout (activity feed not cut off). When it lands: `git add web/ && commit`, then redeploy (command below), verify the leak animation + modals + live ENS still work, and that the UX reads clearly (obvious CTA, what's clickable, narrative reasoning).
- **(human-only) Record the 2–3 min demo video** using VIDEO-SCRIPT.md (can't screen-capture from here).
- **(human-only, HARD GATE) ENS booth, Sunday morning, in person.**
- **(human-only) Rotate the Anthropic API key + Vercel token** (both pasted in chat; in gitignored local `.env`).
- **(optional) Pre-stage more Arc history** — trigger a few more live incidents (each ~1 USDC) so the feed shows 20+ real settled jobs by Sunday.

## Resume commands
- Redeploy frontend (Vercel): `cd web && pnpm dlx vercel@latest deploy --prod --yes --scope speks-projects-7a61d7b1 --token $VERCEL_TOKEN` with build-env `NEXT_PUBLIC_ARC_EXPLORER=https://testnet.arcscan.app NEXT_PUBLIC_ARC_CHAIN_ID=5042002 NEXT_PUBLIC_JOB_ESCROW=0xe118… NEXT_PUBLIC_WORKER_REGISTRY=0x2bdD… NEXT_PUBLIC_USDC_ADDRESS=0x3600…` and env `SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com`. Token is in gitignored `.env`.
- Drive a live incident: `curl -X POST https://brach.taild3399f.ts.net:8443/incident/simulate -d '{"deviceId":"home-leak","mode":"hard"}'`, watch `…:8443/events/recent`, then `curl -X POST https://brach.taild3399f.ts.net/reset`.
- Local full stack (no creds): `scripts/dev-stack.sh up`. Contracts: `cd contracts && export PATH=$HOME/.foundry/bin:$PATH && forge test`.
- brach is LIVE; re-wire only if needed: re-scp `spike/arc/.env` → `bash scripts/brach-live.sh` on brach.
- Live keys (gitignored, on the dev box): `spike/arc/.env` (Arc deployer/worker/evaluator + Anthropic), root `.env` (Anthropic + Vercel token).

## Doc map
Root (judge-facing): README · PROJECT · ARCHITECTURE (mermaid) · BOUNTIES · DEMO · DEMO-EVIDENCE · PITCHES · SUBMISSION · VIDEO-SCRIPT · BOUNTY-AUDIT · STATUS. Internal: `docs/` (SPIKES, CUTS, INTEGRATION, TODO, BACKEND-SETUP, INTERFACES, DEPLOY, DESIGN).

## Honest gaps (documented, not hidden)
- CRE: sim settle is a dry-run (the qualifying bar); live on-chain `complete()` is evaluator-EOA-signed, not yet routed through the DON forwarder. Fully-autonomous live-DON settle would need the workflow to take a dynamic jobId.
- Devices are simulated (intentional; the CRE trust pipeline is identical for real device APIs — PITCHES.md Q3).
- Live job amount is 1 USDC (faucet-bounded); the demo narrative shows 150 USDC (the mock cinematic). Real settled jobs are small but real.
