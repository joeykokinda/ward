# WARD — Booth Pitches

Same demo, three framings. Each 60-90 seconds. Walk the actual contracts on the Arc explorer at the Chainlink and Arc booths.

## Chainlink booth — CRE as the trust layer

**Opening line:** "This is a payment that no human approved — a CRE workflow verified the physical world and released it."

Script: WARD is an agent that maintains properties. When a router dies and remote reboot fails, it escrows USDC and hires a human. The interesting part is settlement: nobody clicks approve. A CRE workflow fetches the device's telemetry endpoint, verifies the fault is resolved, and writes the attestation that releases escrow on Arc. CRE is the orchestration layer that makes trustless physical-world payments possible — without it this is just another agent with a wallet.

**Demo trigger:** simulate router failure → fast-forward to the CRE workflow firing → show the attestation written onchain and the escrow release tx.

**Closing line:** "Every gig platform settles on human approval. CRE lets us settle on the physical world itself."

## Arc booth — the only chain where machine-to-human payments work

**Opening line:** "Your bounty lists conditional escrow with automatic release as example #1 — this is it, running, with a human getting paid."

Script: WARD's agent escrows USDC on Arc when it hires a worker, and the contract auto-releases when telemetry confirms the fix. Arc is the only place this works economically: stablecoin-native, gas predictable in sub-cent terms, settlement fast enough that a worker watches the money land while still on the roof. Show JobEscrow on the Arc explorer: per-job caps, daily caps, owner-approval threshold, deadline auto-refund — the policy layer is in the contract, not middleware.

**Demo trigger:** click into the escrow contract on the explorer → walk createJob → settle event trail from a finished job → run the live flow if time allows.

**Closing line:** "Machines hiring humans is a payments problem, and Arc is the rail it settles on."

## ENS booth — identity as the discovery layer for the agent economy

**Opening line:** "Click this worker — mike.ward-agent.eth — everything the agent knows about him lives in ENS."

Script: WARD's agent is ward-agent.eth, verified per ENSIP-25. Every worker in the registry is a subname with ENSIP-26 text records: skills, region, reputation pointer. When a job needs dispatching, the agent discovers and ranks workers through ENS resolution — ENS is the registry, not a label on top of one. Names render everywhere in the product; nothing is hardcoded.

**Demo trigger:** click a worker's subname → show the live text records resolving → show the agent's dispatch decision referencing them.

**Closing line:** "Agents need to be found and trusted. That's not a new database — that's ENS."

(Hard gate reminder: this pitch is delivered AT THE ENS BOOTH SUNDAY MORNING, in person, mandatory for all ENS prizes.)
