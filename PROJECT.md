# WARD — Project

## What it is

WARD is an autonomous property operations agent. It monitors instrumented properties (and DePIN nodes), attempts software self-fixes when something breaks, and hires verified human workers when self-fixes fail, paying them in USDC the moment a Chainlink CRE workflow confirms the fix via device telemetry. The owner approves jobs over a spending threshold (human-in-the-loop); everything below it is autonomous. The agent has its own ENS identity; workers have ENS subnames with onchain reputation.

## The novel primitive

**An AI agent that hires humans and settles payment based on machine-attested telemetry, not human approval.**

Prior gig-economy marketplaces (Ethlance, LaborX, Human Protocol, and a dozen agent-pays-human hackathon demos) all died on the same two things: settlement required a human to click "approve" (so the chain added nothing and disputes ate the margin), and two-sided marketplace cold start. WARD settles on attested telemetry with no human in the happy path, and the demand side is software with a budget, not a marketplace hoping consumers show up.

WARD only works for instrumented assets where the fix is machine-verifiable. That constraint is the defensibility: it defines a real niche (routers, locks, thermostats, sensors, DePIN hardware) instead of pretending to fix all gig work.

Judge-table line: "Other agents pay because an LLM decided to; ours cannot release funds until an attested physical-world fact is verified in the contract."

## Escalation ladder

- **Level 1 — self-fix (free, autonomous):** remote reboot, reconfig, re-onboard. Most incidents end here. This is the everyday value.
- **Level 3 — hire a human (escrowed, proof-settled):** hardware fault confirmed → escrow USDC on Arc → dispatch highest-reputation registered worker → telemetry recovers → CRE attests → contract releases payment, reputation increments.

## Wedge market

Airbnb hosts with 2-10 properties, plus DePIN node operators. The demo opens with Airbnb because every judge has experienced bad property WiFi at 2am.

Roadmap: today Airbnbs, tomorrow DePIN fleets, commercial real estate, anything instrumented.

## Positioning

Lead with the protocol: **Proof-of-Physical-Work — escrow released by machine-attested sensor data, not human approval.** The agent is the first client of the rails, not the product. Any treasury, DAO, or script can post proof-gated jobs to the same contracts.

Close line: "DePIN pays machines for verified physical work. WARD pays the humans who keep those machines alive, the same way."
