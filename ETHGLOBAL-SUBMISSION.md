# WARD — ETHGlobal New York 2026 submission (copy-paste sheet)

Everything below maps 1:1 to the ETHGlobal submission form. Copy each field's value straight in. Facts are pulled from the repo (verified contracts, 56 forge tests, live URLs) — don't change the addresses.

---

## 1. Images

| Form field | What to upload | Where it is |
|---|---|---|
| **Logo** (512×512) | `web/public/logo.svg` — amber square + white WARD shield mark. **Rasterize to 512×512 PNG before uploading** (open `logo.svg` in a browser and screenshot, or run `rsvg-convert -w 512 -h 512 logo.svg -o logo.png`). | `web/public/logo.svg` |
| **Cover image** (16:9, ~1280×720) | A clean screenshot of the live homepage hero (`https://web-nine-ashen-75.vercel.app`) **or** `web/public/shots/arc.png` (1440×900, crops to 16:9 fine). | repo / live site |
| **Screenshots** (min 3 — use all 6) | `00-intro.png` (the demo intro frame), `arc.png` (escrow funded + worker dispatched on Arc), `cre.png` (Chainlink CRE attesting), `ens.png` (ENS worker resolution), `settled.png` / `resolved.png` (escrow released, all healthy). | `web/public/shots/` |

Screenshot captions (optional, if the form lets you add them):
1. **Intro** — the cinematic /demo opens on a healthy instrumented home.
2. **Arc** — the agent hires a verified worker via ENS and locks USDC escrow on Arc (every on-chain step is a clickable tx).
3. **Chainlink CRE** — the CRE workflow reads device telemetry and attests the fix on-chain.
4. **ENS** — worker identity + on-chain reputation resolved live from ENS subname records.
5. **Settled** — the escrow releases to the worker on the attestation; the device is healthy again. No human approved it.

---

## 2. Project details

**Project name**
```
WARD
```

**Category**
```
Artificial Intelligence
```

**Emoji**
```
🛡️
```

**Demo link**
```
https://web-nine-ashen-75.vercel.app/demo
```
(Homepage: `https://web-nine-ashen-75.vercel.app`)

**Short description** (≤100 chars — this one is 93):
```
AI agent that hires humans and pays them in USDC, settled by sensor proof not human approval.
```

**Description** (min 280):
```
WARD is rails for an autonomous system to hire and pay a verified human for physically-verifiable work, with settlement, identity, and reputation on-chain. The instrumented home is the first instance, not the product.

An autonomous agent watches your devices and climbs an escalation ladder, cheapest first: it self-fixes most faults in software for free (reboot, reconfigure, cycle a relay, close a valve). Only when the fault is physical and software can't touch it does it hire a verified human, escrow USDC on Arc, and dispatch the worker it discovered and ranked through ENS. Payment releases the moment a Chainlink CRE workflow reads the device telemetry and confirms the fix — no invoice, no human clicking approve. The sensor settles the bill.

It's a working end-to-end implementation of ERC-8183 (Ethereum's new Agentic Commerce standard) on live Arc testnet: the home agent is the Client, the field tech is the Provider, and the Chainlink CRE workflow is the Evaluator — the one role the standard lets release escrow. The home demo is visceral (a 2am leak, owner asleep), but the real buyer is software with no bank account: property managers, DePIN fleets, DAO treasuries, agent wallets — anything that has to pay humans for verifiable work and can't open a Stripe account.
```

**How it's made** (min 280):
```
Contracts (Foundry / Solidity): WardEscrow is a keyed ERC-8183 JobEscrow holding native Arc USDC with a real policy layer in-contract — per-job caps, daily caps, an owner-approval threshold, and deadline auto-refund (the standard's Expired state). WorkerRegistry holds worker stakes and on-chain reputation. Both are source-verified on Arc's Blockscout (solc 0.8.24, optimizer 200 runs); 56 forge tests pass. Native Arc USDC is also the gas token, so settlement is gas-free and sub-cent — the only reason sub-$200 machine-to-human payments are economical.

Evaluator (Chainlink CRE): a CRE workflow (TypeScript SDK) fetches device telemetry from our public HTTPS device simulator on a cron tick, runs identical-consensus across the DON that the fault is resolved, and produces an EVM WriteReport to Arc that drives complete() on the Job, releasing the escrow. The contract trusts the attestation, not a human.

Identity (ENS): the agent holds ward-agent.eth, verified per ENSIP-25 (its agent-registration record points at the live WorkerRegistry on Arc). Workers are subnames carrying ENSIP-26 text records — skills, region, and a CAIP-10 reputation pointer that resolves their reputation live off the Arc registry. The agent discovers and ranks workers by resolving ENS, not a private DB; the address ENS resolves for a worker is the exact address paid on Arc. We also registered agent.demo-home.eth to demonstrate the sovereign-agent pattern. ENS code lives in packages/ens + a /api/ens route.

Agent + infra: a Python agent (asyncio + web3.py) runs the escalation ladder and uses the Anthropic Claude API for fault diagnosis and dispatch selection only — it never holds keys or moves money; all spending is contract-capped and owner-threshold-gated. A FastAPI device simulator runs on an always-on box exposed over HTTPS via Tailscale Funnel so CRE can reach it. Frontend is Next.js + React + Tailwind v4 on Vercel (a marketing homepage + a cinematic /demo), state persisted in Supabase. The attestation seam is identical whether the device behind the HTTPS endpoint is mocked or a real Home Assistant / DePIN node.
```

