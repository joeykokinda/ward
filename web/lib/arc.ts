// Canonical Arc testnet deployment for the /live experience. These are the
// verified, on-chain WARD contracts (deployments/5042002.json) — the live page
// links every address straight to arcscan so a judge can open the deployed
// contracts and the real settlement txns. Single source of truth for the
// "Deployed on Arc" panel; env overrides are honored where present so a
// re-deploy to a new address needs no code change.

export const ARC = {
  chainId: 5042002,
  network: "Arc testnet",
  explorer: (process.env.NEXT_PUBLIC_ARC_EXPLORER ?? "https://testnet.arcscan.app").replace(/\/$/, ""),
  rpc: "https://rpc.testnet.arc.network",
  // WardEscrow — ERC-8183 Agentic Commerce escrow (holds native USDC).
  escrow: process.env.NEXT_PUBLIC_JOB_ESCROW ?? "0xe118A51B105DF46F54AE4Fb01a1EF43F6a8dE5D8",
  // WorkerRegistry — on-chain worker identity + reputation.
  registry: process.env.NEXT_PUBLIC_WORKER_REGISTRY ?? "0x2bdDf43350A5E79cf4fCc2A15f4a6905f9553bB4",
  // Native USDC (6dp) — also the gas asset on Arc.
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000",
  // Evaluator EOA — the Chainlink CRE oracle that signs complete() on attestation.
  evaluator: process.env.NEXT_PUBLIC_ARC_EVALUATOR ?? "0xDdd0047d0664235998791fe2163Bb9b31c2Fc038",
  // Agent / deployer wallet (funds escrow). Overridden live by /healthz.
  agent: "0xDCe59831DbA9Ea1B097Ef3f16993667D756bAea4",
} as const;

export const arcAddressUrl = (address: string) => `${ARC.explorer}/address/${address}`;

// brach emits the explorer URL with a bare 64-hex hash (no 0x); arcscan returns
// 422 without the prefix, so normalize it before linking.
export const normalizeArcTxUrl = (url: string) =>
  url.replace(/\/tx\/(?!0x)([0-9a-fA-F]{64})\b/, "/tx/0x$1");

