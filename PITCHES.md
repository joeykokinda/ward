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

**Demo (the leak):** You're in Tokyo, it's 2am back home. The leak sensor in your Brooklyn apartment triggers. WARD can't self-fix a physical leak, so it discovers and hires Mike (mike.ward-agent.eth, 4.9★, 8 min away), escrows ~150 USDC as an ERC-8183 Job on Arc, and dispatches him. Mike fixes the leak; the moisture sensor reads dry; a Chainlink CRE workflow attests it onchain; the USDC releases. You slept through the whole thing.

---

Same leak demo, three framings. Each 60-90 seconds. **Each booth leads with its own sponsor's hook**, with ERC-8183 woven in as the connective tissue. Walk the actual ERC-8183 Job on the Arc explorer at the Chainlink and Arc booths.

## Chainlink booth — lead with the CRE attestation pipeline

**Opening line:** "Watch how this payment settles: a Chainlink CRE workflow fetches the leak sensor's API, sees the moisture reading is dry, attests that onchain, and calls `complete()` to release the escrow. The contract trusts the attestation — not a human clicking approve."

Script: WARD is the agent that runs your home. The leak sensor fires at 2am; WARD can't fix a physical leak, so it escrows ~150 USDC and dispatches Mike. The interesting part is who confirms the work is done. We don't make it a person — a CRE workflow polls the moisture sensor's telemetry endpoint, verifies the leak is cleared, writes an attestation onchain, and calls `complete()` on the Job, which releases the escrow on Arc. In ERC-8183 terms, **CRE is the Evaluator** — the one role the standard lets release funds. Without CRE, ERC-8183 still needs a human in the loop and this is just another agent with a wallet.

**Demo trigger:** simulate leak sensor trigger → fast-forward to the CRE workflow firing → show the attestation written onchain and the `complete()` / escrow-release tx.

**Closing line:** "Every gig platform settles on human approval. We made the standard's Evaluator settle on the physical world itself, with a CRE workflow."

## Arc booth — lead with conditional USDC escrow on Arc

**Opening line:** "Here's a live, conditional USDC escrow on Arc: it holds the ~150 USDC dispatch fee and releases automatically the instant the sensor attestation lands. Real USDC, verified contracts, here on the explorer."

Script: when WARD hires Mike for the leak, the ERC-8183 Job's budget is escrowed on Arc, and the contract auto-releases when the Evaluator attests via telemetry. **This is the only chain where machine-to-human nanopayments work economically** — gas-free USDC, sub-cent fees, settlement fast enough that Mike watches the money land while still standing in your hallway. A ~$150 dispatch would be eaten alive by mainnet gas; on Arc it's negligible. Show the Job on the Arc explorer: Open → Funded → Submitted → Completed, plus our policy layer in the contract — per-job caps, daily caps, owner-approval threshold, deadline auto-refund (the standard's Expired state). The policy is in the contract, not middleware. In ERC-8183 terms, **Arc is where the Job settles.**

**Demo trigger:** click into the Job contract on the explorer → walk creation and `fund()` → show the state transitions and real USDC release on a finished Job → run the live flow if time allows.

**Closing line:** "Machines hiring humans is a payments problem. ERC-8183 is the shape of the deal; Arc is the only rail where sub-cent, gas-free USDC makes it economical."

## ENS booth — lead with identity & discovery

**Opening line:** "Click this name — mike.ward-agent.eth. That's the plumber WARD hired, and everything the agent knew about him — his skills, his region, his reputation — it read straight out of ENS. No private database."

Script: the home agent has its own identity at ward-agent.eth, verified per ENSIP-25. Every worker in the registry is a subname carrying ENSIP-26 text records: skills, region, and a reputation pointer. When the leak Job needs a Provider, the agent **discovers and ranks workers through ENS resolution** — ENS is the registry, not a label on top of one. The reputation is portable and ENS-owned: it travels with Mike's name, it isn't locked inside our platform. We chose ENS text records over ERC-8004 on purpose — one name resolves for the agent, the human, and the UI; names render everywhere in the product and nothing is hardcoded. In ERC-8183 terms, **ENS is Client and Provider identity.**

**Demo trigger:** click a worker's subname → show the live ENSIP-26 text records resolving → show the agent's dispatch decision (selecting Mike for the leak Job) referencing them.

**Closing line:** "Agents need to be found and trusted. That's not a new database — it's ENS, and the reputation belongs to the worker, not to us."

**(Hard gate reminder: this pitch is delivered AT THE ENS BOOTH, SUNDAY MORNING, IN PERSON — mandatory for all ENS prizes.)**

## Judge Q&A — canonical answers

**Q1 — "Isn't this just RentAHuman with crypto?"**
RentAHuman settles on human approval over credit-card rails — it's a generalist, Fiverr-with-an-API. WARD settles on **machine attestation via CRE**, which only works for machine-verifiable tasks (leaks, outages, sensor recoveries) — that narrow scope is the design, not a limitation. And our buyer is *software with no bank account* — DePIN networks, DAOs, autonomous treasuries — which RentAHuman fundamentally can't onboard. Worker reputation is ENS-portable, not platform-locked. Different category, and complementary.

**Q2 — "Why crypto for a homeowner paying a local plumber?"**
For one homeowner, Stripe works — that's true. Crypto matters when the buyer is **software with no bank account**: DePIN networks, smart-contract DAOs, AI-agent treasuries. The homeowner demo is theater — every judge has felt the 2am panic — but the customer is the autonomous network that literally cannot use Stripe. Three places crypto is load-bearing today: trustless escrow with no platform fee, sensor-attested settlement with no human approval, and portable ENS worker reputation.

**Q3 — "Are the sensors real?"**
The devices are simulated — nobody ships hardware at a hackathon. What's real is the **trust pipeline**: CRE fetches the device API, attests onchain, and the escrow releases on that attestation. In production the endpoint is Home Assistant, SmartThings, or a DePIN node's status API — the CRE workflow is identical regardless. The crypto-novel part — contracts trusting machine attestation instead of human approval — works exactly the same whether the device is mocked or real.

## Why this matters / roadmap

**The homeowner is the demo because the pain is visceral — every judge has felt the 2am leak panic. The customer is software with no bank account: the only place crypto rails are unambiguously load-bearing.**

ERC-8183 is days old and almost everyone reading it pictures a human Evaluator approving an AI's work. WARD inverts it: the agent is the Client, the human is the Provider, and a sensor is the Evaluator. That's a reference implementation of Agentic Commerce running on live testnet today — real Jobs, real USDC escrow on Arc, CRE attesting completion — not a slide.

It starts with homeowners: stop being on-call for your own house. The same protocol scales without a rewrite — tomorrow it's property managers running fleets and DePIN operators keeping hardware alive, all posting the same ERC-8183 Jobs to the same contracts. The autonomous network is the real customer: a DePIN treasury or a DAO can post proof-gated Jobs to pay the humans who keep its hardware alive, settled by the sensors, with no bank account and no human in the loop.

**Close line:** "DePIN pays machines for verified physical work. WARD uses Ethereum's new commerce standard to pay the humans who keep those machines alive — settled by the sensors, not by anyone's approval."
