# WARD — Demo Design

90 seconds. Every transaction real and clickable. One perfect flow.

## Three personas (dropdown switcher)

**Host view** — fleet grid of 3 properties (The Brooklyn Loft, Greenwich Cottage, Hudson Studio); agent reasoning stream in terminal-log style with timestamps and color-coded event types; onchain activity feed with clickable Arc explorer links; active job bottom bar when a job is live.

**Worker view** — mobile-first. Available jobs nearby, reputation score, accept and mark-complete buttons. Accessed via **QR code at the demo table** so judges scan with their phone and become a field tech.

**Agent view** — agent's ENS name, wallet address with live USDC balance, spending policy caps (incl. owner-approval threshold), decision history, recent reasoning trace.

## Pre-staged state (always present, persisted in Supabase + onchain)

- 3 properties with healthy devices.
- 5 workers in the registry with reputation scores and ENS subnames.
- Agent wallet topped up with 500 USDC.
- ≥3 completed historical jobs in the activity feed (real Arc txs).
- By Sunday morning: dozens of historical transactions on Arc from weekend testing — the app never looks like a fresh demo.

## Live flow (the 90 seconds)

1. Judge clicks **Simulate Router Failure** at Property 2 (Greenwich Cottage).
2. Agent reasoning streams: detect → diagnose → attempt remote reboot.
3. Remote reboot fails (mock returns hard-failure mode).
4. Agent queries worker registry, selects the highest-reputation worker.
5. Escrow locks **75 USDC on Arc** — real tx hash appears with explorer link. (75 < approval threshold, so no owner sign-off needed; mention the threshold exists.)
6. Worker view (judge's phone via QR, or second tab): job notification appears; judge accepts, marks complete.
7. CRE workflow polls the device endpoint, confirms the router is back online.
8. Escrow auto-releases USDC to the worker; reputation increments.
9. Activity feed updates; property returns to healthy.

## Operational rules

- **Reset button** returns to clean state. Use it 50+ times across the weekend.
- If CRE latency is minutes: trigger the live cycle at pitch START; show a pre-staged settled cycle while it runs; the live settle lands during Q&A.
- Public demo loop must self-recover (rate-limited, hourly onchain spend cap) so the Vercel link works unattended for async judges.
- **Backup: 2-minute screen recording of a perfect run saved on the phone.** If anything breaks live, play it without apologizing.
- 15 minutes before any judging slot: Railway services up, Vercel up, wallets funded, sim healthy, QR printed.
