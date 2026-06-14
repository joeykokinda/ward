# WARD — STATUS (resume anchor)

**Last updated 2026-06-13.** If you're resuming with fresh context: read this top-to-bottom, then `README.md` + `BOUNTY-AUDIT.md`. Memory index: `~/.claude/projects/-home-rex-Projects-web3-EthGlobal2026/memory/MEMORY.md`.

## TL;DR
WARD is judge-ready. **All three bounties (Chainlink CRE · Arc · ENS) materially PASS**, plus the ETHGlobal Finalist play. Positioning (the primitive): WARD is rails for an autonomous system to hire and pay a verified human for physically-verifiable work, with settlement, identity, and reputation on-chain. The instrumented home is the first instance, not the product. Crypto is load-bearing only at L3 (paying a human); the buyers that need it are software with no bank account (property managers, DePIN fleets, DAO treasuries, agent wallets). It's a working **ERC-8183 (Agentic Commerce)** implementation live on Arc testnet: a home agent (Client) hires a field tech (Provider), escrows USDC, and a Chainlink CRE workflow (Evaluator) releases it when device telemetry attests the fix.

**The agent climbs an escalation ladder, cheapest first, not "always hires a human":** L1 self-fix (free, instant, software: reboot/reconfigure/re-pair/cycle a relay/close a valve, most incidents end here), optional L2 guided remote, then L3 hire a human (escrowed, proof-settled) only when the fault is physical and software can't resolve it, within the owner's spending policy. In the demo the WiFi fault self-fixes at L1 (remote reboot, no human, no escrow); the 2am leak fails L1 (burst is upstream of the valve) and escalates to L3 (hire a plumber). Workers are discovered and ranked live via ENS (skill match, ETA, on-chain reputation); there is a **/workers registry page** in the app. The full agent policy is specced in `docs/AGENT-PLAYBOOK.md`.

**Roadmap (one line, not the pitch).** The same rails scale from the home to property managers, DePIN fleets, and DAO treasuries; hardware sensor devices are a later step.

