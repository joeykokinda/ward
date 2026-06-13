# WARD — On-chain Evidence (Arc Testnet, chainId 5042002)

Explorer base: https://testnet.arcscan.app/tx/ · USDC is the native gas + settlement asset (6dp).

## Contracts (current canonical deployment — ERC-8183 WardEscrow)

These are the live addresses. They supersede any older addresses that may appear elsewhere.

| Contract | Address |
|---|---|
| WorkerRegistry | `0x2bdDf43350A5E79cf4fCc2A15f4a6905f9553bB4` |
| WardEscrow (ERC-8183, keyed JobEscrow) | `0xe118A51B105DF46F54AE4Fb01a1EF43F6a8dE5D8` |
| Evaluator | `0xDdd0047d0664235998791fe2163Bb9b31c2Fc038` |
| USDC (native Arc, 6dp, also gas) | `0x3600000000000000000000000000000000000000` |

## Live ERC-8183 lifecycle (current deployment)

Full ERC-8183 Job: Open → Funded → Submitted → Completed. All transactions on Arc testnet.

| ERC-8183 step | tx hash |
|---|---|
| createJob | [`0xe65a7352007bf269874f4bf83e138c67d29d24d9009facd083af296cbcebf217`](https://testnet.arcscan.app/tx/0xe65a7352007bf269874f4bf83e138c67d29d24d9009facd083af296cbcebf217) |
| setBudget | [`0xb4875473ae81ba87b4a9424bf9c8ac743a02a69efea8d4601ab0e0cd44542bd4`](https://testnet.arcscan.app/tx/0xb4875473ae81ba87b4a9424bf9c8ac743a02a69efea8d4601ab0e0cd44542bd4) |
| fund | [`0x1afb161733819d2004d24d10bf13312ba941e91394e9f3463a90df2240e01ea0`](https://testnet.arcscan.app/tx/0x1afb161733819d2004d24d10bf13312ba941e91394e9f3463a90df2240e01ea0) |
| submit | [`0x48d22cd077f7e32670a2589e977991a6917b511f3cc6c515449f72065360827a`](https://testnet.arcscan.app/tx/0x48d22cd077f7e32670a2589e977991a6917b511f3cc6c515449f72065360827a) |
| complete (Evaluator attests, USDC releases) | [`0x0cf9c5a691225575de86937491fb6ae577c1f3e2b7a49959104a6c3a6084cb8d`](https://testnet.arcscan.app/tx/0x0cf9c5a691225575de86937491fb6ae577c1f3e2b7a49959104a6c3a6084cb8d) |

**Proof-of-Physical-Work settlement, end-to-end, on Arc. ERC-8183 implemented.**

## Chainlink CRE — qualifying simulation (GREEN)

`cre workflow simulate ./workflow --target local-simulation-settings` fetched the live sim `https://brach.taild3399f.ts.net/device/prop-2-router/status`, computed `healthy=true`, ran identical-consensus, and produced `EVM Chain WriteReport Dry-Run Successful` → settled. Arc chain-selector `3034092155422581607`. Full log: `cre/sim-output-live.txt`.

## ENS (Sepolia)

- Agent primary name: `ward-agent.eth`
- Worker subnames: `mike.ward-agent.eth` (and others)
- ENSIP-26 text records: skills, region, reputation pointer per worker subname
- ENSIP-25 agent name verification: wired

## Backend (always-on, public)

- Sim: `https://brach.taild3399f.ts.net` · Agent SSE: `https://brach.taild3399f.ts.net:8443` (systemd-persistent on `brach`).
