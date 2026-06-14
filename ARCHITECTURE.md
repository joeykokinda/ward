# WARD — Architecture

```mermaid
flowchart TB
    subgraph offchain["Off-chain (brach · Tailscale Funnel · public HTTPS)"]
        SIM["Device simulator<br/>FastAPI · /status /fail /restart /repair"]
        AGENT["WARD agent (ERC-8183 Client)<br/>Python · asyncio · web3.py · Claude<br/>diagnose → L1 self-fix → L3 dispatch"]
    end
    subgraph cre["Chainlink CRE (Evaluator)"]
        WF["CRE workflow<br/>cron → fetch telemetry → consensus → WriteReport"]
    end
    subgraph arc["Arc Testnet (chainId 5042002, native USDC = gas)"]
        ESCROW["WardEscrow (ERC-8183, keyed JobEscrow)<br/>Job state machine · USDC held · caps · owner threshold<br/>Open → Funded → Submitted → Completed"]
        REG["WorkerRegistry<br/>stake · reputation"]
    end
    subgraph ens["ENS (Sepolia)"]
        ID["ward-agent.eth + 5 worker subnames<br/>ENSIP-25 verify · ENSIP-26 records · CAIP-10 rep pointers"]
    end
    UI["Dashboard (Next.js / Vercel)<br/>floor-plan hero · Host · Worker · Agent"]

    AGENT -->|poll + remote fix| SIM
    AGENT -->|createJob / setBudget / fund| ESCROW
    AGENT -->|discover + rank workers| ID
    WF -->|fetch telemetry| SIM
    WF -->|complete (Evaluator-only) → release USDC| ESCROW
    ESCROW -->|bump reputation| REG
    AGENT -->|decision feed SSE| UI
    UI -->|read names / records / rep| ID
    UI -->|read job + event state| arc
```

ERC-8183 role mapping: **Client** = the home agent (creates + funds the Job), **Provider** = the field tech (calls `submit`), **Evaluator** = the Chainlink CRE workflow. The Evaluator alone calls `complete()`, which releases escrowed USDC and bumps the worker's reputation. CRE writes directly to Arc, the entire Job lifecycle is single-chain on Arc.

WARD is rails for an autonomous system to hire and pay a verified human for physically-verifiable work; the instrumented home is the first instance. The agent climbs an escalation ladder cheapest-first: L1 self-fix in software (free, autonomous, most incidents end here), optional L2 guided remote, and L3 hire a human (escrowed, proof-settled) only when the fault is physical and software cannot resolve it. Hiring is L3 because it is the last resort: it spends money and dispatches a person, within the owner's spending policy. What is on-chain is the settlement, the identity, and the reputation: identity on ENS, payment and proof on Arc. How the agent thinks (full ladder + per-device steps + worker selection + roadmap) is specced in `docs/AGENT-PLAYBOOK.md`.

```
[Device simulator (FastAPI, public HTTPS via brach/Tailscale Funnel)]
   ▲ poll + remote-fix calls          ▲ HTTP fetch (telemetry)
[Agent = ERC-8183 Client (plain Python: asyncio + web3.py + Claude API)]   [Chainlink CRE = Evaluator]
   │ createJob / setBudget / fund                                          │ complete() → release USDC
   ▼                                                                       ▼
[Arc testnet: WardEscrow (ERC-8183) + WorkerRegistry + agent wallet, native USDC]
   ▲                                       ▲
[Next.js frontend on Vercel — floor-plan hero · Host / Worker / Agent personas]
[ENS on Sepolia — ward-agent.eth + 5 worker subnames (ENSIP-25/26 + CAIP-10 rep)]
```

## Components

| Component | Tech | Why |
|---|---|---|
| Escrow + registry | Solidity (Foundry) on **Arc testnet**, native USDC | Arc's bounty lists "conditional escrow with onchain automation and automatic release" as its #1 example. **WardEscrow** is a keyed ERC-8183 JobEscrow implementing the Agentic Commerce Job state machine: `createJob` (Client) → `setBudget` / `fund` (escrow USDC, per-job + daily caps, owner approval above threshold) → `submit` (Provider) → `complete` (**Evaluator-only**, releases escrow + bumps reputation). Deadline auto-refund (Expired state), full event trail. Roles: Client = home agent, Provider = field tech, Evaluator = Chainlink CRE. |
| Sensor attestation | **Chainlink CRE workflow** (TS SDK) | Fetches device telemetry from the public HTTPS endpoint, verifies the fault is resolved, triggers escrow release on Arc. The technical core. CLI simulation qualifies for the bounty; Chainlink deploys simulated workflows live at the event. |
| Agent | **Plain Python**: asyncio loop, web3.py, Claude API for reasoning. No uAgents. | Climbs the escalation ladder cheapest-first: poll fleet → diagnose → L1 self-fix (free, autonomous: reboot/reconfigure/re-pair/cycle relay/close valve; most incidents end here) → optional L2 guided remote → only on a confirmed physical fault L3: discover + rank workers via ENS (skill, ETA, on-chain reputation), select the best, escrow within policy → monitor → trigger CRE → confirm settle. Decision feed streamed to frontend. |
| Identity | **ENS on Sepolia** | Agent primary name (ward-agent.eth). Workers get subnames (mike.ward-agent.eth) with **ENSIP-26 text records**: skills, region, reputation pointer. **ENSIP-25** name verification for the agent. Agent discovers workers via ENS resolution. |
| Audit | Arc contract events, indexed by the frontend | No separate audit chain. |
| Frontend | **Next.js + Tailwind on Vercel**, clean light aesthetic (docs/DESIGN.md) | Three personas via dropdown: Host / Worker / Agent. Worker view mobile-first, reachable by QR code. |
| Demo state | **Supabase** (free tier) | State persists across all judge visits: reputation accumulates, activity feed grows. By Sunday the app shows dozens of real historical Arc transactions, not a fresh demo. |
| Device sim | FastAPI on **brach via Tailscale Funnel** (public HTTPS so CRE can reach it) | Per-property devices (router etc.): status / kill (soft\|hard) / restart (heals soft only) / repair. Node-console page for triggers. |

## CRE → Arc (resolved)

**Does CRE write to Arc testnet? Yes.** The entire ERC-8183 Job lifecycle is single-chain on Arc — no bridge, no second EVM. The CRE workflow fetches device telemetry from the public sim, runs identical-consensus, and produces an EVM `WriteReport` to Arc (chain-selector `3034092155422581607`, forwarder `0x76c9cf548b4179F8901cda1f8623568b58215E62`) that drives `complete()` on WardEscrow. A green CLI simulation (`cre/sim-output-live.txt`) qualifies for the Chainlink bounty; Chainlink deploys qualifying sims to the live DON at the event.

For the live booth demo, if CRE-DON latency is high, pre-stage one complete settled cycle on the Arc explorer and run the live cycle in parallel during Q&A.

## Fallbacks

- Arc fundamental issues → escrow on Base Sepolia, disclose honestly to judges.
- ENS stays on Sepolia regardless.
- Any non-anchor integration blocked >2h after a serious attempt → cut it.
