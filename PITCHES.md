# WARD: Booth Pitches

## Framing (lead with this everywhere)

**The homeowner is the demo because the pain is visceral: 2am leak, owner asleep in Tokyo, every judge has felt that panic. The customer is software with no bank account: DePIN networks, autonomous DAOs, AI-agent treasuries, the only buyers for whom crypto rails are unambiguously load-bearing.**

WARD is, as far as we know, the first production implementation of **ERC-8183**, Ethereum's new Agentic Commerce standard, shipped end-to-end on live Arc testnet. The novel primitive: an AI agent that hires humans and settles payment on machine-attested telemetry, not human approval.

ERC-8183 (Draft, by Virtuals Protocol) defines a *Job*: an escrowed budget with three roles and a state machine. A **Client** requests and funds the work, a **Provider** does it, and the **Evaluator**, and only the Evaluator, confirms completion, moving the Job Open to Funded to Submitted to Completed (or Rejected / Expired). The standard says the Evaluator alone releases escrow. It never says the Evaluator has to be human. WARD makes the Evaluator a sensor:

- **Client** = the autonomous home agent (requests the repair, funds the escrow).
- **Provider** = the field tech who shows up and fixes the hardware.
- **Evaluator** = the Chainlink CRE workflow that reads the device's telemetry and attests the fix.

That one mapping unifies all three bounties: **Arc** is the chain the Job settles on, **Chainlink CRE** is the Evaluator, and **ENS** is Client/Provider identity. We deliberately use ENS text records (ENSIP-25/26) for identity instead of ERC-8004: names that humans, agents, and the UI can all resolve.

**Product one-liner:** WARD is the autonomous agent for your home. It watches everything, fixes what it can, hires someone when it can't, and tells you what happened. You stop being on-call for your own house.

**The leak demo:** You're in Tokyo, it's 2am back home. The leak sensor in your Brooklyn apartment triggers. WARD can't self-fix a physical leak, so it discovers and hires Mike (`mike.ward-agent.eth`), escrows USDC as an ERC-8183 Job on Arc, and dispatches him. Mike fixes the leak, the moisture sensor reads dry, a Chainlink CRE workflow attests it on-chain, and the USDC releases. You slept through the whole thing. (The cinematic narrates a 150 USDC dispatch fee for legibility; the real on-chain settled jobs are 1 USDC, faucet-bounded but real.)

---

## 30-second booth scripts

Same leak demo, three framings. Each booth leads with its own sponsor's hook, with ERC-8183 as the connective tissue. Walk the actual ERC-8183 Job on the Arc explorer at the Chainlink and Arc booths.

### Chainlink CRE, 30 seconds (lead with the attestation pipeline)

"Watch how this payment settles. A Chainlink CRE workflow fetches the leak sensor's API on a cron tick, runs DON consensus that the moisture reading is dry, writes that attestation on-chain to Arc, and that `WriteReport` drives `complete()`, which releases the escrow. In ERC-8183 terms CRE is the Evaluator, the one role the standard lets release funds. The contract trusts the attestation, not a human clicking approve. Every gig platform settles on human approval. We made the standard's Evaluator settle on the physical world itself."

### Arc, 30 seconds (lead with conditional USDC escrow)

"This is a live conditional USDC escrow on Arc. It holds the dispatch fee and auto-releases the instant the sensor attestation lands. Open to Funded to Submitted to Completed, the full ERC-8183 state machine, plus a real policy layer in the contract: per-job caps, daily caps, owner-approval threshold, deadline auto-refund. Funds are native USDC, which is also the gas token, so settlement is gas-free and sub-cent. A sub-$200 dispatch that mainnet gas would eat alive is negligible here. Both contracts are source-verified on the explorer, 56 forge tests pass. Arc is where the Job settles."

### ENS, 30 seconds (lead with identity and discovery)

"Click this name, `mike.ward-agent.eth`. That's the plumber WARD hired, and everything the agent knew about him, his skills, his region, his reputation, it read straight out of ENS. The agent has its own name, `ward-agent.eth`, verified per ENSIP-25. Every worker is a subname carrying ENSIP-26 text records with a CAIP-10 reputation pointer to the on-chain registry. When the Job needs a Provider, the agent discovers and ranks workers through ENS resolution. ENS is the registry, not a label on one, and the reputation belongs to the worker, portable, not locked to us. Zero hardcoded values, all resolved live."

**(Hard gate reminder: the ENS pitch is delivered AT THE ENS BOOTH, SUNDAY MORNING, IN PERSON. Mandatory for all ENS prizes.)**