Frontend live on Vercel; backend live on `brach`. **THE JUDGE DEMO IS NOW `/live`: the real agent, end-to-end.** A judge clicks a fault and the real brach agent diagnoses (Claude), tries L1, funds a real USDC escrow on Arc, dispatches a worker, and the CRE evaluator releases payment, all in ~10s with clickable real txns. Verified end-to-end through the deployed Vercel proxy on 2026-06-13 (Job #5, later Job #7 settled, txns mined status 0x1). `/live` proxies brach via server-side routes (`/api/live/*`) to avoid CORS. `/demo` is the scripted narrated walkthrough of the same flow (reliable fallback); `/` is the homepage. What's left is human-only: record the video, ENS Sunday booth, rotate the chat-exposed keys.

**`/live` UI redesign shipped + deployed 2026-06-13 (paced + judge-friendly).** The page now buffers the agent feed and reveals one line every ~1.7s (Pause/Resume + "Jump to live" + `+N queued`), so a judge can read each line and click the on-chain links as they appear instead of getting a ~10s flood. Adds a 5-phase stepper (Detect→Diagnose→Hire→Repair→Verify), a derived Active on-chain job card (job#, amount, worker ENS, live elapsed timer, state badge, fund+release tx links), and a sticky "Deployed on Arc" contracts panel (Escrow/Registry/USDC/Evaluator, copy + arcscan links). New `web/lib/arc.ts` holds verified Arc addresses (env-overridable); `deriveIncident()` in `web/app/live/page.tsx` parses the event stream. build/lint green. **Faucet now ~3.8 USDC (~3 runs left)** — conserve for video + booth.

## Live endpoints / addresses
| Thing | Value |
|---|---|
| Live homepage (Vercel) | https://web-nine-ashen-75.vercel.app |
| **Live agent (REAL, judge demo, real Arc txns)** | **https://web-nine-ashen-75.vercel.app/live** |
| Demo (scripted cinematic walkthrough) | https://web-nine-ashen-75.vercel.app/demo |
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
6 components built + verified; ERC-8183 contract live + verified on Arc; agent autonomous (one-job guard, auto-complete, evaluator signs complete); CRE green sim; ENS live + hardened on Sepolia; two-page dark mission-control frontend deployed (homepage `/` + cinematic `/demo`) with live ENS + real clickable Arc tx links; backend live + persistent on brach; docs consolidated (judge-facing at root, internal in `docs/`); per-bounty SUBMISSION.md; PITCHES.md (booth scripts + objection answers); VIDEO-SCRIPT.md (3-min); BOUNTY-AUDIT.md.

## In flight / pending
- **(DONE, shipped + deployed) Two-page dark redesign** — homepage at `/` (single-scroll explainer) + cinematic at `/demo` (dark mission-control tokens, intro overlay, bottom-center 5-phase HUD DETECT/DIAGNOSE/HIRE/REPAIR/VERIFY, right actor strip, ENS-labeled walking worker, human-readable 3-latest on-chain strip, corner trigger panel + reset). Cinematic tx links point at real ARC_TX WardEscrow hashes. build/lint/56 forge tests green.
- **(human-only) Record the 3:00–3:30 demo video** using VIDEO-SCRIPT.md, real voice, real screen capture (OBS/ScreenStudio), 720p+, no speed-ups, no phone. Record `/` (three-actors) then `/demo` end-to-end.
- **(human-only, HARD GATE) ENS booth, Sunday morning, in person.**
- **(human-only) Rotate the Anthropic API key + Vercel token** (both pasted in chat; in gitignored local `.env`).
- **(verify) Rule 1 (from-scratch):** first commit is Fri 2026-06-12 21:19 (docs scaffold). Confirm that is after the official kickoff time; if kickoff was Saturday, disclose in README.
- **(DONE 2026-06-13) Pre-staged Arc history** — 3 more leak incidents settled (#8/#9/#10); live feed now shows settled jobs #7–#10. Treasury was refilled first by recycling 6 USDC from Mike's wallet → agent (see Resume commands), so agent is **~6.8 USDC (~6 runs)** for video + booth, and refillable again from Mike (5.48) if it gets low. All 3 verified on-chain (status 0x1), agent returned to clean idle, all devices healthy.

## Resume commands
- Redeploy frontend (Vercel): `cd web && pnpm dlx vercel@latest deploy --prod --yes --scope speks-projects-7a61d7b1 --token $VERCEL_TOKEN` with build-env `NEXT_PUBLIC_ARC_EXPLORER=https://testnet.arcscan.app NEXT_PUBLIC_ARC_CHAIN_ID=5042002 NEXT_PUBLIC_JOB_ESCROW=0xe118… NEXT_PUBLIC_WORKER_REGISTRY=0x2bdD… NEXT_PUBLIC_USDC_ADDRESS=0x3600…` and env `SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com`. Token is in gitignored `.env`.
- Drive a live incident: `curl -X POST https://brach.taild3399f.ts.net:8443/incident/simulate -d '{"propertyId":"home-leak","mode":"hard","autoComplete":true}'`, watch `…:8443/events/recent`, then `curl -X POST https://brach.taild3399f.ts.net/reset`. **Wait ~5s between triggers** — the agent polls every ~5s and the one-open-job-per-property guard dedups rapid re-triggers (a too-fast second click is a no-op, not a new job).
- **Refill the agent treasury (prevents the demo running dry).** Each settled job moves 1 USDC agent→Mike permanently; Mike is the sink. Recycle it back while the agent is IDLE (no active incident, avoids a nonce clash on Mike's key): `set -a; source spike/arc/.env; set +a; export PATH=$HOME/.foundry/bin:$PATH; cast send 0x3600000000000000000000000000000000000000 "transfer(address,uint256)" 0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4 <amount_6dp> --rpc-url https://rpc.testnet.arc.network --private-key $WORKER_PRIVATE_KEY` (USDC is the 6dp ERC20 at 0x3600; 6 USDC = `6000000`). Leave Mike ≥1 USDC for submit() gas. Balances on 2026-06-13 after refill+prestage: agent 6.78, Mike 5.48, evaluator 0.98 (~13.2 total in the ecosystem). Settled-job history in the live feed: #7–#10.
- Local full stack (no creds): `scripts/dev-stack.sh up`. Contracts: `cd contracts && export PATH=$HOME/.foundry/bin:$PATH && forge test`.
- brach is LIVE; re-wire only if needed: re-scp `spike/arc/.env` → `bash scripts/brach-live.sh` on brach.
- Live keys (gitignored, on the dev box): `spike/arc/.env` (Arc deployer/worker/evaluator + Anthropic), root `.env` (Anthropic + Vercel token).

## Doc map
Root (judge-facing): README · PROJECT · ARCHITECTURE (mermaid) · BOUNTIES · DEMO · DEMO-EVIDENCE · PITCHES · SUBMISSION · VIDEO-SCRIPT · BOUNTY-AUDIT · STATUS. Internal: `docs/` (SPIKES, CUTS, INTEGRATION, TODO, BACKEND-SETUP, INTERFACES, DEPLOY, DESIGN).

## Honest gaps (documented, not hidden)
- CRE: sim settle is a dry-run (the qualifying bar); live on-chain `complete()` is evaluator-EOA-signed, not yet routed through the DON forwarder. Fully-autonomous live-DON settle would need the workflow to take a dynamic jobId.
- Devices are simulated (intentional; the CRE trust pipeline is identical for real device APIs — PITCHES.md Q3).
- Live job amount is 1 USDC (faucet-bounded); the demo narrative shows 150 USDC (the mock cinematic). Real settled jobs are small but real.
