# WARD — Contracts

The **Proof-of-Physical-Work escrow** at the core of WARD: an AI agent posts a
USDC-funded job to fix an instrumented device, and the contract releases payment
**only** when a machine attestation (verified through the Chainlink CRE seam)
proves the device is healthy again. No human "approve" sits in the happy path.

This is the implementation for two bounties:
- **Chainlink — Best workflow with CRE** (anchor): `settle()` is gated on a CRE
  attestation, isolated behind a single swappable interface.
- **Arc — USDC conditional escrow** (Advanced Stablecoin Logic): `JobEscrow`
  holds native USDC with per-job + daily caps, owner-approval threshold, and
  deadline auto-refund.

Toolchain: Foundry (forge/cast/anvil 1.7.1), Solidity `0.8.24`, OpenZeppelin
contracts `5.6.1`.

---

## Contracts

| Contract | Purpose |
|---|---|
| `src/MockUSDC.sol` | 6-decimal ERC20 standing in for native USDC on local/test nets. Public `mint`. On Arc, the real native USDC replaces it (pass `USDC_ADDRESS`). |
| `src/WorkerRegistry.sol` | Worker directory + reputation ledger. `register(handle, ensName, skills, region)`, `stakeUSDC(amount)`, `reputationOf`, `getWorker`, `isActiveWorker`. A worker is **active** only when registered AND staked. `bumpReputation` is callable only by the one trusted `JobEscrow` (set once by owner). Events `WorkerRegistered` / `ReputationBumped`. |
| `src/JobEscrow.sol` | The conditional escrow. `createJob` (pulls USDC, enforces per-job + daily caps, requires `ownerApproved` when `amount > threshold`), `acceptJob` (active workers only), `markWorkDone` (assigned worker), `settle` (verifies CRE attestation, pays worker, bumps reputation), `refundExpired` (after deadline). Holds USDC in escrow per job. `ReentrancyGuard` on every fund-moving entrypoint; checks-effects-interactions throughout. |
| `src/interfaces/ICreConsumer.sol` | **The CRE seam.** Single interface `verifyHealthy(HealthAttestation) -> bool` that isolates attestation verification from job logic. |
| `src/AuthorizedReporterVerifier.sol` | Production CRE-seam implementation: accepts an attestation iff it carries a valid ECDSA signature from one trusted `reporter` (the CRE forwarder, or a fallback authorized oracle), with domain separation (chainid + contract address) and a freshness window. |
| `src/mocks/MockCreVerifier.sol` | Test/demo CRE-seam double: returns a settable healthy/unhealthy result, no signatures. Used by tests and the local Seed. |

State machine (INTERFACES.md): `OPEN → ACCEPTED → WORK_DONE → SETTLED`, with
`REFUNDED` as the off-happy-path terminus. (`ATTESTING` is the transient moment
inside `settle()`, not a stored resting state.) The enum is
`{None=0, Open=1, Accepted=2, WorkDone=3, Settled=4, Refunded=5}`.

Demo economics (INTERFACES.md): USDC has 6 decimals; demo job = `75_000000`
(75 USDC); owner-approval threshold = `100_000000` (100 USDC), so the demo job
settles **autonomously**, and only jobs above 100 USDC need the host's approval.

---

## The CRE seam (critical design)

WARD's whole thesis is that funds release on a **machine-attested physical
fact**, not human approval. The mechanism that delivers that fact was gated on
the Chainlink booth answer (see `../SPIKES.md`). To let that mechanism change
without ever touching job logic, **all** verification lives behind one interface:

```
JobEscrow.settle(jobId, attestation)
    └─> creVerifier.verifyHealthy(attestation) -> bool   // ICreConsumer
```

`JobEscrow` never inspects signatures, forwarder addresses, report encodings, or
oracle keys. It trusts only the boolean. Swapping the verifier is a single
owner call (`setCreVerifier`) or a constructor argument, with **zero** edits to
the lifecycle. This maps directly onto the SPIKES.md decision matrix:

| SPIKES.md outcome | Verifier to deploy | Change to job logic |
|---|---|---|
| CRE → Arc directly | `AuthorizedReporterVerifier`, `reporter` = CRE forwarder | none |
| CRE → other EVM only | escrow on Base Sepolia, same `AuthorizedReporterVerifier` | none |
| A NO_GO + B GO (last resort) | `AuthorizedReporterVerifier`, `reporter` = authorized oracle key (rex sign-off) | none |
| Tests / local demo | `MockCreVerifier` | none |

The attestation is bound to `(jobId, deviceId, healthy, reportTimestamp)` plus an
opaque `signature` blob, so one interface carries either an ECDSA reporter
signature or a CRE report payload. `verifyHealthy` reverts on an unauthentic,
stale, or mis-targeted attestation (so the escrow surfaces a precise error) and
returns `false` only for an authentic "still unhealthy" report. The full design
note is the comment block at the top of `src/interfaces/ICreConsumer.sol`.

---

## Build, test, verify

```bash
export PATH="$HOME/.foundry/bin:$PATH"

forge build          # clean compile, no warnings
forge test -vv       # full suite
```

### Local end-to-end (anvil)

```bash
export PATH="$HOME/.foundry/bin:$PATH"

anvil &                                                        # chain id 31337
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
./export-abis.sh                                               # ABIs -> deployments/abis/
forge script script/Seed.s.sol   --rpc-url http://127.0.0.1:8545 --broadcast
```

