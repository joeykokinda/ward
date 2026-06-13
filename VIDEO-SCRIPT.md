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

`[00:30 DO]` On `/demo`, click **Trigger leak** in the trigger bar. Blue ripples bloom in the laundry room, the legend flips to "Fault detected", the reasoning panel starts streaming.
`[00:30 SAY]` "Watch. The leak sensor tripped and WARD is awake. It diagnoses the fault, tries the free remote fix, and finds that water needs hands on a valve. So it hires a human, on-chain."

`[00:40 SAY]` (ENS badge lands ~00:41) "It's looking up workers via ENS. Mike's identity is live at mike.ward-agent.eth, with verified skills and reputation in his text records."
`[~00:41 ON SCREEN]` ENS badge appears on the registry line: `ENS · ward-agent.eth subnames · ENSIP-26 records`.

`[00:44 SAY]` (Arc badge + escrow tx land ~00:45) "150 USDC just locked in a conditional escrow contract on Arc. The contract is verified, and that hash is clickable on arcscan."
`[~00:45 ON SCREEN]` Treasury ticks 500 to 350. Escrow-created proof row appears with the Arc badge and the real tx.

`[00:46 DO]` During the pause before the worker arrives, click the Escrow-created tx hash. Arcscan opens on the verified WardEscrow contract. Hold ~3 seconds, then return to the demo.

`[~00:50 ON SCREEN]` The worker avatar walks in along the dashed path, wrench beat, the leak room returns to green.
`[00:50 SAY]` "Mike is on site and fixes it. The sensor reads dry again."

`[00:54 SAY]` (Chainlink badge lands ~00:55) "Chainlink CRE just attested that the sensor reads dry and triggered release on the escrow. No human approved this payment, the workflow did."
`[~00:55 ON SCREEN]` Chainlink CRE badge appears on the attestation line: `Chainlink · CRE attested fix · WriteReport to Arc`.

`[00:56 SAY]` (settled tx lands ~00:57) "Payment released to Mike, on-chain forever. The whole loop just settled itself."
`[~00:57 ON SCREEN]` Treasury recovers to 500, Settled proof row + release tx, actor strip shows Mike "paid".

`[00:58 DO]` Click Mike's avatar. The ENS profile modal opens with live ENSIP-26 records and ENSIP-25 verification.
`[00:58 SAY]` "This is Mike's ENS profile, resolved live from Sepolia. Skills, region, a reputation pointer, all in records he owns. It's portable: any other agent network can read it and hire him tomorrow, no re-signup."

`[01:30 DO]` Close the modal. Gesture to the on-chain proof panel and the persistent legend + proof links at the bottom.
`[01:30 SAY]` "Every step maps to one system. ERC-8183 is the standard: WARD is the Client, Mike is the Provider, and the Chainlink workflow is the Evaluator. Arc is the settlement rail, gas-free USDC built for this. ENS is the identity layer for the agent and the workers. The proof for every step is one click away, right here."

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
