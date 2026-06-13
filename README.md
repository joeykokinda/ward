# WARD

**WARD is the autonomous agent for your home — it watches everything, fixes what it can, hires someone when it can't, and tells you what happened.**

You're in Tokyo. It's 2am back home. The leak sensor in your Brooklyn apartment triggers. WARD can't self-fix a physical leak, so it discovers and hires Mike (mike.ward-agent.eth, nearby, 4.9 stars), escrows ~150 USDC as an ERC-8183 Job on Arc, and dispatches him. Mike fixes the leak; the moisture sensor reads dry; a Chainlink CRE workflow attests it onchain; the USDC releases. You slept through the whole thing.

Built solo at ETHGlobal New York 2026.

## Three bounties

| Sponsor | What WARD does |
|---|---|
| **Chainlink CRE** | CRE workflow is the ERC-8183 Evaluator — it polls device telemetry, attests the fix onchain, and calls `complete()` to release the escrow. No human approval. |
| **Arc** | The ERC-8183 Job is escrowed and settled on Arc testnet in native USDC. Gas-free economics make sub-$200 dispatch fees viable. |
| **ENS** | Agent identity at `ward-agent.eth`. Workers are subnames (`mike.ward-agent.eth`) with ENSIP-26 text records (skills, region, reputation). Agent discovers workers via ENS resolution; no private database. ENSIP-25 agent verification. |

## ERC-8183 — Agentic Commerce

WARD is the first known production implementation of ERC-8183 (Agentic Commerce standard). The standard defines three roles on a Job: Client, Provider, Evaluator. WARD maps: **Client = home agent, Provider = field tech, Evaluator = Chainlink CRE sensor attestation.** Payment that no human approved — released because the physical world said the job was done.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full component diagram.

```
[Device sim (FastAPI, public HTTPS)]
   ^ poll + remote-fix          ^ HTTP fetch (telemetry)
[WARD agent (Python: asyncio + web3.py + Claude)]    [Chainlink CRE workflow]
   | createJob / dispatch                               | attestation → complete()
   v                                                   v
[Arc testnet: WardEscrow (ERC-8183) + WorkerRegistry + USDC]
   ^                                    ^
[Next.js frontend (Vercel) — Host / Worker / Agent personas]
[Supabase — persistent demo state (jobs, feed, reputation)]
[ENS on Sepolia — ward-agent.eth + worker subnames (ENSIP-25/26)]
```

## How to run

Local full stack (no external credentials needed):

```bash
scripts/dev-stack.sh up
```

Brings up anvil, deploys contracts, seeds workers, starts sim on :8090 and agent on :8091. An end-to-end hard-fault incident settles on anvil with real USDC movement and reputation bump.

Live frontend: https://web-nine-ashen-75.vercel.app

## Docs — judge-facing

| File | What |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, chains, services, fallbacks, Mermaid diagram |
| [BOUNTIES.md](BOUNTIES.md) | The three bounties, requirements, hard gates |
| [PITCHES.md](PITCHES.md) | Per-booth scripts: Chainlink / Arc / ENS + judge Q&A |
| [PROJECT.md](PROJECT.md) | Product detail, ERC-8183 mapping, escalation ladder, roadmap |
| [DEMO.md](DEMO.md) | Hero incident, persona layouts, 90-second live flow |
| [DEMO-EVIDENCE.md](DEMO-EVIDENCE.md) | Live contract addresses, ERC-8183 lifecycle tx hashes, CRE sim evidence |
| [SUBMISSION.md](SUBMISSION.md) | Per-bounty submission gates and checklist |
| [STATUS.md](STATUS.md) | Current build state, pending actions, resume anchor |

## Docs — internal process

| File | What |
|---|---|
| [docs/TODO.md](docs/TODO.md) | Live task tracker |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | Cross-component seams, reconciliation log, live state |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Live deploy runbook (L1–L7) |
| [docs/BACKEND-SETUP.md](docs/BACKEND-SETUP.md) | Always-on backend on brach |
| [docs/INTERFACES.md](docs/INTERFACES.md) | Shared interface contract (API shapes, ABIs, env seams) |
| [docs/DESIGN.md](docs/DESIGN.md) | Visual design tokens, persona layouts, hard bans |
| [docs/CUTS.md](docs/CUTS.md) | Pre-committed cut rules and fallback ladder |
| [docs/SPIKES.md](docs/SPIKES.md) | Early spike plans and decision matrix (historical) |

## Stack

Arc testnet (USDC escrow + worker registry, Foundry) · Chainlink CRE (telemetry attestation, settlement) · ENS Sepolia (agent identity + worker subnames, ENSIP-25/26) · Python agent (asyncio, web3.py, Claude API) · Next.js on Vercel (Host / Worker / Agent personas) · FastAPI device simulator (Railway/brach) · Supabase (persistent demo state).
