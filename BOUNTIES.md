# WARD — Bounties

**EXACTLY THREE bounties, plus the ETHGlobal Finalist track (top 10 overall). Do not add more, even quick wins.** Each is load-bearing: removing one weakens the product.

## 1. Chainlink — Best workflow with CRE (ANCHOR) — $6k pool, up to 3 teams × $2k

What we build: a CRE workflow that fetches device telemetry from our public HTTPS endpoint, verifies the fault was resolved, and triggers escrow release on Arc. The technical core of WARD.

Requirements:
- Workflow integrates a blockchain with an external API and is meaningfully used in the project.
- Successful **CLI simulation** (this alone meets the qualifying bar) or live deployment. Standing offer: show them a simulated workflow and their team deploys it to live CRE during the hackathon — take it.
- Explain Chainlink usage in the project description.

GATE: do not start this integration until the booth confirms whether CRE writes to Arc (SPIKES.md).

## 2. Arc — USDC conditional escrow — $3.5k (1st $2.25k / 2nd $1.25k)

What we build: the JobEscrow contract on Arc testnet holding USDC until CRE attests the fix. Arc's bounty text lists "conditional escrow with onchain automation and automatic release" as their #1 example; WARD is their reference implementation.

⚠ NAMING NOTE: the conditional-escrow example sits under Arc's **"Best Smart Contracts on Arc with Advanced Stablecoin Logic"** bounty, not "Agentic Economy" (that one is x402/nanopayments). Arc requires stating clearly which bounty you're entering — confirm at the Arc booth, default to **Advanced Stablecoin Logic**.

Requirements:
- Functional MVP: working frontend AND backend.
- **Architecture diagram** (explicit requirement).
- Video demonstration + documentation of how Circle tools are used.
- GitHub repo link. State the chosen bounty explicitly in the submission.

## 3. ENS — Best ENS Integration for AI Agents — $5k (2.5/1.5/1) + Integrate-ENS pool ($6k split)

What we build: agent has a primary ENS name; workers have subnames with **ENSIP-26 text records** (skills, region, reputation pointer); **ENSIP-25** agent name verification; the agent discovers workers via ENS resolution. Most teams will not implement ENSIP-25/26 properly. The same work qualifies for the Integrate-ENS pool split.

Requirements:
- Obvious that ENS improves agent identity/discoverability, not cosmetic.
- Functional demo, **zero hardcoded values** (they check).
- ENS-specific code (RainbowKit alone doesn't count for the pool).
- Showcase: video recording AND live demo link (ideally both), open-source repo.

## 🚨 HARD GATE — ENS BOOTH, SUNDAY MORNING, IN PERSON 🚨

All ENS prizes require presenting at the ENS booth in person on Sunday morning. Without showing up, we lose every ENS prize regardless of code quality. This is a calendar-level commitment, not a nice-to-have.

## Finalist track

Top-10 overall judging is separate from sponsor tracks. The profile that gets picked: one flawless physical-world flow with real onchain settlement. That's the whole build philosophy (one perfect demo > ten features).

## CUT — do not add even if easy

Hedera, Google Cloud ERC-8004, LI.FI, Canton, Sui/Walrus, Uniswap, 1inch, Privy, Unlink, Blink, World AgentKit, Ledger DMK, Dynamic. Continuity-only prizes are ineligible anyway (new build).
