# WARD — Live Demo Script (read off this at the booth / judging table)

The **in-person** 3:00 script. Read `[SAY]` out loud in your own voice; `[SHOW]` is what's on
screen and what to **click**. The whole point of this script is that you keep clicking into the
real proof while you talk: "the escrow just filled, here's the transaction," "see how it settled
on-chain right here." Everything settles on screen by ~0:50, so the back half is proof, identity,
and the three integrations. Nothing gets deferred to Q&A. (The recorded-video version is
`VIDEO-SCRIPT.md`.)

**Run the spine on `/demo`** (deterministic timing, never fails). Every hash it shows is a real
on-chain WardEscrow transaction, so when you click through to arcscan it's genuinely live, not a
mock. Want this exact run's settlement freshly minted? Run `/live` instead, same beats. `/demo`
is also your instant fallback if the backend hiccups.

Loop clock from the **Trigger leak** click: ENS badge ~11s, escrow tx ~15s, worker on site ~20s,
Chainlink CRE ~25s, settled tx ~27s. Clicking a hash opens **arcscan in a new tab**, glance, then
come back to `/demo` (the badges stay on screen, you won't miss anything).

---

## Before you start (15 min before the slot)

- **Backend up:** sim + agent healthy (`/events/recent` streaming `Polled fleet: 4 devices`).
- **Wallet funded:** ~1 USDC per live run on the faucet.
- **Hit Reset:** apartment all-green, treasury full.
- **Tabs, left to right:** 1) `/demo`  2) `/live`  3) Arc explorer on the escrow
  `https://testnet.arcscan.app/address/0xe118A51B105DF46F54AE4Fb01a1EF43F6a8dE5D8`
  4) ENS `https://sepolia.app.ens.domains/ward-agent.eth`  5) homepage for the opener.
- **Phone:** backup recording. If it breaks live, play it and keep talking. Never apologize.

---

## The 3:00 run

### 0:00–0:12 · Hook
`[SHOW]` Homepage hero. Devices calm, `ward-agent.eth` in the header.
`[SAY]` "It's 2am. You're asleep in a hotel in Tokyo. Back home in Brooklyn, your apartment just
sprang a leak. This is WARD, and it's about to hire a plumber and pay them before you wake up."

### 0:12–0:22 · What it is
`[SHOW]` Scroll to the three-actors row (Agent · Human · Arc).
`[SAY]` "It watches every device, fixes what it can in software for free, and when it can't, it
hires a verified human and pays them in USDC the second a sensor confirms the fix. Watch, I'll run
the whole thing live and click into every transaction as it happens."

### 0:22 · Trigger
`[SHOW]` Switch to `/demo`, click **Trigger leak**. Reasoning panel starts streaming.

### 0:22–0:36 · Watch the agent decide
`[SHOW]` Point at the reasoning stream as the lines appear.
`[SAY]` "Watch it think, this is the real agent. Leak detected... it's diagnosing... see, it tried
the free remote fix first, that's what quietly handles ninety-nine percent of incidents, but it's
calling this one physical, the water's upstream of any valve it can reach. So look, it decides to
hire a human."

### 0:36–0:52 · ENS pick + the escrow fills (click the hash)
`[SHOW]` ENS badge lands (~0:33). Escrow row + Arc badge land (~0:37). **Click the escrow tx hash** → arcscan opens (new tab) on the verified WardEscrow. Hold ~2s.
`[SAY]` "There, it pulled the worker straight from ENS, that's Mike, his skills and reputation
live in his own records. And right there, the escrow just filled. Let me click that hash, here,
this is arcscan, the Arc explorer, that's the USDC locked into the escrow contract, the contract's
verified, this is a real on-chain transaction, not a mock. Back to the demo."

### 0:52–1:06 · It settles on-chain (click the hash)
`[SHOW]` Worker walks in (~0:42), room goes green. CRE badge (~0:47). Settled tx + treasury recovers (~0:49). **Click the settled / `complete()` hash** → arcscan shows the USDC release.
`[SAY]` "Mike fixes it, the sensor reads dry, and here's the moment: Chainlink's workflow read
that sensor, confirmed dry, and released the money. No human clicked approve. And see how it
settled on-chain, right here, let me click it, that's the USDC moving to Mike's wallet on Arc. The
contract trusted the sensor, not a person."

### 1:06–1:20 · The identity is real too (click Mike)
`[SHOW]` **Click Mike's avatar** → his ENS profile modal (resolved live from Sepolia).
`[SAY]` "And the identity behind it, click Mike, this is resolved live from ENS, his records, his
reputation, and the address ENS gives for Mike is the exact wallet that just got paid. One name,
portable, any other agent network can read it and hire him tomorrow, no re-signup."

