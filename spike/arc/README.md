# WARD Spike B — Arc Testnet + USDC

**Status: BLOCKED_ON_FUNDING** (chain + tooling verified GO; only testnet USDC is missing).

Everything fund-independent is proven against live Arc state. The only thing standing
between this and a green deploy is testnet USDC in the throwaway wallet, which the Circle
faucet gates behind a browser reCAPTCHA (no programmatic faucet found).

## Verified facts (live, this spike)

| Fact | Value | How verified |
|---|---|---|
| RPC URL | `https://rpc.testnet.arc.network` | `cast chain-id` returned 5042002 |
| Chain ID | `5042002` (hex `0x4CF552`) | live RPC + docs.arc.io |
| Alt RPCs | Blockdaemon / dRPC / QuickNode `rpc.<provider>.testnet.arc.network` | docs.arc.io/references/connect-to-arc |
| WebSocket | `wss://rpc.testnet.arc.network` | docs.arc.io |
| Gas token | **USDC** (gas is paid in USDC, not ETH) | docs.arc.io; `cast gas-price` ~20 gwei-USDC |
| Native USDC ERC-20 | `0x3600000000000000000000000000000000000000` | `cast call symbol()` -> "USDC", `decimals()` -> 6 |
| USDC decimals | **6** (ERC-20 interface) | live `decimals()` call — matches INTERFACES.md |
| Explorer | `https://testnet.arcscan.app` (**Blockscout**) | docs.arc.io + blockscout app pages |
| Verification | Blockscout, no API key | `forge verify-contract --verifier blockscout` |
| Faucet | `https://faucet.circle.com` (select Arc Testnet) | docs.arc.io; **reCAPTCHA-gated, browser only** |
| Faucet limits | 20 USDC / address / 2h; also EURC, cirBTC | faucet.circle.com |

Other useful Arc testnet contracts (docs.arc.io/references/contract-addresses):
EURC `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`,
Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`,
CCTP v2 TokenMessenger `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`.

## Throwaway wallet

Address: **`0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4`**
(private key in `./.env`, `chmod 600`, never commit). Balance currently 0.

## Files

- `src/MinimalEscrow.sol` — dependency-free USDC escrow smoke-test stub (lock/release).
  NOT the production JobEscrow; just proves the Arc deploy+interact loop.
- `script/DeployAndInteract.s.sol` — deploys the stub, then approve -> lock 1 USDC -> release.
- `.env` — RPC, chain id, USDC address, throwaway deployer (mode 600).
- `foundry.toml` — reuses `../../contracts/lib` for forge-std (no extra install).

## BLOCKED_ON_FUNDING — the exact manual step

No programmatic faucet exists. To unblock:

1. Open `https://faucet.circle.com` in a browser.
2. Network = **Arc Testnet**, token = **USDC**, paste address
   `0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4`.
3. Solve the reCAPTCHA, submit. You get 20 USDC (also covers gas — gas is USDC on Arc).
4. Re-run twice if you want headroom (limit: 20 USDC / 2h).

Confirm funding:
```bash
export PATH="$HOME/.foundry/bin:$PATH"
cast call 0x3600000000000000000000000000000000000000 \
  "balanceOf(address)(uint256)" 0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4 \
  --rpc-url https://rpc.testnet.arc.network
```

## THE single command to run once funded

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cd spike/arc
set -a; source .env; set +a
forge script script/DeployAndInteract.s.sol \
  --rpc-url "$ARC_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast --slow
```

To also verify the deployed contract on arcscan (Blockscout):
```bash
forge verify-contract <DEPLOYED_ADDR> src/MinimalEscrow.sol:MinimalEscrow \
  --chain-id 5042002 \
  --verifier blockscout \
  --verifier-url https://testnet.arcscan.app/api/ \
  --constructor-args $(cast abi-encode "constructor(address)" 0x3600000000000000000000000000000000000000)
```

## Honest caveats found during the spike

- **Do NOT trust forge's local-fork simulation of native-USDC transfers.** Arc's native
  USDC is a proxy (delegatecall to `0x3910...`) with a blocklist hook precompile at
  `0x1800000000000000000000000000000000000001`. forge's local fork can't execute that
  precompile, so a *dry-run* (no `--broadcast`) reverts with `StackUnderflow` inside
  `isBlocklisted`. This is a simulation artifact, not a contract bug. Deploy/interact
  must be exercised with `--broadcast` against live Arc. (Plain ETH-style value transfers
  and contract deploys simulate fine; only the USDC precompile path is affected.)
- Deploy was confirmed up to `transferFrom` in dry-run: `MinimalEscrow` deploys (1357
  bytes), `approve` succeeds; `lock` reverts only because balance is 0.

## Go/No-Go

**GO for Arc as the escrow chain** once funded. Chain is live, USDC is native with 6
decimals (matches our contracts), Blockscout verification is available, gas is USDC.
Single blocker is the manual reCAPTCHA faucet.
