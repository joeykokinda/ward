# WARD: Submission

**The pitch:** WARD is, as far as we know, the first production implementation of **ERC-8183** (Ethereum's new Agentic Commerce standard) shipped end-to-end on live Arc testnet. An autonomous home agent hires a human field tech, escrows USDC on Arc as an ERC-8183 Job, and a Chainlink CRE workflow, the standard's **Evaluator**, releases the escrow when device telemetry confirms the fix. Payment settles on a machine-attested physical fact, not human approval. ENS is the identity and discovery layer for the agent and its worker registry.

**One-liner:** An AI agent that hires humans and settles payment on machine-attested telemetry, not human approval. Machines hire humans; sensors settle the bill.

**Positioning:** WARD is rails for an autonomous system to hire and pay a verified human for physically-verifiable work, with settlement, identity, and reputation on-chain. The instrumented home is the first instance, not the product. It climbs an escalation ladder cheapest-first: L1 self-fix in software (free, autonomous, most incidents end here), optional L2 guided remote, and L3 hire a human (escrowed, proof-settled) only when the fault is physical and software cannot resolve it, within the owner's spending policy. In the demo a WiFi fault self-fixes at L1 (remote reboot, no human, no escrow); the 2am leak fails L1 and escalates to L3. The homeowner is the demo because the pain is visceral (2am leak, owner asleep in Tokyo). The real customer is software with no bank account: DePIN networks, autonomous DAOs, AI-agent treasuries. For one homeowner paying a local plumber, traditional payment rails work fine; crypto is load-bearing only when the buyer is software that cannot open a bank account.

**Demo video:** (link added on submission). A 3-minute recording, explorer proof of settle on screen, honest about CRE attestation latency. Script in VIDEO-SCRIPT.md.

## 🚨 HARD GATE: ENS BOOTH, SUNDAY MORNING, IN PERSON 🚨

All ENS prizes require presenting at the ENS booth **in person on Sunday morning**. Missing it forfeits every ENS prize regardless of code quality. This is a calendar-level commitment, not a nice-to-have. Booth script + objection answers in PITCHES.md.

---

## Links

| | |
|---|---|
| Live homepage (Vercel) | https://web-nine-ashen-75.vercel.app |
| Live cinematic demo (Vercel) | https://web-nine-ashen-75.vercel.app/demo |
| Demo video | (link added on submission) |
| Repo (open source) | https://github.com/joeykokinda/ward |
| Arc explorer base (chainId 5042002) | https://testnet.arcscan.app |
| WardEscrow (ERC-8183, source-verified) | https://testnet.arcscan.app/address/0xe118A51B105DF46F54AE4Fb01a1EF43F6a8dE5D8 |
| WorkerRegistry (source-verified) | https://testnet.arcscan.app/address/0x2bdDf43350A5E79cf4fCc2A15f4a6905f9553bB4 |
| Evaluator (CRE oracle EOA) | https://testnet.arcscan.app/address/0xDdd0047d0664235998791fe2163Bb9b31c2Fc038 |
| USDC (native Arc, 6dp, also gas) | `0x3600000000000000000000000000000000000000` |
| Agent / deployer wallet | `0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4` |
| ENS records (Sepolia) | https://sepolia.app.ens.domains/ward-agent.eth |
| ENS worker subnames (Sepolia) | `mike` / `sara` / `deon` / `lena` / `raj` `.ward-agent.eth` |
| CRE sim log (green) | `cre/sim-output-live.txt` |
| Architecture diagram | `ARCHITECTURE.md` (mermaid) |
| On-chain evidence (all tx hashes) | `DEMO-EVIDENCE.md` |

**ERC-8183 role mapping:** Client = home agent · Provider = field tech · Evaluator = Chainlink CRE. `complete()` is Evaluator-only and releases the escrow.

---

## Bounty 1. Chainlink: Best Workflow with CRE

**What we built.** The CRE workflow is the technical core of WARD: it is the ERC-8183 **Evaluator**. On a cron tick it fetches device telemetry from our public HTTPS sim, runs identical-consensus across the DON to verify the fault is resolved (the moisture sensor reads dry), and produces an EVM `WriteReport` to Arc that drives `complete()` on the WardEscrow Job, releasing the escrowed USDC. This is a workflow that integrates a blockchain (Arc, via `WriteReport`) with an external API (device telemetry over HTTPS) and is meaningfully used: it is the single thing that releases money. The contract trusts the attestation, not a human clicking approve. Without CRE, ERC-8183 still needs a human in the loop and this is just another agent with a wallet.

**Demo artifact + links.**
- Green CLI simulation: `cre/sim-output-live.txt`. `cre workflow simulate --target local-simulation-settings` fetched the live sim (`https://brach.taild3399f.ts.net/device/prop-2-router/status`, HTTP 200), computed `healthy=true`, ran identical-consensus (`AGGREGATION_TYPE_IDENTICAL`), and produced `EVM Chain WriteReport Dry-Run Successful` then `settled jobId=1`.
- Arc chain-selector `3034092155422581607`, Arc Testnet forwarder `0x76c9cf548b4179F8901cda1f8623568b58215E62`.
- The escrow release it drives: `complete` tx [`0x0cf9c5a6…`](https://testnet.arcscan.app/tx/0x0cf9c5a691225575de86937491fb6ae577c1f3e2b7a49959104a6c3a6084cb8d) (full hash in DEMO-EVIDENCE.md). The `complete()` caller on Arc is the Evaluator EOA `0xDdd0047d0664235998791fe2163Bb9b31c2Fc038`, the same address the CRE workflow targets, so the flow the sim simulates is the flow that settled on-chain.
- Live demo: https://web-nine-ashen-75.vercel.app/demo · Repo: https://github.com/joeykokinda/ward

**Honest note (stated plainly).** The green CLI simulation is the qualifying bar for this bounty, and we meet it. Settlement in the sim is a `WriteReport` **dry-run** (`txHash:"0x"`). The matching on-chain `complete()` is currently signed by the Evaluator EOA rather than delivered through the live DON forwarder. Fully-autonomous live-DON settle would require the workflow to take a dynamic `jobId`. We're glad to have the Chainlink team deploy the qualifying sim to the live DON at the event, which is the standing offer.

**Feedback for the Chainlink team.** Arc Testnet is a first-class CRE target with a live forwarder, and the TS SDK build-then-simulate loop is clean. Two friction points worth flagging: `cre workflow simulate` requires authentication (a free `CRE_API_KEY`) where `build` does not, which surprised us mid-build; and the path from a green dry-run sim to a live-DON write that takes a dynamic input (our `jobId`) wasn't obvious from the docs. A worked example of "dry-run sim to live DON with a per-invocation parameter" would have saved time.

**Qualifying checklist.**
- [x] Workflow integrates a blockchain (Arc, `WriteReport`) with an external API (device telemetry over HTTPS) and is meaningfully used: it settles the escrow.
- [x] Successful CLI simulation captured (the qualifying bar). Open to Chainlink deploying the qualifying sim to the live DON at the event.
- [x] Chainlink usage explained in the project description (above + ARCHITECTURE.md).

Booth script: PITCHES.md → "Chainlink".

---

## Bounty 2. Arc: Best Smart Contracts on Arc with Advanced Stablecoin Logic

**Bounty entered (stated explicitly):** Arc, *Best Smart Contracts on Arc with Advanced Stablecoin Logic* (the bounty whose text lists "conditional escrow with on-chain automation and automatic release" as its #1 example). Not the Agentic Economy / x402 track.

**What we built.** WardEscrow is a keyed ERC-8183 JobEscrow on Arc holding native USDC under a real policy layer: per-job caps, daily caps, an owner-approval threshold, and deadline auto-refund (the standard's Expired state), all in the contract, not middleware. The Job runs Open to Funded to Submitted to Completed; the Evaluator (CRE) auto-releases the escrow the instant the telemetry attestation lands. Funds are native Arc USDC (6 decimals), which is also the gas token, so settlement is gas-free and sub-cent: a sub-$200 dispatch fee that mainnet gas would eat alive is negligible here, fast enough that the field tech watches the money land while still in the hallway. Both contracts are source-verified on Blockscout (compiler `v0.8.24`, optimizer 200 runs). 56 forge tests pass.

**Demo artifact + links.** Full ERC-8183 lifecycle, all on Arc testnet (full hashes in DEMO-EVIDENCE.md):

| ERC-8183 step | tx |
|---|---|
| createJob | [`0xe65a7352…`](https://testnet.arcscan.app/tx/0xe65a7352007bf269874f4bf83e138c67d29d24d9009facd083af296cbcebf217) |
| setBudget | [`0xb4875473…`](https://testnet.arcscan.app/tx/0xb4875473ae81ba87b4a9424bf9c8ac743a02a69efea8d4601ab0e0cd44542bd4) |
| fund | [`0x1afb1617…`](https://testnet.arcscan.app/tx/0x1afb161733819d2004d24d10bf13312ba941e91394e9f3463a90df2240e01ea0) |
| submit | [`0x48d22cd0…`](https://testnet.arcscan.app/tx/0x48d22cd077f7e32670a2589e977991a6917b511f3cc6c515449f72065360827a) |
| complete (Evaluator attests, USDC releases) | [`0x0cf9c5a6…`](https://testnet.arcscan.app/tx/0x0cf9c5a691225575de86937491fb6ae577c1f3e2b7a49959104a6c3a6084cb8d) |

- Verified contracts: WardEscrow [`0xe118…E5D8`](https://testnet.arcscan.app/address/0xe118A51B105DF46F54AE4Fb01a1EF43F6a8dE5D8) · WorkerRegistry [`0x2bdD…3bB4`](https://testnet.arcscan.app/address/0x2bdDf43350A5E79cf4fCc2A15f4a6905f9553bB4) · Evaluator [`0xDdd0…Fc038`](https://testnet.arcscan.app/address/0xDdd0047d0664235998791fe2163Bb9b31c2Fc038).
- Architecture diagram: ARCHITECTURE.md (mermaid). Live demo: https://web-nine-ashen-75.vercel.app/demo · Repo: https://github.com/joeykokinda/ward

**Honest note (stated plainly).** Live on-chain job amounts are 1 USDC (faucet-bounded). The cinematic demo narrates a 150 USDC dispatch fee for legibility. The settled jobs are small but real, and the economics (gas-free, sub-cent) are what make small machine-to-human payments viable in the first place.

**Qualifying checklist.**
- [x] USDC conditional escrow on Arc testnet, end-to-end automatic release demonstrated on-chain.
- [x] Functional MVP: working frontend (Vercel) AND backend (sim + agent on the always-on box).
- [x] Architecture diagram (ARCHITECTURE.md).
- [x] Chosen Arc bounty stated explicitly (Advanced Stablecoin Logic). GitHub repo linked.
- [ ] Video + documentation of Circle/USDC tooling usage (in the demo video, link added on submission).

Booth script: PITCHES.md → "Arc".

---

## Bounty 3. ENS: Best ENS Integration for AI Agents (+ Integrate-ENS pool)

**What we built.** ENS is the identity and discovery layer, not a cosmetic label. The home agent holds its own primary name `ward-agent.eth`, verified per ENSIP-25 (the `agent-registration` text record points at the live WorkerRegistry, and `verify` returns YES on Sepolia). Every worker is a subname carrying ENSIP-26 text records: skills, region, and a CAIP-10 reputation pointer that reads the worker's reputation live from the deployed registry on Arc. When a Job needs a Provider, the agent **discovers and ranks workers through ENS resolution**: ENS is the registry, and the reputation is ENS-owned and portable, traveling with the worker's name rather than locked in our platform. We deliberately chose ENS text records (ENSIP-25/26) over ERC-8004 so one name resolves for the agent, the human, and the UI. Zero hardcoded values: the UI resolves everything live via `/api/ens`.

**Why this is non-cosmetic.** Identity and discovery are load-bearing in the actual flow. The agent does not read a private database of workers; it queries ENS, filters the resolved subnames to those whose records match the needed skill, ranks them by skill match, proximity (ETA), and live on-chain reputation (the CAIP-10 pointer resolves to the Arc WorkerRegistry), and dispatches the top match (`mike.ward-agent.eth`). The app exposes the live roster on a /workers registry page. The exact address that ENS resolves for `mike` is the exact address paid and reputation-bumped on Arc, a clean cross-chain identity tie. Remove ENS and the agent has no way to find or trust a worker.

**Demo artifact + links.**
- Agent name: `ward-agent.eth` (Sepolia). ENSIP-25 `verify` = YES against the live WorkerRegistry `0x2bdDf43350A5E79cf4fCc2A15f4a6905f9553bB4` (chain 5042002).
- Worker subnames (Sepolia, ENSIP-26 records + CAIP-10 reputation pointers to the live registry): `mike` / `sara` / `deon` / `lena` / `raj` `.ward-agent.eth`. `mike` resolves to `0xA39542BedbF17c63a6c5543Da4460DCd9bBadECE`, with skills `[plumbing, networking, router]`, region, and live on-chain reputation.
- The dispatch decision (agent selecting the highest-reputation worker) references these resolved records. ENS-specific code lives in `packages/ens` and the `/api/ens` route in `web/`.
- ENS records on Sepolia: https://sepolia.app.ens.domains/ward-agent.eth · Live demo: https://web-nine-ashen-75.vercel.app/demo · Repo: https://github.com/joeykokinda/ward

**Qualifying checklist.**
- [x] Agent primary name + worker subnames live; ENSIP-26 text records resolving; ENSIP-25 verification = YES; agent discovery via ENS resolution.
- [x] ENS materially improves agent identity/discoverability (it is the registry), not cosmetic.
- [x] Zero hardcoded values (they check). ENS-specific code in the repo (`packages/ens`, `/api/ens`), qualifies for the Integrate-ENS pool (RainbowKit alone would not).
- [x] Open-source repo + live demo link on the showcase.
- [ ] **Sunday-morning ENS booth presentation, in person** (HARD GATE above).

Booth script + the three canonical objection answers (RentAHuman/TaskRabbit, why-crypto-not-traditional-payment-rails, are-the-sensors-real): PITCHES.md → "ENS" + "Judge Q&A".

---

## Submission gates (work through during the event, not the final hour)

### Non-negotiables
- [ ] **ENS booth, Sunday morning, IN PERSON** (HARD GATE, see top).
- [ ] **Commit in intervals all weekend.** Small, frequent commits showing real progression, never one large dump (DQ risk). Never backdate.
- [ ] **Live demo URL** on the showcase page, verified working from a phone on cell data.
- [ ] **Demo video ≤3 min**, explorer proof of settle on screen, honest about attestation latency. (Replace the placeholder line at top.)

### Per-bounty (mirrors the three checklists above)
- [x] Chainlink: workflow meaningfully used + green CLI sim + usage paragraph + honest DON-forwarder note.
- [x] Arc: USDC conditional escrow end-to-end + frontend AND backend + architecture diagram + explicit bounty named + repo. (Pending: Circle/USDC tooling video.)
- [x] ENS: names + subnames + ENSIP-25/26 + discovery + zero hardcoded values + repo + live link. (Pending: Sunday booth.)

### Submission text
- [ ] First two sentences name the tech (see the pitch + one-liner at top).
- [ ] Architecture diagram image attached.
- [ ] Rehearsed objection answers baked into the description (PITCHES.md → Judge Q&A): prior marketplaces settled on human approval; oracle problem answered by attested telemetry on instrumented-assets-only; LLM does diagnosis + dispatch only, spending is contract-capped + owner-threshold-gated.

### Judging table
- [ ] Pre-staged: settled historical jobs visible + one L1 self-fix in the log.
- [ ] Trigger live failure at pitch START so settlement lands during Q&A.
- [ ] QR code printed for worker view. Backup video on phone.
- [ ] 15 min before slot: backend up, Vercel up, wallets funded, sim healthy, reset done.
- [ ] Booth-specific pitches per PITCHES.md.
