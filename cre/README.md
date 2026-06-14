# WARD Spike A — Chainlink CRE attestation workflow (ANCHOR bounty)

**Status: GO (headless build proven; simulation needs a free CRE_API_KEY).**

## THE critical question — answered

**Does a Chainlink CRE workflow write onchain to Arc testnet? → YES.**

Three independent confirmations:
1. **CRE Supported Networks** (`docs.chain.link/cre/supported-networks-ts`) lists **Arc Testnet**
   (min CLI v1.0.7+, Go SDK v1.1.4+, **TS SDK v1.3.1+**).
2. **CRE Forwarder Directory** (`docs.chain.link/cre/.../forwarder-directory-ts`) has a live
   production **Arc Testnet Forwarder**: chain name `arc-testnet`, address
   **`0x76c9cf548b4179F8901cda1f8623568b58215E62`** (viewable on testnet.arcscan.app).
   A CRE workflow can only write to a chain that has a deployed Forwarder — Arc has one.
3. The installed CRE CLI (v1.20.0) **compiled this workflow with `arc-testnet` in
   `project.yaml` and zero `--allow-unknown-chains`** — the chain-selectors registry
   recognizes Arc.

**Architecture decision — "CRE → Arc directly": IDEAL / single-chain.**
The plan stands: the CRE workflow attests device health and settles JobEscrow on Arc.
No Base-Sepolia detour, no cross-chain relay needed.

## What's in here

```
cre/
  project.yaml                 CRE project settings; arc-testnet RPC per target
  foundry.toml                 builds the consumer against the shared ICreConsumer seam
  contracts/WardCreConsumer.sol the onchain consumer (compiles clean — see below)
  workflow/
    index.ts                   the workflow (typechecks clean; builds to WASM)
    abi.ts                     onReport ABI
    config.json                run config (placeholder API + arc-testnet target)
    workflow.yaml              local-simulation + production-testnet targets
    package.json / tsconfig.json
    binary.wasm                compiled artifact (2.4 MB, produced headless)
  .env.example                 CRE_API_KEY / key seams (none needed to BUILD)
```

## Toolchain (all installed + verified on this Linux box, no GUI, no sudo for the CLI)

| Tool | Version | Notes |
|---|---|---|
| CRE CLI | **v1.20.0** | `curl -sSL https://cre.chain.link/install.sh \| bash` → `~/.cre/bin/cre` |
| `@chainlink/cre-sdk` | **1.11.0** | satisfies Arc's TS SDK ≥1.3.1 requirement |
| bun | 1.3.14 | SDK engine needs ≥1.2.21 ✓ |
| viem / zod | 2.34.0 / 3.25.76 | SDK peer deps |

## The onchain-write pattern (forwarder → onReport consumer)

