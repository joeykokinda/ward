# WARD Demo Video Script (3:00 to 3:30)

Recorded submission video. `[DO]` = on-screen action, `[SAY]` = spoken (real human voice). Record on the live demo: homepage https://web-nine-ashen-75.vercel.app and demo https://web-nine-ashen-75.vercel.app/demo. Target 3:00 to 3:30.

**Badge timings are measured (by driving the live demo), relative to the "Trigger leak" click. The badge appearing on screen is your real cue: the clock times are guides, speak so each line lands about 1 second BEFORE its badge so the badge punctuates the sentence.**

Measured from the Trigger-leak click: ENS badge ~11s, Arc badge + escrow tx ~15s, Chainlink CRE badge ~25s, settled tx ~27s.

---

### 0:00 to 0:15 · Hook
`[DO]` Title card or face cam, then the /demo floor plan, four devices calm green, header showing `ward-agent.eth`, treasury 500 USDC.
`[SAY]` "It's 2am. You're in a hotel in Tokyo. Your apartment back in Brooklyn just sprang a leak, and you're asleep. This is WARD, the autonomous agent for your home, and it's about to fix this without you."

### 0:15 to 0:30 · What it is
`[DO]` Cut to the homepage `/`, scroll to the three-actors row (Agent / Human / Arc chain).
`[SAY]` "WARD watches every device. When something breaks it tries to fix it remotely, and when it can't, it hires a verified human and pays them in USDC the moment a Chainlink oracle confirms the fix. Three parts: an agent with an identity, a human found through ENS, and an escrow on Arc."

### 0:30 to 2:15 · Cinematic demo

WARD climbs a ladder: it self-fixes for free at L1, and only hires a human at L3 when software cannot. Show both, the everyday case first, so the agent reads as judicious, not "always hires a human." Badge cues are relative to each click; watch the screen, the badge is your real cue.

**0:30 to 0:48 · the everyday case (L1 self-fix).**
`[0:30 DO]` On `/demo`, click **Kill WiFi** in the trigger bar.
`[0:30 SAY]` "Most of what goes wrong, WARD just fixes. The router drops, WARD sees it and reboots it remotely, and it is back. No human, no payment. This is Level 1, and it is the everyday case."
`[~click + 8s ON SCREEN]` Reasoning shows the reboot SUCCEEDED, the device returns green, the actor strip reads "no human required" and "no escrow needed", the treasury never moves (stays 500.00).
`[0:45 DO]` Click **Reset**. All four devices green again.

**0:50 to 2:15 · the hero case (L3 hire).**
`[0:50 DO]` Click **Trigger leak**. Blue ripples bloom in the laundry room, the legend flips to "Fault detected", the reasoning panel streams.
`[0:50 SAY]` "Now the case software cannot fix. A 2am leak. WARD tries the free fix, closing the valve, but the burst is upstream. So it does what you cannot do at 2am: it hires a human, on-chain."

`[click + ~11s SAY]` (ENS badge lands) "It is looking up workers via ENS. Mike's identity is live at mike.ward-agent.eth, with verified skills and reputation in his records."
`[ON SCREEN]` ENS badge on the registry line: `ENS · ward-agent.eth subnames · ENSIP-26 records`.

`[click + ~15s SAY]` (Arc badge + escrow tx land) "150 USDC just locked in a conditional escrow on Arc. The contract is verified, that hash is clickable on arcscan."
`[ON SCREEN]` Treasury ticks 500 to 350. Escrow-created proof row with the Arc badge and the real tx.

`[click + ~16s DO]` During the pause before the worker arrives, click the Escrow-created tx hash: arcscan opens on the verified WardEscrow contract. Hold ~3 seconds, return.

`[click + ~21s ON SCREEN]` The worker avatar walks in, wrench beat, the leak room returns to green.
`[SAY]` "Mike is on site and fixes it. The sensor reads dry again."

`[click + ~25s SAY]` (Chainlink badge lands) "Chainlink CRE just attested the sensor reads dry and triggered release. No human approved this payment, the workflow did."
`[ON SCREEN]` Chainlink CRE badge on the attestation line: `Chainlink · CRE attested fix · WriteReport to Arc`.