---

## Longer booth scripts (60-90 seconds)

### Chainlink booth

**Opening line:** "Watch how this payment settles. A Chainlink CRE workflow fetches the leak sensor's API, sees the moisture reading is dry, attests that on-chain, and calls `complete()` to release the escrow. The contract trusts the attestation, not a human clicking approve."

Script: WARD is the agent that runs your home. The leak sensor fires at 2am; WARD can't fix a physical leak, so it escrows USDC and dispatches Mike. The interesting part is who confirms the work is done. We don't make it a person. A CRE workflow polls the moisture sensor's telemetry endpoint, verifies the leak is cleared, writes an attestation on-chain, and calls `complete()` on the Job, which releases the escrow on Arc. In ERC-8183 terms, CRE is the Evaluator, the one role the standard lets release funds. Without CRE, ERC-8183 still needs a human in the loop and this is just another agent with a wallet.

**Demo trigger:** simulate leak sensor trigger, fast-forward to the CRE workflow firing, show the attestation written on-chain and the `complete()` / escrow-release tx.

**Closing line:** "Every gig platform settles on human approval. We made the standard's Evaluator settle on the physical world itself, with a CRE workflow."

### Arc booth

**Opening line:** "Here's a live conditional USDC escrow on Arc. It holds the dispatch fee and releases automatically the instant the sensor attestation lands. Real USDC, verified contracts, here on the explorer."

