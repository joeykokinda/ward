# WARD — Demo Design

90 seconds. Every transaction real and clickable. One perfect flow.

## Setup

One Brooklyn apartment. Four smart devices: WiFi router, thermostat, smart lock, leak sensor. One homeowner asleep in Tokyo. One agent running autonomously.

## Three personas (dropdown switcher)

**Host view** — apartment dashboard with device grid (status dot + device name + last reading); agent reasoning stream in terminal-log style with timestamps and color-coded event types; onchain activity feed with clickable Arc explorer links; active job bottom bar when a job is live.

**Worker view** — mobile-first. Available jobs nearby, reputation score, accept and mark-complete buttons. Accessed via **QR code at the demo table** so judges scan with their phone and become the field tech.

**Agent view** — agent's ENS name (ward-agent.eth), wallet address with live USDC balance, spending policy caps (per-job cap, daily cap, owner-approval threshold), decision history, recent reasoning trace.

## Pre-staged state (always present, persisted in Supabase + onchain)

- Brooklyn apartment with 4 healthy devices.
- 5 workers in the registry with reputation scores and ENS subnames.
- Agent wallet topped up with 500 USDC.
- At least 3 completed historical jobs in the activity feed (real Arc txs).
- By Sunday morning: dozens of historical transactions on Arc from weekend testing — the app never looks like a fresh demo.

## HERO incident — the 2am leak (90 seconds)

The homeowner is in Tokyo. It's 2am back home. The leak sensor triggers.

1. Judge clicks **Simulate Leak** on the apartment dashboard.
2. Agent reasoning streams: MONITOR (leak detected) → DIAGNOSE (physical leak — cannot self-fix) → ACTION (escalating to Level 3).
3. Agent queries the worker registry via ENS, selects the highest-reputation nearby worker.
4. **ERC-8183 Job created:** agent escrows **~150 USDC on Arc** as a Job with the agent as Client. Real tx hash appears with Arc explorer link. (Below the owner-approval threshold, so no sign-off needed; mention the threshold exists.)
5. Worker view (judge's phone via QR, or second tab): job notification appears; judge accepts as Mike (mike.ward-agent.eth), marks work done.
6. **Chainlink CRE workflow fires:** polls the leak sensor endpoint, sees moisture reading is dry, attests onchain. In ERC-8183 terms the Evaluator confirms completion.
7. **`complete()` called:** USDC releases to Mike; reputation increments. The contract trusted the sensor, not a human.
8. Activity feed updates; apartment returns to healthy. The homeowner in Tokyo wakes to a summary notification.

## ERC-8183 state machine (walk this on the Arc explorer)

`OPEN → FUNDED → SUBMITTED → COMPLETED`

Each state transition is an onchain tx. Show all four at the booth.

## Operational rules

- **Reset button** returns to clean state. Use it 50+ times across the weekend.
- If CRE latency is minutes: trigger the live cycle at pitch START; show a pre-staged settled cycle while it runs; the live settle lands during Q&A.
- Public demo loop must self-recover (rate-limited, hourly onchain spend cap) so the Vercel link works unattended for async judges.
- **Backup: 2-minute screen recording of a perfect run saved on the phone.** If anything breaks live, play it without apologizing.
- 15 minutes before any judging slot: backend services up, Vercel up, wallets funded, sim healthy, QR printed.
