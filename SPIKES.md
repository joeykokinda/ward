# WARD — Spikes

Go/no-go gates. **Nothing here runs until rex says "begin building."** The CRE spike additionally waits for the Chainlink booth answer.

## The critical open question

**Does a Chainlink CRE workflow write to Arc testnet?** rex asks the Chainlink booth directly (workshop 4:30pm Fri, Workshop Room 2).

| Booth answer | Architecture |
|---|---|
| CRE → Arc directly | Ideal. Single chain: CRE report settles JobEscrow on Arc. Plan stands. |
| CRE → other EVM chains only | Escrow on Base Sepolia; settle USDC toward Arc via Circle's stack; disclose the topology honestly. |
| CRE works but rounds take minutes | Keep architecture; demo engineering: pre-stage one complete cycle on the Arc explorer, trigger live cycle at pitch start so it lands in Q&A. |

**Do not start the CRE integration until the booth answer is confirmed.**

## Spike A — CRE workflow round trip (after booth answer + "begin building")

- Scaffold with CRE CLI + TS SDK (docs.chain.link/cre, cre-templates repo).
- Simulate a workflow fetching a public JSON API; demonstrate the onchain write path to a consumer contract on the booth-confirmed chain.
- Capture simulation output (this is bounty evidence). Note secrets handling, trigger types (cron/HTTP), forwarder/onReport pattern, latency.
- Deliverables in `spike/cre/`: workflow source, sim logs, consumer stub, README recipe.

## Spike B — Arc testnet + USDC (after "begin building"; independent of booth answer)

- docs.arc.io: RPC, chain id, gas model (USDC-gas?), explorer + verification; Circle faucet for Arc testnet USDC.
- `cast wallet new` → .env (chmod 600). Deploy minimal escrow stub with Foundry, verify, USDC transfer in/out.
- Deliverables in `spike/arc/`: scripts, stub, README with endpoints/fees/faucet process.

## Decision matrix after both spikes

- A GO + B GO → build per ARCHITECTURE.md on the booth-confirmed topology.
- A GO + B NO_GO → escrow on Base Sepolia (CUTS.md fallback), disclose.
- A NO_GO + B GO → last-resort authorized-oracle pattern on Arc, requires rex sign-off (CUTS.md).
- Both NO_GO → STOP. Report to rex before any more code.

## Spike rules

Timebox per spike: serious attempt, then report honestly (GO / BLOCKED_ON_FUNDING / NO_GO + evidence). Faucets may need manual browser steps; surface immediately. Spike code is throwaway but committed (progression history).
