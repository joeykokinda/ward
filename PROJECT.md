# WARD — Project

## What it is

WARD is the autonomous agent for your home. It watches everything, fixes what it can, hires someone when it can't, and tells you what happened. You stop being on-call for your own house.

It monitors instrumented devices (smart locks, thermostats, WiFi routers, leak sensors), attempts software self-fixes when something breaks, and when self-fix fails it hires a verified human worker — escrowing USDC on Arc and dispatching the highest-reputation worker discovered through ENS. Payment releases the moment device telemetry confirms the repair. Below the spending threshold the whole cycle is autonomous; above it the owner approves. The agent holds its own ENS identity; workers hold ENS subnames with onchain reputation.

## The novel primitive

**An AI agent that hires humans and settles payment based on machine-attested telemetry, not human approval.**

Prior gig-economy attempts (Ethlance, LaborX, Human Protocol, a dozen agent-pays-human hackathon demos) all stalled on the same two problems: settlement required a human to click "approve" (so the chain added nothing and disputes ate the margin), and two-sided marketplace cold start. WARD settles on attested telemetry with no human in the happy path, and the demand side is software with a budget — not a marketplace waiting for consumers.

WARD only works for instrumented assets where the fix is machine-verifiable. That constraint is the defensibility: it defines a real niche (locks, thermostats, routers, sensors, DePIN hardware) instead of pretending to fix all gig work.

Judge-table line: "Other agents pay because an LLM decided to. Ours cannot release funds until an attested physical-world fact is verified in the contract."

## ERC-8183 — Agentic Commerce

WARD is, as far as we know, the first production implementation of ERC-8183 (Agentic Commerce standard, Draft by Virtuals Protocol). ERC-8183 defines a *Job*: escrowed budget, three roles, one state machine. The standard says the **Evaluator** alone releases escrow. It never says the Evaluator has to be human.

WARD makes the Evaluator a sensor:

| ERC-8183 role | WARD |
|---|---|
| **Client** | The autonomous home agent (requests the repair, funds the escrow) |
| **Provider** | The field tech who shows up and fixes the hardware |
| **Evaluator** | The Chainlink CRE workflow that reads device telemetry and attests the fix |

That one mapping unifies all three bounties: Arc is the chain the ERC-8183 Job settles on, Chainlink CRE is the Evaluator, and ENS is Client/Provider identity.

## Escalation ladder

- **Level 1 — self-fix (free, autonomous):** remote reboot, reconfig, re-onboard. Most incidents end here. This is the everyday value.
- **Level 3 — hire a human (escrowed, proof-settled):** hardware fault confirmed → escrow USDC on Arc as an ERC-8183 Job → dispatch highest-reputation registered worker → telemetry recovers → CRE attests → contract releases payment, reputation increments.

## Wedge market and roadmap

**Today — homeowners.** One apartment, four smart devices, one agent. The demo is a Brooklyn homeowner asleep in Tokyo while WARD handles a 2am leak. Every judge has felt that 2am panic; the pain is visceral and needs no explanation.

**Roadmap — software with no bank account.** The homeowner is the demo. The customer is the autonomous network that literally cannot use traditional payment rails: DePIN fleets paying the humans who keep their hardware alive, smart-contract DAOs posting proof-gated repair jobs, AI-agent treasuries settling with field techs on attested evidence. The same ERC-8183 contracts, the same CRE attestation pipeline, the same ENS registry — no rewrite.

## Positioning

Lead with the standard: **WARD is the reference implementation of ERC-8183 — Agentic Commerce — running end-to-end on live testnet.** The agent is the first client of the rails; any treasury, DAO, or script can post proof-gated Jobs to the same contracts.

Close line: "DePIN pays machines for verified physical work. WARD uses Ethereum's new commerce standard to pay the humans who keep those machines alive — settled by the sensors, not by anyone's approval."
