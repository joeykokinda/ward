# WARD — 3-Minute Demo Video Script

Doubles as the booth narration and the recorded backup. `[DO]` = on-screen action, `[SAY]` = spoken. Record on the live demo (https://web-nine-ashen-75.vercel.app) with the floor-plan Host view open, all devices green, 3+ historical jobs in the activity feed. Total ≈ 3:00.

---

### 0:00 – 0:15 · Hook
`[DO]` Floor plan of the Brooklyn apartment, all four devices calm green. Header shows `ward-agent.eth`, LIVE dot, treasury 500 USDC.
`[SAY]` "It's 2am. You're in a hotel in Tokyo. Your apartment back in Brooklyn just sprang a leak. You're asleep — and your home is about to fix itself. This is WARD: the autonomous agent for your home."

### 0:15 – 0:45 · Trigger + reasoning
`[DO]` Click the leak sensor → modal → **Kill device**. Blue ripples expand from the laundry room; water tint fills. Right panel starts streaming.
`[SAY]` "The leak sensor trips. WARD wakes up. It reasons in real time —" `[DO]` point at the reasoning stream — "detects the fault, diagnoses it as physical, tries a remote fix, and concludes it can't fix water with software. So it does what you'd do: it hires a human. But it finds that human onchain."

### 0:45 – 1:15 · ERC-8183 Job on Arc (clickable, real)
`[DO]` Reasoning shows ENS discovery → selects `mike.ward-agent.eth`. ESCROW line appears; treasury ticks 500 → 350. Activity feed shows the fund tx.
`[SAY]` "WARD opens an ERC-8183 Job — Ethereum's brand-new Agentic Commerce standard. The agent is the **Client**, it escrows USDC on **Arc**, and dispatches Mike, a verified plumber, as the **Provider**." `[DO]` click the fund tx hash → real Arc explorer opens. "That's real, on Arc, right now — gas-free USDC, sub-cent fees. A 150-dollar dispatch would be eaten alive by mainnet gas; Arc was built for exactly this."

### 1:15 – 1:45 · Fix + sensor-settled release
`[DO]` Worker avatar "M" appears at the door, walks the dashed path to the laundry room. Wrench blip. Ripples stop. Device returns green. Reasoning: CRE attests dry → `complete()`. Treasury 350 → 500.
`[SAY]` "Mike arrives, fixes the leak. The moisture sensor reads dry — and here's the whole point: nobody clicks 'approve.' A **Chainlink CRE workflow** is the standard's **Evaluator**. It fetches the sensor, attests the fix onchain, and calls `complete()`, which releases the escrow to Mike. The contract trusted the physical world, not a human."

### 1:45 – 2:15 · The three pillars (ENS live)
`[DO]` Click Mike's avatar → ENS profile modal: live ENSIP-26 records (skills, region), reputation, "ENSIP-25 ✓".
`[SAY]` "Mike's identity is **ENS** — `mike.ward-agent.eth`. His skills and reputation live in his own ENS records, resolved live from Sepolia. He owns that reputation — it's portable, not locked to us. Any other agent network reading ENS can hire him tomorrow. So: ERC-8183 is the deal, Arc is the rail, CRE is the evaluator, ENS is the identity — one coherent system."

### 2:15 – 2:45 · Why it matters
`[SAY]` "The homeowner is the demo because every judge has felt 2am home panic. But the real customer is software with no bank account — DePIN networks paying the humans who keep their hardware alive, DAOs, autonomous agent treasuries. They literally can't use traditional payment rails. WARD is the rails. And it's not a slide — it's, as far as we know, the first production implementation of ERC-8183, running end-to-end on live testnet today."

### 2:45 – 3:00 · Close
`[DO]` Hit **Reset** → apartment calm, all green, treasury 500.
`[SAY]` "You're still in Tokyo. The leak is fixed, Mike got paid, every step is onchain forever — settled by the sensor, not by anyone's approval. That's WARD."
`[DO]` Stop. (Live booth: pause for questions — objection answers in PITCHES.md.)

---

**Recording notes:** keep it under 3:00; let the floor-plan animation breathe (don't talk over the worker walk — let it land). Have one real Arc explorer tab pre-opened in case the click is slow. If the live agent is mid-settle, narrate "the live system is settling in parallel — here's the flow" and continue on the cinematic demo. The activity-feed history links are real Arc txns; clicking any of them is fair game for skeptics.
