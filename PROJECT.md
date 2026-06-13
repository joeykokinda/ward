# WARD — Project

## What it is

WARD is rails for an autonomous system to hire and pay a verified human for physically-verifiable work, settled on-chain. The instrumented home is the first instance, not the product. As a home agent it watches your devices, fixes what it can in software, and when the fault is physical it hires a verified human, pays them on attested completion, and tells you what happened. You stop being on-call for your own house. Crypto is load-bearing only when it pays a human, which is why the real buyers are software with no bank account.

It monitors instrumented devices (smart locks, thermostats, WiFi routers, leak sensors) and climbs an escalation ladder cheapest-first: software self-fixes (reboot, reconfigure, re-pair, cycle a relay, close a valve) when something breaks, and only when the fault is physical and software cannot resolve it does it hire a verified human, escrowing USDC on Arc and dispatching the worker it discovers and ranks through ENS by skill match, proximity, and on-chain reputation. Payment releases the moment device telemetry confirms the repair. Below the spending threshold the whole cycle is autonomous; above it the owner approves. The agent holds its own ENS identity; workers hold ENS subnames with onchain reputation. Identity and reputation live on ENS, payment and proof live on-chain on Arc, so settlement is trustless and auditable instead of locked inside one vendor's cloud.

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

The agent climbs a ladder, cheapest first. It does not jump to hiring a human; hiring is the last resort because it spends money and dispatches a person.

- **L1, self-fix (free, instant, autonomous):** software remedies the agent runs itself: reboot, reconfigure, re-pair, cycle a relay, close a smart valve. Most incidents end here. This is the everyday value.
- **L2, guided remote (optional):** a scripted multi-step remote remediation when one action is not enough (for example a firmware reflash). Still no human.
- **L3, hire a human (escrowed, proof-settled):** only when the fault is physical and software cannot resolve it. Confirm hardware fault, discover and rank a verified worker via ENS, escrow USDC on Arc as an ERC-8183 Job, dispatch, telemetry recovers, CRE attests, contract releases payment, reputation increments. Runs only within the owner's spending policy (per-job cap, daily cap, owner-approval threshold).

In the demo a WiFi fault is fixed at L1 by a remote reboot (no human, no escrow); the 2am leak fails L1 because the burst is upstream of any valve the agent controls, so it escalates to L3 and hires a plumber. The contrast shows the agent is intelligent, not "always hires a human." Full per-device steps and worker selection are in `docs/AGENT-PLAYBOOK.md`.

## Wedge market and roadmap

**Today — homeowners.** One apartment, four smart devices, one agent. The demo is a Brooklyn homeowner asleep in Tokyo while WARD handles a 2am leak. Every judge has felt that 2am panic; the pain is visceral and needs no explanation.

**Roadmap — software with no bank account.** The homeowner is the demo. The customer is the autonomous network that literally cannot use traditional payment rails: DePIN fleets paying the humans who keep their hardware alive, smart-contract DAOs posting proof-gated repair jobs, AI-agent treasuries settling with field techs on attested evidence. The same ERC-8183 contracts, the same CRE attestation pipeline, the same ENS registry — no rewrite.

## Positioning

Lead with the standard: **WARD is the reference implementation of ERC-8183 — Agentic Commerce — running end-to-end on live testnet.** The agent is the first client of the rails; any treasury, DAO, or script can post proof-gated Jobs to the same contracts.

Close line: "DePIN pays machines for verified physical work. WARD uses Ethereum's new commerce standard to pay the humans who keep those machines alive — settled by the sensors, not by anyone's approval."