Script: when WARD hires Mike for the leak, the ERC-8183 Job's budget is escrowed on Arc, and the contract auto-releases when the Evaluator attests via telemetry. This is the only chain where machine-to-human nanopayments work economically: gas-free USDC, sub-cent fees, settlement fast enough that Mike watches the money land while still standing in your hallway. A dispatch fee would be eaten alive by mainnet gas; on Arc it's negligible. Show the Job on the Arc explorer: Open to Funded to Submitted to Completed, plus our policy layer in the contract, per-job caps, daily caps, owner-approval threshold, deadline auto-refund (the standard's Expired state). The policy is in the contract, not middleware. In ERC-8183 terms, Arc is where the Job settles.

**Demo trigger:** click into the Job contract on the explorer, walk creation and `fund()`, show the state transitions and real USDC release on a finished Job, run the live flow if time allows.

**Closing line:** "Machines hiring humans is a payments problem. ERC-8183 is the shape of the deal; Arc is the only rail where sub-cent, gas-free USDC makes it economical."

### ENS booth

**Opening line:** "Click this name, `mike.ward-agent.eth`. That's the plumber WARD hired, and everything the agent knew about him, his skills, his region, his reputation, it read straight out of ENS. No private database."

Script: the home agent has its own identity at `ward-agent.eth`, verified per ENSIP-25. Every worker in the registry is a subname carrying ENSIP-26 text records: skills, region, and a reputation pointer. When the leak Job needs a Provider, the agent discovers and ranks workers through ENS resolution. ENS is the registry, not a label on top of one. The reputation is portable and ENS-owned: it travels with Mike's name, it isn't locked inside our platform. We chose ENS text records over ERC-8004 on purpose: one name resolves for the agent, the human, and the UI; names render everywhere in the product and nothing is hardcoded. In ERC-8183 terms, ENS is Client and Provider identity.

**Demo trigger:** click a worker's subname, show the live ENSIP-26 text records resolving, show the agent's dispatch decision (selecting Mike for the leak Job) referencing them.

**Closing line:** "Agents need to be found and trusted. That's not a new database, it's ENS, and the reputation belongs to the worker, not to us."

**(Hard gate reminder: this pitch is delivered AT THE ENS BOOTH, SUNDAY MORNING, IN PERSON. Mandatory for all ENS prizes.)**

### ENS booth — the sovereign-identity expansion (deliver this when the judge is nodding)

The base script proves ENS is the live registry. This expansion is the swing for the win: ENS as the **federated identity layer for an entire autonomous economy**, with no platform in the middle.

"Step back and look at the architecture. We don't lock workers into a platform. Every worker owns their own ENS name with ENSIP-26 reputation records, their job history, skills, and region. When another agent network needs a plumber tomorrow, it reads that name and hires them directly: no re-signup, no rebuilding reputation, no lock-in.

Same on the agent side. Every home or fleet runs its own sovereign agent. In the demo that's `ward-agent.eth`, verified per ENSIP-25; in production it's `agent.alice.eth`, `agent.helium-fleet-7.eth`. Each owns its identity, its wallet, its action history. WARD is the protocol they all speak, never the platform they're trapped in.

This is what ENS unlocks that no other identity system can: portable, sovereign, on-chain reputation for both sides of the economy."

**The line to land (this is the one judges remember):** "Workers own their reputation. If WARD shuts down tomorrow, their job history is still on-chain at their own ENS name, and no platform can take it away. You'd never invest in a TaskRabbit profile, because TaskRabbit owns it. You will invest in a name you own forever."

**Proof to point at:** we didn't just describe this, we registered a second sovereign agent live on Sepolia: `agent.demo-home.eth`, an agent name under its owner's own domain (`demo-home.eth`), with ENSIP-26 records and an ENSIP-25 agent-registration that verifies against the same Arc WorkerRegistry as `ward-agent.eth`. Two independently-owned agents, one protocol, both resolving live. Resolve either name in the ENS app on Sepolia.

---

## Judge Q&A: the canonical objection answers

**Q1. "How is this different from RentAHuman / TaskRabbit / gig platforms?"**
Those are two-sided consumer marketplaces that settle on human approval over credit-card rails: a person clicks "done," money moves, the chain adds nothing, and disputes eat the margin. WARD is a different category on two axes. First, settlement: WARD releases escrow on machine-attested telemetry via a Chainlink CRE workflow, with no human approval in the happy path. That only works for machine-verifiable tasks (leaks, outages, sensor recoveries), and that narrow scope is the design, not a limitation. Second, the demand side: WARD's buyer is software with a budget, a DePIN network, a DAO, an AI-agent treasury, not a consumer browsing a marketplace. TaskRabbit fundamentally can't onboard a buyer with no bank account. And the worker's reputation is ENS-portable, owned by the worker, not platform-locked. Different category, and complementary.

**Q2. "Why crypto? Why not traditional payment rails?"**
For one homeowner paying a local plumber, traditional payment rails work fine. The crypto matters when the buyer is a smart contract: a DePIN network, an autonomous DAO, an AI agent treasury. Those literally can't open a bank account. The homeowner demo is theater, because every judge has felt the 2am panic, but the real customer is the autonomous network. Three places crypto is load-bearing today: trustless escrow with no platform fee, sensor-attested settlement with no human approval, and portable ENS worker reputation.

**Q3. "Your sensors are simulated."**
The devices are simulated, yes; nobody ships hardware at a hackathon, and it's a deliberate demo convenience, not an architectural shortcut. What's real is the trust pipeline: CRE fetches the device's HTTPS API, runs consensus, attests on-chain, and the escrow releases on that attestation. In production the endpoint is Home Assistant, SmartThings, or a DePIN node's status API, and the CRE workflow is byte-for-byte identical regardless of whether the device behind that HTTPS API is mocked or real. The crypto-novel part, a contract trusting machine attestation instead of human approval, works exactly the same way either way.

**Q4. "If reputation is sovereign, why are the workers subnames under `ward-agent.eth`?"**
For the demo we mint subnames so we can stand up five workers cleanly without each of them buying their own ENS name, and every one resolves live on Sepolia with real ENSIP-26 records you can click. The architecture doesn't depend on that choice. In production a worker brings a name they already own, `mike.handyman.eth`, and the registry just stores a pointer to it; the contract reads whatever ENS name the worker controls, and the resolution code is byte-for-byte identical to the subname path. Subnames are the demo's convenience; worker-owned names are the production design. We deliberately showed the simplified version live so every name on screen actually resolves, rather than faking sovereign names that wouldn't.

---

## Why this matters / roadmap

ERC-8183 is days old and almost everyone reading it pictures a human Evaluator approving an AI's work. WARD inverts it: the agent is the Client, the human is the Provider, and a sensor is the Evaluator. That's a reference implementation of Agentic Commerce running on live testnet today, real Jobs, real USDC escrow on Arc, CRE attesting completion, not a slide.

It starts with homeowners: stop being on-call for your own house. The same protocol scales without a rewrite. Tomorrow it's property managers running fleets and DePIN operators keeping hardware alive, all posting the same ERC-8183 Jobs to the same contracts. The autonomous network is the real customer: a DePIN treasury or a DAO can post proof-gated Jobs to pay the humans who keep its hardware alive, settled by the sensors, with no bank account and no human in the loop.

**Close line:** "DePIN pays machines for verified physical work. WARD uses Ethereum's new commerce standard to pay the humans who keep those machines alive, settled by the sensors, not by anyone's approval."