`[click + ~27s SAY]` (settled tx lands) "Payment released to Mike, on-chain forever. The whole loop just settled itself."
`[ON SCREEN]` Treasury recovers to 500, Settled proof row + release tx, actor strip shows Mike "paid".

`[~1:20 DO]` Click Mike's avatar (the ENS profile opens with live ENSIP-26 records + ENSIP-25 verification). Optionally open `/workers` from the footer to show the full roster ranked by skill, ETA, and reputation.
`[SAY]` "This is Mike's ENS profile, resolved live from Sepolia. Skills, region, a reputation pointer, all in records he owns. Portable: another agent network could read the same record tomorrow and hire him, no re-signup."

`[~1:45 DO]` Gesture to the on-chain proof panel and the persistent legend + proof links at the bottom.
`[SAY]` "Every step maps to one system. ERC-8183 is the standard: WARD is the Client, Mike the Provider, the Chainlink workflow the Evaluator. Arc is the settlement rail. ENS is the identity. The proof for every step is one click away, right here."

### 2:15 to 2:45 · Why crypto (honest)
`[SAY]` "The homeowner is the demo because every judge has felt 2am home panic. But the real customer is software with no bank account. For one homeowner paying a local plumber, traditional payment rails work fine, credit cards, ACH, Venmo. The crypto matters when the buyer is a smart contract: a DePIN network paying the humans who service its hardware, an autonomous DAO, an AI agent treasury. Those literally can't open a bank account. WARD is the rails for them."

### 2:45 to 3:15 · Three integrations
`[DO]` Quick beats with each piece visible on screen.
`[SAY]` "Chainlink CRE is the orchestration layer: it fetches device telemetry, attests the fix on-chain, and triggers settlement. Arc is the settlement rail: gas-free USDC, sub-cent fees, conditional escrow built for agent economies, contracts verified on arcscan. ENS is the identity layer: the agent has a name, the workers carry portable on-chain reputation, all resolved live, nothing hardcoded."

### 3:15 to 3:30 · Close
`[DO]` Hit **Reset**, apartment calm, all green, treasury 500.
`[SAY]` "You're still in Tokyo. The leak is fixed, Mike got paid, every step is on-chain forever, settled by the sensor, not by anyone's approval. WARD. Your home runs itself. Today homeowners, tomorrow DePIN networks. That's it."

---

## RECORDING NOTES

- **Pre-roll:** open `/demo`, dismiss the intro overlay once (it only shows once per session), hit **Reset**, wait ~3 seconds, then start recording. The intro overlay's "Watch it work" button also triggers the leak, but for a clean take dismiss it and use the **Trigger leak** button in the trigger bar.
- **When to trigger:** click **Trigger leak** right after the 0:15 to 0:30 "what it is" narration lands, at about 0:30.
- **Measured badge times after the click:** ENS ~11s, Arc badge + escrow tx ~15s, Chainlink CRE ~25s, settled tx ~27s. Start each spoken line ~1 second before its badge so the badge is the visual punctuation, not an afterthought. Watch the screen: the badge is the true cue.
- **Drawing attention:** the badges are static (no animation). If one needs emphasis, mouse-hover it (the hover state lifts the border and shows the "open proof" affordance).
- **Show it's real:** click into arcscan during the ~5 second pause between the escrow lock (~15s) and the worker arriving (~20s). The on-chain proof panel and the three footer links (WardEscrow on arcscan, Workers on ENS, CRE workflow source) are always available for skeptics.
- **Settlement note:** the cinematic narrates 150 USDC; the tx links resolve to the real WardEscrow lifecycle on Arc (real settlement, faucet-bounded amount). If a judge clicks through, that is real on-chain proof, not a mock.
- **Hard rules (auto-reject if broken):** real human voiceover only, no AI voiceover or TTS, no speeding up the footage, 720p minimum, total length 2:00 to 4:00 (target 3:00 to 3:30), real screen capture software (OBS / ScreenStudio / QuickTime), not a phone.