**GitHub Repositories**
```
https://github.com/joeykokinda/ward
```

---

## 3. Tech Stack (multiselect fields)

- **Ethereum developer tools:** Foundry, viem
- **Blockchain networks:** Arc (Testnet, chainId 5042002), Ethereum (Sepolia) — *(if Arc isn't in the list, add it under "Other")*
- **Programming languages:** Solidity, TypeScript, Python
- **Web frameworks:** Next.js, React, FastAPI
- **Databases:** Supabase (PostgreSQL)
- **Design tools:** None
- **Other technologies (free-type multiselect):** Chainlink CRE, ENS (ENSIP-25 / ENSIP-26, NameWrapper), ERC-8183, Tailwind CSS, Anthropic Claude API, web3.py, Tailscale Funnel, Vercel
- **How AI tools were used:**
```
Two ways. (1) In the product: the home agent uses the Anthropic Claude API to diagnose device faults from telemetry and to choose which verified worker to dispatch. The model is sandboxed — it does diagnosis and selection only, never holds keys or moves money; all spending is capped and gated in the WardEscrow contract and by the owner-approval threshold. (2) As a build tool: Claude Code was used to scaffold the Next.js frontend, write Foundry tests, and the ENS/CRE integration glue.
```

---

## 4. Judging & Prizes

**Track:** `Building from Scratch`

**Submission type:** `Top 10 Finalist & Partner Prizes` (participate in main + partner judging; Live Judging Sun Jun 14, 2:30pm EDT)

**Partner prizes — apply for these 3 (max 3):**

1. **ENS — $20,000.** ENS is WARD's identity + discovery layer, not a label. The agent (`ward-agent.eth`, ENSIP-25 verified against the live Arc registry) discovers and ranks workers by resolving their ENSIP-26 subname records — skills, region, and a CAIP-10 reputation pointer to the on-chain registry; the address ENS resolves is the exact address paid on Arc. Zero hardcoded values, all resolved live via `/api/ens`. Qualifies for the Integrate-ENS pool. *(Note: ENS prizes require the in-person ENS booth Sunday morning.)*

2. **Arc — $15,000** (Best Smart Contracts on Arc with Advanced Stablecoin Logic). A live ERC-8183 USDC conditional escrow on Arc with an in-contract policy layer (per-job/daily caps, owner-approval threshold, deadline auto-refund) that auto-releases on the Evaluator's attestation. Native gas-free USDC makes sub-cent machine-to-human payments viable. Verified contracts; full Open→Funded→Submitted→Completed lifecycle proven on-chain.

3. **Chainlink — $14,000** (Best Workflow with CRE). A CRE workflow is WARD's ERC-8183 Evaluator: it fetches device telemetry over HTTPS, runs DON consensus that the fix holds, and writes a report to Arc that releases the escrow. It's the single thing that moves money — settlement on a machine-attested fact, not human approval. Green CLI simulation captured (`cre/sim-output-live.txt`).

**Other partners' tech used (not applying):** None.

---

## 5. Future Opportunities

Interested in continuing — select **Ethereum Support Program (ESP)** and any grants/accelerator options offered (optional field).

---

## Before you hit submit — human-only checklist

- [ ] **Rasterize the logo** to a 512×512 PNG and upload it.
- [ ] Upload the **cover** (16:9) + at least **3 screenshots** (use the 6 in `web/public/shots/`).
- [ ] **Demo video ≤ 4:00** (the form's hard limit; do NOT speed it up — that's an auto-DQ). Script: `VIDEO-SCRIPT.md`. Paste the link into the "demonstration" field.
- [ ] **Repo is public** at `github.com/joeykokinda/ward` (judges verify commit history).
- [ ] **ENS booth, Sunday morning, IN PERSON** — mandatory for all ENS prizes; missing it forfeits the $20k track. Booth script: `PITCHES.md`.
- [ ] Verify the live URL works from a phone on cell data.

Verified on-chain proof to have open during judging (Arc explorer): WardEscrow `0xe118A51B105DF46F54AE4Fb01a1EF43F6a8dE5D8`, WorkerRegistry `0x2bdDf43350A5E79cf4fCc2A15f4a6905f9553bB4`. Full tx hashes in `DEMO-EVIDENCE.md`.