CRE's write path, verbatim from `smartcontractkit/cre-sdk-typescript` `on-chain-write`:
`runtime.report(prepareReportRequest(callData))` → `evmClient.writeReport({ receiver, report })`.
The DON's **Forwarder** (the `arc-testnet` address above) verifies the report and calls
`receiver.onReport(bytes metadata, bytes report)` (the `IReceiver`/ERC-165 seam). Our
`WardCreConsumer.onReport` validates `msg.sender == forwarder` (+ optional workflow
owner/name, mirroring Chainlink's `ReceiverTemplate`), decodes
`abi.encode(uint256 jobId, bool healthy)`, records it, and calls `JobEscrow.settle(...)`
in the same Arc transaction. `WardCreConsumer` also implements `ICreConsumer.verifyHealthy`
so it can be wired as the escrow's `creVerifier` (pull mode) instead.

**Two valid wirings of the shared `contracts/src/interfaces/ICreConsumer.sol` seam:**
- **PUSH (this consumer, "CRE → Arc directly"):** Forwarder → `WardCreConsumer.onReport`
  → `JobEscrow.settle`. Most literally demonstrates "a CRE workflow writes onchain to Arc".
- **PULL (existing `AuthorizedReporterVerifier`):** CRE signs a `HealthAttestation`;
  the escrow recovers the signature against the trusted CRE reporter key. No extra write.
Both leave `JobEscrow` job logic untouched (the point of the seam).

## Trigger / secrets / latency notes

- **Trigger:** cron (`CronCapability`, 6-field seconds-leading schedule). CRE also supports
  HTTP and EVM-log triggers; cron fits WARD's "re-check device until fixed" loop.
- **Consensus:** DON nodes each fetch the device status independently;
  `consensusIdenticalAggregation()` requires they agree on the healthy/unhealthy boolean.
- **Secrets:** none needed for the public WARD sim. If the sim later needs an API key, it
  goes in `secrets.yaml` + encrypted with the workflow-owner key (deploy-time only).
- **Latency:** simulation runs locally in seconds (build is sub-second). Live DON rounds
  take longer; for the demo, pre-stage one settled cycle on arcscan and trigger a live
  cycle at pitch start (the latency contingency) — not required, just insurance.

## What was PROVEN headless (no account, no funds)

- `cre workflow build ./workflow` → **`✓ Workflow compiled successfully`**, emitted
  `binary.wasm` (2.4 MB, WebAssembly MVP module, hash
  `f0cd018d4a1fdd43a8e9e46faebd3ef2396232f15bf6a522dc97c87f3d1a0df3`). This proves the
  workflow source + SDK + WASM toolchain are all valid end-to-end.
- `tsc --noEmit` on `index.ts` → **clean** (every CRE SDK import verified to exist).
- `forge build` on `WardCreConsumer.sol` against the real `ICreConsumer` → **clean**.

## What `cre workflow simulate` needs (the one gap) — and why it's not a blocker

`cre workflow simulate` **requires authentication** — it failed with:
> `✗ authentication required: not logged in and no CRE_API_KEY set`

The CLI is explicit that this is satisfiable **headlessly** (its own help text says
"For non-interactive environments (CI/CD, automation, AI agents), set the CRE_API_KEY
environment variable"). A dummy `CRE_API_KEY` got *past* the local gate and was rejected
only by the remote auth server (`invalid token`), confirming a **valid key makes simulate
fully headless — no browser**.

**To run the qualifying CLI simulation (bounty evidence):**
```bash
# 1. Create a free CRE account + API key: https://app.chain.link  (Account Settings)
export CRE_API_KEY=<your-key>
export PATH="$HOME/.cre/bin:$PATH"
cd cre

# 2. Simulate (NO --broadcast → no onchain write, just the API fetch + report build):
cre workflow simulate ./workflow --target local-simulation

# 3. Live onchain write to Arc (after deploying WardCreConsumer + funding a key):
cre workflow simulate ./workflow --target local-simulation --broadcast
#   requires CRE_ETH_PRIVATE_KEY funded with Arc USDC (gas is USDC on Arc).
```
Capture the stdout — that simulation log is the Chainlink bounty's qualifying evidence.
Chainlink's standing offer: show them the simulation and their team deploys it to live CRE.

## SWAP-BEFORE-DEMO (all in `workflow/config.json`, no code change)

| Field | Placeholder now | Set to |
|---|---|---|
| `statusUrl` | `https://jsonplaceholder.typicode.com/todos/1` (returns `{completed:true}`) | `https://<live-sim-host>/device/prop-2-router/status` |
| `jobId` | `1` | the JobEscrow jobId being settled |
| `evms[0].wardConsumerAddress` | `0x0…0` | deployed `WardCreConsumer` on Arc |
| `evms[0].chainSelectorName` | `arc-testnet` | (keep) |

The placeholder lets the workflow build + simulate end-to-end with zero external infra;
`index.ts` has a documented branch that treats `{completed:true}` as "device healthy" and
parses the real `DeviceStatus` (`online===true && faultMode==="none"`) once `statusUrl`
points at the live WARD sim.

## Reproduce the build

```bash
export PATH="$HOME/.cre/bin:$PATH"
cd cre/workflow && bun install && cd ..
cre workflow build ./workflow --target local-simulation   # -> workflow/binary.wasm
```

## Credentials needed to go LIVE (none needed to build/typecheck)

| Step | Credential | Where |
|---|---|---|
| `cre workflow simulate` | **CRE_API_KEY** (free) | app.chain.link → Account Settings |
| `--broadcast` / `cre workflow deploy` | funded Arc key (USDC gas) | Circle faucet (manual, see spike/arc) |
| deploy `WardCreConsumer` | funded Arc deployer | same |
| live workflow registration | CRE deploy access (`cre account access`) | app.chain.link |

## Go/No-Go

**GO.** Arc is a first-class CRE target with a live Forwarder; the workflow compiles to
WASM and typechecks; the consumer compiles against the production seam. The only thing
between here and a captured simulation log is a free `CRE_API_KEY` (headless, no GUI).
