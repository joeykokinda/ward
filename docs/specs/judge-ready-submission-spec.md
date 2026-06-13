# WARD — Judge-Ready Submission Spec

This is the canonical build spec that drove WARD to its ETHGlobal NY 2026
submission. It is committed here as a planning/spec artifact per ETHGlobal's AI
tool disclosure rule (spec-driven workflow with Claude Code; the developer made
all architectural decisions and verified all functionality). See the AI
disclosure section in the root README.

## Critical submission rules (non-negotiable)

- Classic track / from scratch: all project code written during the hackathon;
  first commit after kickoff; disclose any reused prior work.
- Frequent incremental commits across the build day; no giant single dumps.
- Repo public on GitHub from submission onward.
- AI tool disclosure: README section + spec/prompt/planning artifacts in /docs.
- Demo video: 2:00 to 4:00 (target 3:00 to 3:30), 720p+, real human voiceover
  (no TTS), real screen capture (no phone), no speed-ups, slides minimal.
- Max 3 partner prizes (locked: Chainlink CRE, Arc, ENS).
- ENS booth Sunday morning, in person, is a hard gate for all ENS prizes.
- Submission deadline Sunday 09:00 EDT; submit Saturday night with buffer.
- Per-bounty submission text required for each partner prize.

## Product

WARD is an autonomous home agent. Devices are instrumented. When something
breaks, the agent reasons, tries to self-fix via remote APIs, and if it cannot,
hires a verified human worker from an on-chain registry. Payment is escrowed in
USDC on Arc. Chainlink CRE attests when device telemetry confirms the fix.
Escrow releases automatically: the sensor approves the payment, not a human.

Positioning: the homeowner is the demo (visceral 2am panic). The customer is
software with no bank account (DePIN networks, autonomous DAOs, agent
treasuries), which is the only place crypto rails are unambiguously
load-bearing. WARD is the reference implementation of ERC-8183 (Agentic
Commerce): Client = home agent, Provider = field tech, Evaluator = CRE workflow.

## Three locked bounties

1. Chainlink CRE (Best Workflow with CRE): CRE workflow fetches device telemetry
   from a public HTTPS endpoint, verifies the fault resolved, calls release on
   the Arc escrow.
2. Arc (Advanced Stablecoin Logic / conditional escrow): USDC escrow on Arc
   holds funds, releases on CRE attestation. Contracts verified on Arc explorer.
3. ENS (Best ENS Integration for AI Agents): ward-agent.eth primary identity;
   worker ENS subnames with ENSIP-26 text records; ENSIP-25 verification; agent
   discovers workers by querying ENS.

Plus ETHGlobal Finalist track (top 10 overall).

## Two-page architecture

### Page 1: Homepage at /
Single-scroll dark explainer that loads the judge's mental model in 30 seconds.
Sections: hero ("your home runs itself" + one "Watch the demo" CTA + static
floor-plan teaser); three actors (Agent / Human via ENS / Arc chain); how it
works (Detect, Diagnose, Hire, Verify) ending with "the sensor approves the
payment, not a human"; why crypto (honest: traditional payment rails work for one homeowner, but
DePIN networks and autonomous DAOs cannot open bank accounts); three sponsor
integrations (CRE / Arc / ENS, one sentence each); roadmap one-liner; footer CTA
plus links to GitHub, contracts on Arc explorer, ENS records on Sepolia, video.

### Page 2: Demo page at /demo (cinematic-first)
- A. Intro overlay (auto-shows, dismissable): what WARD is, three actor dots,
  "Watch it work" button.
- B. Floor plan hero: top-down 2D SVG, 4 rooms / 4 devices (WiFi, thermostat,
  lock, leak), three device states (healthy / alert with room-specific
  animation / being-fixed), clean architectural style.
- C. Walking worker: avatar with ENS name tag ("mike.ward-agent.eth, verified,
  reputation"), dashed path from entry to device, wrench beat, device returns to
  green, worker exits.
- D. Phase HUD (bottom-center): PHASE n of 5 + one plain sentence + five dots.
  Phases DETECT, DIAGNOSE, HIRE, REPAIR, VERIFY. Auto-advance with pauses on
  money moments.
- E. Actor strip (right): Agent / Human / Chain rows syncing with the HUD.
- F. On-chain activity (bottom): three latest transactions with human-readable
  labels, each clickable to the Arc explorer.
- G. Header: WARD wordmark, ward-agent.eth badge with live indicator, USDC
  balance that drops on escrow lock and recovers on release, Home link, Reset.
- H. Trigger panel (corner): four device buttons to start an incident.

## Design tokens
Background #0a0a0f, panels #111118, borders #1e1e2e, primary text #e2e8f0,
amber #f59e0b for money/active, green #22c55e for healthy/resolved, red #ef4444
for alerts. JetBrains Mono for data/logs, Inter for labels. Zero gradients, zero
glassmorphism, max 4px border radius.

## 90-second live demo choreography
Apartment green, 3 to 5 historical settled jobs pre-staged. Hook (2am, Tokyo,
Brooklyn leak). Trigger Leak. DETECT, DIAGNOSE (cannot self-fix), HIRE (query
ENS, select mike.ward-agent.eth, lock 150 USDC on Arc, balance drops, real tx
link), REPAIR (worker walks in, wrench, device green), VERIFY (CRE attests,
escrow releases, balance recovers). Worker exits, all green. Close: homeowner is
the demo, DePIN/DAOs are the customer, we are the rails.

## 3:00-3:30 video structure
0:00-0:15 hook; 0:15-0:30 what it is (three actors); 0:30-2:15 cinematic demo at
human pace, click into Arc explorer + an ENS subname; 2:15-2:45 why crypto
(honest); 2:45-3:15 three integrations; 3:15-3:30 closer. Real human voiceover,
real screen capture, 720p+, no speed-ups.

## Build order
1. Verify live end-to-end flow works (fix first if broken).
2. Homepage at / per spec.
3. Move dashboard to /demo, restructure cinematic-first.
4. Animated floor plan hero (SVG only; static device list is the fallback if the
   walking worker does not land in time; the working demo is non-negotiable).
5. Wire phase HUD to events, five phases, pauses on money moments.
6. Pre-stage demo data (historical settled jobs, worker reputation, funded
   wallet).
7. Reset button restores clean state in under 10 seconds.
8. Record the demo video (human voiceover).

Parallel polish: repo cleanup, README (with AI disclosure), PITCHES (booth
scripts + objection answers), per-bounty submission text, verify commit history,
verify repo public.

## Out of scope (do not add)
No bounties beyond the three. No new dependencies or chains. No marketing
parallax. Do not let the demo become a dashboard again. No phone recording, no
AI voiceover, no speed-ups, no commits as giant dumps.
