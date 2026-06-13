# TODO / Progress Tracker

**Status: docs + strategy locked. WAITING for rex's explicit "begin building" command. No code, no spikes, no deploys until then.** The CRE integration additionally waits for the Chainlink booth answer (SPIKES.md).

## Before code (today, event floor)

- [ ] Workshop Room 2: Arc 4:00pm, Chainlink 4:30pm, ENS 5:30pm.
- [ ] **Chainlink booth: does CRE write to Arc testnet?** (gates the architecture) + lock in their deploy-it-live offer.
- [ ] Arc booth: confirm which bounty the conditional escrow belongs to (default: Advanced Stablecoin Logic), faucet/RPC details.
- [ ] ENS booth: ENSIP-25/26 reference implementations; confirm Sunday-morning presentation logistics.

## On "begin building"

1. Run Spike A (CRE, per booth answer) + Spike B (Arc testnet + USDC) as parallel Opus agents — briefs in SPIKES.md.
2. Decision matrix picks topology → fan out contracts / sim / frontend agents.
3. **Commit early, commit often** (see Non-negotiables in SUBMISSION.md): small interval commits all weekend, real dates, push to origin regularly.

## Build tasks (strict gates, verify each before next)

- [ ] 1. Spikes A + B (go/no-go, SPIKES.md)
- [ ] 2. Contracts on Arc: WorkerRegistry + JobEscrow (caps, owner threshold, CRE-gated settle, deadline refund) — Foundry, tests, deploy + verify
- [ ] 3. CRE workflow: telemetry fetch → verify resolved → settle (ANCHOR deliverable; simulation captured)
- [ ] 4. Device simulator (FastAPI): per-property devices, /status /kill?mode=soft|hard /restart /repair, console page → Railway/Fly public HTTPS
- [ ] 5. Agent (plain Python): poll → Claude diagnose → L1 reboot → registry query → escrow → monitor → trigger CRE → confirm settle; decision feed
- [ ] 6. Frontend (Next.js, DESIGN.md): Host / Worker / Agent personas, QR worker flow, Arc explorer links, ENS names live
- [ ] 7. Supabase persistence: jobs, feed, reputation cache — state survives across judge visits
- [ ] 8. Live deployment EARLY: Vercel + Railway; self-recovering public demo loop, rate-limited, spend-capped
- [ ] 9. ENS: ward-agent.eth + worker subnames, ENSIP-26 records, ENSIP-25 verification, discovery via resolution
- [ ] 10. Pre-staged state: 3 properties, 5 workers, 500 USDC agent wallet, 3+ historical jobs; reset button
- [ ] 11. Demo engineering + submission: SUBMISSION.md every box; video Saturday evening; QR printed; backup recording on phone
- [ ] 12. **Sunday morning: ENS booth in person (HARD GATE)**

## State

- Toolchain verified: forge/cast 1.7.1 (`~/.foundry/bin`), uv 0.11.21 (use `--python 3.12`), node 26 + pnpm 11.3, cloudflared. Railway CLI not yet installed (interactive login later).
- Git: repo at github.com/joeykokinda/ward (see Decisions). Commit dates are real, never backdated.
- Wallets / deployments / endpoints: none yet. Fill in here as they appear.
- Obsolete: `spike/` Flare-era artifacts removed with the v2 re-anchor.

## Decisions log

- 2026-06-12: Three bounties LOCKED: Chainlink CRE (anchor) + Arc conditional escrow + ENS AI-agents (ENSIP-25/26, + Integrate-ENS pool). Finalist track targeted. Nothing else, even easy wins.
- 2026-06-12: Demo skin: Airbnb-first (3 named properties, router failure, 75 USDC job), DePIN as roadmap line. Three personas: Host / Worker / Agent.
- 2026-06-12: Plain Python agent (no uAgents). Audit = Arc events. Supabase for persistent demo state. Owner HITL above spending threshold.
- 2026-06-12: Cut rules pre-committed (CUTS.md): 2-hour blocker rule; anchors never cut; Arc fallback = Base Sepolia disclosed honestly.
- 2026-06-12: Commit discipline: interval commits showing real weekend progression, no 1000-line dumps, no backdating — DQ risk otherwise.
- 2026-06-12: CRE build gated on Chainlink booth answer; everything gated on rex's "begin building".

## Blockers

- Waiting: rex's "begin building" command.
- Waiting: Chainlink booth answer on CRE→Arc.
- Arc faucet process unknown (Spike B reports; may need a manual browser step).
