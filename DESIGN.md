# WARD — Design

Mission control terminal, not a SaaS dashboard. Reference: SpaceX mission control + Bloomberg terminal.

## Tokens

| Token | Value | Use |
|---|---|---|
| background | `#0a0a0f` | page background |
| panel | `#111118` | panel background |
| border | `#1e1e2e` | all borders, 1px solid |
| text | `#e2e8f0` | primary text |
| muted | `#64748b` | secondary text, MONITOR logs |
| amber | `#f59e0b` | money, active states, warnings, ACTION/ESCROW |
| green | `#22c55e` | healthy and resolved ONLY |
| red | `#ef4444` | alerts ONLY |
| blue | `#60a5fa` | DIAGNOSE log lines |

Fonts: **JetBrains Mono** for data/logs/numbers, **Inter** for labels. Border radius **4px maximum**. Zero gradients, zero glassmorphism.

## Restraint pass (rex feedback 2026-06-13 — first build came out too busy)

The first build used too much color and packed too many elements on screen — reads as "slop," not soothing. Correct toward calm:
- **Color is an accent, not the default.** The vast majority of text is `fg` or `muted`. `amber` = money + active state only. `green`/`red` = health/alert status only. Collapse the 7 per-log-type colors to ~2–3 (e.g. muted for routine MONITOR/RESULT, amber for ACTION/ESCROW, green for RESOLVED) — don't paint every line a different color.
- **Fewer things at once.** More whitespace and padding; don't show every panel at full density simultaneously. Let one area lead (the reasoning stream or the active incident), demote the rest.
- **Calm hierarchy.** Bigger type scale jumps, generous line-height, fewer borders/dividers competing. Bloomberg-calm, not arcade.
- Still: no gradients/glow/emoji, 1px borders, 4px radius. Restraint, not decoration.

## Hard bans

Gradients (any), glassmorphism, glow effects, big hero cards, emoji in the UI, anything that looks like a shadcn demo. Non-negotiable.

## Log line format

`[HH:MM:SS]  [TYPE]  message` — MONITOR muted, DIAGNOSE blue, ACTION amber, RESULT white, ESCROW amber bold, DISPATCH green, RESOLVED green bold.

## Persona layouts (dropdown switcher in header)

**Host** — three columns: fleet/property grid (left, dense rows: status dot + name + device + uptime), agent reasoning stream (middle, terminal log), onchain activity feed (right, tx hashes with Arc explorer links, USDC amounts in amber). Bottom bar: active job (property // worker ENS // amount // status // elapsed), border-opacity amber pulse while active. Header: agent ENS name, LIVE indicator (slow blink), USDC treasury balance.

**Worker** — mobile-first single column: available jobs (amount in amber, distance, property), reputation score, accept / mark-complete buttons. Big touch targets; this renders on a judge's phone via QR.

**Agent** — identity card (ENS name, address, live USDC balance), spending policy panel (per-job cap, daily cap, owner-approval threshold), decision history list, recent reasoning trace.

## Execution guardrails

- Terminal skin raises the content bar: panels must be dense with REAL data (live timestamps, real tx hashes, ticking uptime). Thin filler looks worse in this aesthetic.
- No CRT cosplay: no scanlines, phosphor glow, typewriter effects.
- Motion subtle: border-opacity pulse only; slow LIVE blink.
- Mono data ≥13px; never set load-bearing numbers in muted; don't signal status by dot color alone (pair with text/dimming).
