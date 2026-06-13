# WARD — Pre-committed Cut Rules

Decided now, while calm, so 3am decisions are mechanical.

## The rule

If any single integration blocks for **more than 2 hours** after a serious attempt: cut it and proceed. The demo working perfectly is worth more than any single bounty.

## Never cut (anchors)

- Chainlink CRE (with its booth-confirmed architecture)
- Arc escrow (fallback: Base Sepolia, disclosed honestly to judges)
- ENS on Sepolia (stays regardless)
- The one perfect demo flow (detect → fail reboot → escrow → accept → CRE attest → release)

## Cut order when time pressure hits (first cut at top)

1. Stretch anything (Confidential AI Attester, x402 nanopayments) — already default-off.
2. ENSIP-25 verification (keep subnames + ENSIP-26 records, which carry the ENS pitch).
3. Owner human-in-the-loop approval UI (keep the threshold in the contract, mention in pitch).
4. Agent view persona (fold its key facts into Host header).
5. QR-code worker phone flow (fall back to second tab on laptop).
6. Supabase persistence (fall back to onchain events + local JSON; lose cross-visit reputation accumulation).
7. LLM diagnosis (fall back to scripted diagnosis text; disclose; the settlement primitive is the product, not the LLM).
8. 5 workers → 2 workers; 3 properties → 1 property.

## Fallback ladder for the chain question

1. CRE writes to Arc → single chain, ideal.
2. CRE writes elsewhere only → escrow on Base Sepolia + Circle stack to settle USDC toward Arc, OR escrow stays on Base Sepolia entirely; disclose honestly.
3. CRE unusable after serious attempt → authorized-oracle-key attestation pattern on Arc; drop Chainlink bounty; Arc + ENS survive. (This violates "never cut CRE" only as the absolute last resort and requires rex's explicit sign-off.)

## What never changes

Design tokens/bans (DESIGN.md), the three-bounty cap, commit-in-intervals rule, the ENS Sunday booth gate, honest disclosure of any fallback taken.
