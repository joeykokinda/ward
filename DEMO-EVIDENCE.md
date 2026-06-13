# WARD — On-chain Evidence (Arc Testnet, chainId 5042002)

Explorer: https://testnet.arcscan.app · USDC is the native gas + settlement asset (6dp).

## Contracts (live, verified wiring)

| Contract | Address |
|---|---|
| JobEscrow | `0x5585487A2EbabbE72406b72d5278dDFc5Ed706d8` |
| WorkerRegistry | `0xc59fabC06Cd268F826a905Cc13eD232a90A79CAc` |
| CreVerifier (MockCreVerifier; swaps to WardCreConsumer) | `0x985e4CCEb3ff73C60b3F9FbF2044B4cF394b267A` |
| USDC (native Arc) | `0x3600000000000000000000000000000000000000` |
| Agent wallet | `0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4` |
| Worker `mike.ward-agent.eth` | `0x6d7Bc6A9Ce537950a878A97E9669B48305B0f033` |

## First live sensor-settled escrow lifecycle (job #1) — all real Arc txs

| Step | tx |
|---|---|
| Worker approve (stake) | `0x6d51c8a9e50f15abb66083ce090733fcd56efb628436022646839b434ec8fb4e` |
| Worker register (mike.ward-agent.eth) | `0x961828c4f26547c534f8db99e4b05a690d2af81e3c0aa17ebecae60786b33291` |
| Worker stake 1 USDC | `0xc3b8f6c82f31f707dd77e26f9d67e36c550cc4dec9f549a9f86a91be8d7fd842` |
| Agent approve escrow | `0x36e87dbe37cf03065906add436e294ef218dcd18eab0ce6abe46caf6389fb488` |
| **createJob** (escrow 1 USDC) | `0x34081641789da06ada6856c4f8153cc696a28d23efca71b70dd84ee3ab64091c` |
| acceptJob | `0x26a99e8c00a79e71213ed814cb961984b28cbe4b1b00465d36b7ee4f511d2561` |
| markWorkDone | `0x97dbe3032f9f37a4e71e208590f40c80d6190bacb8fa42d5c2562d0ce68bcbb8` |
| **settle** (attested healthy → release) | `0x4e3d320ee9d2c4644be6caaed1fe4e1785c92ef57483b64429f8a497d34cb1cc` |

Post-state (via `cast`): `jobState(1) == 4` (Settled), `reputationOf(worker) == 1`, USDC released to worker, escrow drained. **Proof-of-physical-work settlement, end-to-end, on Arc.**

## Chainlink CRE — qualifying simulation (GREEN)

`cre workflow simulate ./workflow --target local-simulation-settings` fetched the live sim `https://brach.taild3399f.ts.net/device/prop-2-router/status`, computed `healthy=true`, ran identical-consensus, and produced `EVM Chain WriteReport Dry-Run Successful` → `settled jobId=1`. Arc chain-selector `3034092155422581607`. Full log: `cre/sim-output-live.txt`.

## Backend (always-on, public)

- Sim: `https://brach.taild3399f.ts.net` · Agent SSE: `https://brach.taild3399f.ts.net:8443` (systemd-persistent on `brach`).
