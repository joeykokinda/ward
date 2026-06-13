# WARD — Booth Pitches

## The hook (lead with this everywhere)

**WARD is, as far as we know, the first production implementation of ERC-8183 — Ethereum's brand-new Agentic Commerce standard — shipped end-to-end on live testnet.**

ERC-8183 (Draft, by Virtuals Protocol) defines a *Job*: an escrowed budget with three roles and a state machine. A **Client** requests and funds the work, a **Provider** does it, and an **Evaluator** — and only the Evaluator — confirms completion, moving the Job Open → Funded → Submitted → Completed (or Rejected / Expired). The standard says the Evaluator alone releases escrow. It never says the Evaluator has to be human.

WARD makes the Evaluator a sensor. The three roles map onto our system exactly:

- **Client** = the autonomous home agent (requests the repair, funds the escrow).
- **Provider** = the field tech who shows up and fixes the hardware.
- **Evaluator** = the Chainlink CRE workflow that reads the device's telemetry and attests the fix.

So "the Evaluator confirms the work" literally becomes **sensor-settled escrow** — payment that no human approved, released because the physical world said the job was done. That one mapping unifies all three bounties: **Arc** is the chain the ERC-8183 Job is escrowed and settled on, **Chainlink CRE** is the Evaluator, and **ENS** is Client/Provider identity. We deliberately use ENS text records (ENSIP-25/26) for agent identity instead of ERC-8004 — names humans and agents can both resolve.

**Product one-liner:** *WARD is the autonomous agent for your home — it watches everything, fixes what it can, hires someone when it can't, and tells you what happened. You stop being on-call for your own house.*

**Demo:** one home — an apartment dweller with smart devices. Hero incident: your WiFi just died at 2am. WARD detects it, tries to self-fix, can't, and posts an ERC-8183 Job to hire a human — all while you're asleep.

---

Same demo, three framings. Each 60-90 seconds. Walk the actual ERC-8183 Job on the Arc explorer at the Chainlink and Arc booths.

## Chainlink booth — CRE is the ERC-8183 Evaluator

**Opening line:** "ERC-8183 says one role — the Evaluator — releases the escrow. We made the Evaluator a Chainlink CRE workflow, so this is a payment that no human approved: a workflow verified the physical world and released it."

Script: WARD is the agent that runs your home. Your WiFi dies at 2am; remote reboot fails; WARD opens an ERC-8183 Job and escrows USDC to hire a human. The interesting part is who confirms completion. In the standard that's the Evaluator, and we don't make it a person clicking approve — a CRE workflow fetches the router's telemetry endpoint, verifies the fault is cleared, and calls `complete()` on the Job, which releases escrow on Arc. CRE *is* the Evaluator. Without it, ERC-8183 still needs a human in the loop and this is just another agent with a wallet.

**Demo trigger:** simulate WiFi failure → fast-forward to the CRE workflow firing → show the attestation written onchain and the `complete()` / escrow-release tx.

**Closing line:** "Every gig platform settles on human approval. We made the standard's Evaluator settle on the physical world itself."

## Arc booth — where the ERC-8183 Job lives and settles

**Opening line:** "Your bounty lists conditional escrow with automatic release as example #1 — this is it: a live ERC-8183 Job, escrowed and settled on Arc, with a real human getting paid."

Script: when WARD hires someone, the ERC-8183 Job's budget is escrowed on Arc, and the contract auto-releases when the Evaluator confirms via telemetry. Arc is the only place this works economically: stablecoin-native, gas predictable in sub-cent terms, settlement fast enough that the tech watches the money land while still standing in your hallway. Show the Job on the Arc explorer: Open → Funded → Submitted → Completed, plus our policy layer in the contract — per-job caps, daily caps, owner-approval threshold, deadline auto-refund (that's the standard's Expired state). The policy is in the contract, not middleware.

**Demo trigger:** click into the Job contract on the explorer → walk creation and `fund()` → show the state transitions from a finished Job → run the live flow if time allows.

**Closing line:** "Machines hiring humans is a payments problem. ERC-8183 is the shape of the deal; Arc is the rail it settles on."

## ENS booth — identity for the Client and the Provider

**Opening line:** "ERC-8183 has a Client and a Provider. Click this one — mike.ward-agent.eth — that's the Provider, and everything WARD knows about him lives in ENS."

Script: in our ERC-8183 Jobs, the Client is the home agent at ward-agent.eth, verified per ENSIP-25. Every Provider in the registry is a subname with ENSIP-26 text records: skills, region, reputation pointer. When a Job needs a Provider, the agent discovers and ranks workers through ENS resolution — ENS is the registry, not a label on top of one. We chose ENS text records over ERC-8004 on purpose: one name resolves for the agent, the human, and the UI. Names render everywhere in the product; nothing is hardcoded.

**Demo trigger:** click a Provider's subname → show the live text records resolving → show the agent's dispatch decision (selecting the Provider for the Job) referencing them.

**Closing line:** "Agents need to be found and trusted. That's not a new database — that's ENS, doing double duty as ERC-8183 identity."

(Hard gate reminder: this pitch is delivered AT THE ENS BOOTH SUNDAY MORNING, in person, mandatory for all ENS prizes.)

## Why this matters / roadmap

ERC-8183 is days old and almost everyone reading it pictures a human Evaluator approving an AI's work. WARD inverts it: the agent is the Client, the human is the Provider, and a sensor is the Evaluator. That's a reference implementation of Agentic Commerce running on live testnet today — real Jobs, real escrow on Arc, CRE attesting completion — not a slide.

It starts with homeowners: stop being on-call for your own house. The same protocol scales without a rewrite — tomorrow it's property managers running fleets and DePIN operators keeping hardware alive, all posting the same ERC-8183 Jobs to the same contracts. The agent is just the first Client of the rails. Any treasury, DAO, or script can post proof-gated Jobs the same way.

**Close line:** "DePIN pays machines for verified physical work. WARD uses Ethereum's new commerce standard to pay the humans who keep those machines alive — settled by the sensors, not by anyone's approval."