### 1:20–1:35 · Honest, on purpose
`[SAY]` "Two honest notes so you trust the rest: the cinematic says 150 dollars for legibility,
live runs are 1 USDC because we're on a faucet, but every hash you just saw is real. And the
Chainlink attestation is a green qualifying simulation today, wiring it to the live DON forwarder
is config, not a redesign."

### 1:35–2:05 · Why crypto
`[SAY]` "The homeowner's the demo because everyone's felt 2am home panic. But the real customer is
software with no bank account: a DePIN network paying the techs who service its hardware, a DAO, an
agent treasury. They literally can't open a Chase account. For them, a contract that hires a human
and settles on a sensor is the only thing that works. WARD is those rails."

### 2:05–2:40 · The three integrations
`[SHOW]` Gesture to the on-chain panel and the footer proof links as you name each.
`[SAY]` "One system, three standards. Chainlink CRE is the evaluator: fetches the telemetry,
attests the fix, triggers settlement. Arc is the rail: gas-free USDC, sub-cent fees, conditional
escrow built for agent payments, contracts verified, you just clicked them. ENS is identity: the
agent has a name, the workers carry portable on-chain reputation, all live, nothing hardcoded. In
ERC-8183 terms, WARD's the Client, Mike's the Provider, Chainlink's the Evaluator."

### 2:40–3:00 · Close
`[SHOW]` Hit **Reset**. Apartment calm, all green, treasury full.
`[SAY]` "The leak's fixed, Mike got paid, every step's on-chain forever, settled by the sensor,
not by anyone's approval, and you never woke up. WARD. Today it's homeowners. Tomorrow it's every
machine that needs to pay a human. That's it."

---

## If you get cut short

You're settled by ~0:50, so if they wave you off: click the escrow or settled hash, "this is
arcscan, that's the USDC locked and released on Arc, Chainlink confirmed the sensor read dry, no
human approved it, all real." Whole thesis in 10 seconds.

## Honest answers — have these ready (judges reward the candor)

- **"Is the 150 real?"** No, cinematic legibility. Live runs are 1 USDC (faucet). Settlement is real, you saw the hash.
- **"Did Chainlink settle this on-chain live?"** The qualifying CRE simulation is green (fetches
  the live sensor, DON consensus, WriteReport). On-chain `complete()` is Evaluator-key-signed
  today, not yet through the live DON forwarder. Config step, not a redesign.
- **"Are the sensors real?"** Simulated for the demo; the CRE pipeline is identical for a real
  device API, swap the URL. The hard part, attested settlement, is built.
- **"Why not TaskRabbit?"** TaskRabbit settles on a human tapping 'done.' WARD settles on a
  machine-attested fact with no bank account in the loop. Only crypto plus an oracle does that.

## Proof cheat-sheet (the hashes you're clicking)

Arc testnet · chainId **5042002** · explorer `https://testnet.arcscan.app`

| Thing | Value |
|---|---|
| WardEscrow (ERC-8183, verified) | `0xe118A51B105DF46F54AE4Fb01a1EF43F6a8dE5D8` |
| WorkerRegistry (verified) | `0x2bdDf43350A5E79cf4fCc2A15f4a6905f9553bB4` |
| Evaluator (releases escrow) | `0xDdd0047d0664235998791fe2163Bb9b31c2Fc038` |
| USDC (native Arc, 6dp, also gas) | `0x3600000000000000000000000000000000000000` |
| `complete()` — USDC releases to Mike | `0x0cf9c5a691225575de86937491fb6ae577c1f3e2b7a49959104a6c3a6084cb8d` |
| Agent ENS (Sepolia) | `ward-agent.eth` (ENSIP-25 verify = YES) |
| Worker ENS (Sepolia) | `mike.ward-agent.eth` → `0xA39542BedbF17c63a6c5543Da4460DCd9bBadECE` |

ERC-8183 lifecycle on the explorer: **createJob → fund → submit → complete** (each a real tx).

## Operational rules

- **Reset** between every run.
- Spine on `/demo` for predictable timing; `/live` for a freshly-minted settlement.
- If the backend hiccups, `/demo` still runs end-to-end; worst case play the phone recording, keep talking.
- The arcscan tabs are pre-opened, so a click lands on a real tx fast even if the venue wifi is slow.
- Footer proof links (WardEscrow on arcscan · Workers on ENS · CRE workflow source) are always one click away.