`Deploy` writes `deployments/31337.json` and (via `export-abis.sh`) the ABIs.
`Seed` registers + stakes 5 workers (`mike, sara, deon, lena, raj`, derived from
the standard test mnemonic `test test … junk`, indices 1–5; the agent is index
0), mints the agent 500 USDC, and creates + accepts + works + **settles** 3
historical jobs so a fresh deploy already shows history.

### Test results

`forge test` — **50 passed, 0 failed** across 4 suites:

- `WardLifecycle.t.sol` (27): full happy path (create → accept → markDone →
  settle, asserting reputation bump + USDC moved + all events), per-job cap +
  boundary, daily cap + next-day reset, owner-approval threshold gating
  (above/at/below, 75 USDC autonomous), only-active-worker acceptance
  (unregistered + registered-but-unstaked rejected), refund after deadline
  (from Open/Accepted/WorkDone), settle rejects unhealthy device, settle rejects
  a reverting verifier, settle rejects wrong-job / wrong-device attestation,
  state-machine guards, create-job input guards.
- `WorkerRegistry.t.sol` (13): register + profile storage + events, double
  register, stake pull + activation + accumulation, stake-before-register,
  zero-stake, reputation authorization (escrow-only, stranger rejected,
  unregistered rejected), escrow wiring (set-once, owner-only, non-zero).
- `AuthorizedReporterVerifier.t.sol` (9): valid reporter signature, authentic
  unhealthy → false, wrong signer, stale, future-dated, tampered healthy flag,
  reporter rotation, non-owner rejected, cross-deployment replay rejected.
- `Reentrancy.t.sol` (1): a malicious ERC20 re-enters `settle` on the payout
  transfer; `nonReentrant` blocks the second entry, worker is paid exactly once,
  escrow drains to zero, reputation bumps once.

Confirmed on anvil after Deploy + Seed: `nextJobId == 4`, jobs 1–3 in state
`4` (Settled), `mike`/`sara`/`deon` reputation `== 1`, each paid `75_000000`
USDC, escrow balance `== 0`.

---

## `deployments/<chainId>.json` shape

```json
{
  "chainId": 31337,
  "MockUSDC": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "WorkerRegistry": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  "CreVerifier": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  "JobEscrow": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  "blockExplorer": "http://localhost:8545"
}
```

(INTERFACES.md requires `chainId, WorkerRegistry, JobEscrow, MockUSDC,
blockExplorer`; `CreVerifier` is included so the frontend/agent can render the
attestation source.) ABIs land in `deployments/abis/<Contract>.json` as raw ABI
arrays for `MockUSDC`, `WorkerRegistry`, `JobEscrow`, `AuthorizedReporterVerifier`.

---

## Live deploy — exact commands (run only when credentials arrive)

Set env in the root `.env` (never commit it). All values are read by the script;
**nothing is hardcoded**.

```bash
export PATH="$HOME/.foundry/bin:$PATH"

# Required for a live deploy:
export PRIVATE_KEY=0x...                 # deployer key
export BLOCK_EXPLORER=https://explorer.arc.network   # written into the json
# Optional — drive the CRE seam choice:
export USDC_ADDRESS=0x...                # Arc native USDC; omit to deploy MockUSDC
export CRE_REPORTER=0x...                # CRE forwarder / authorized oracle.
                                         #   set => AuthorizedReporterVerifier
                                         #   unset => MockCreVerifier
export CRE_MAX_REPORT_AGE=3600           # attestation freshness window (seconds)
export OWNER_APPROVAL_THRESHOLD=100000000   # 100 USDC (INTERFACES.md default)
export PER_JOB_CAP=200000000                # 200 USDC
export DAILY_CAP=1000000000                 # 1000 USDC
```

### Primary target — Arc testnet (per ARCHITECTURE.md / BOUNTIES.md)

```bash
forge script script/Deploy.s.sol \
  --rpc-url "$ARC_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
./export-abis.sh
# optional contract verification (Arc explorer / Blockscout):
#   add: --verify --verifier blockscout --verifier-url <arc-explorer-api>
```

### Fallback — Base Sepolia (SPIKES.md "CRE → other EVM only" / Arc blocked)

```bash
forge script script/Deploy.s.sol \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --verify --etherscan-api-key "$ETHERSCAN_API_KEY"
./export-abis.sh
```

The `Seed` script targets local anvil (it uses the test mnemonic's pre-funded
accounts and the mock verifier's auto-healthy attestation). For a live network,
seed via the agent (`agent/`) using funded keys and a real attestation source.

---

## Needs a credential / external answer to go live

- **Chainlink booth answer** (does CRE write to Arc directly?) — selects the
  verifier wiring per the table above. Until it lands, deploy with the mock
  (`CRE_REPORTER` unset). No code change either way.
- **`CRE_REPORTER`** — the live CRE forwarder address (or fallback authorized
  oracle key). Required for the production attestation path.
- **`PRIVATE_KEY`** + funded deployer — Arc testnet ETH/USDC-gas; Circle faucet
  for Arc testnet USDC.
- **`ARC_RPC_URL`** / **`SEPOLIA_RPC_URL`** — network endpoints.
- **`USDC_ADDRESS`** — Arc native USDC address (omit on local; MockUSDC deploys).
- **Explorer verification API** — for `--verify` (Arc explorer or Etherscan).
