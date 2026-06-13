# WARD — Proof-of-Physical-Work

**An autonomous property operations agent that hires humans and settles payment on machine-attested telemetry, not human approval.**

WARD monitors instrumented properties and DePIN nodes. When something breaks it attempts a software self-fix; when that fails it escrows USDC on Arc, dispatches a verified worker discovered via ENS, and a Chainlink CRE workflow releases payment the moment device telemetry confirms the repair. Owner approves jobs over a threshold; everything below runs autonomously.

Built solo at ETHGlobal New York 2026.

## Docs

| File | What |
|---|---|
| [PROJECT.md](PROJECT.md) | Product, novel primitive, wedge market, roadmap |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, chains, services, fallbacks |
| [BOUNTIES.md](BOUNTIES.md) | The three bounties + finalist target, hard gates |
| [DEMO.md](DEMO.md) | Three personas, pre-staged state, 90-second live flow |
| [PITCHES.md](PITCHES.md) | Booth scripts: Chainlink / Arc / ENS |
| [DESIGN.md](DESIGN.md) | Tokens, persona layouts, aesthetic bans |
| [SUBMISSION.md](SUBMISSION.md) | Per-bounty submission gates |
| [CUTS.md](CUTS.md) | Pre-committed cut rules |
| [SPIKES.md](SPIKES.md) | CRE→Arc question, spike plans, decision matrix |
| [TODO.md](TODO.md) | Live progress, state, blockers — start here to resume |

## Stack

Arc testnet (USDC escrow + worker registry, Foundry) · Chainlink CRE (telemetry attestation → settlement) · ENS Sepolia (agent identity + worker subnames, ENSIP-25/26) · Python agent (asyncio, web3.py, Claude API) · Next.js on Vercel (Host / Worker / Agent personas) · FastAPI device simulator on Railway/Fly · Supabase (persistent demo state).
