// Runtime config: Arc explorer base, contract addresses, ENS root.
// Reads deployments/<chain>.json if present, otherwise falls back to
// placeholder addresses so the mock build is fully self-contained.

import type { JobState } from "./data/types";

type Deployment = {
  chainId: number;
  WorkerRegistry: string;
  JobEscrow: string;
  MockUSDC: string;
  blockExplorer: string;
};

// Placeholder deployment — overwritten when deployments/<chain>.json lands.
const PLACEHOLDER_DEPLOYMENT: Deployment = {
  chainId: 8008,
  WorkerRegistry: "0xWARD000000000000000000000000000000Registry",
  JobEscrow: "0xWARD0000000000000000000000000000000Escrow0",
  MockUSDC: "0xWARD0000000000000000000000000000000000USDC",
  blockExplorer: "https://testnet.arcscan.app",
};

// At build time we cannot guarantee deployments/ exists, so we keep the
// placeholder static and let env vars override the explorer + addresses.
// When the real deployment lands, set NEXT_PUBLIC_DEPLOYMENT_* envs (or wire
// a JSON import here) and nothing else in the UI changes.
function readDeployment(): Deployment {
  return {
    chainId: numEnv("NEXT_PUBLIC_ARC_CHAIN_ID", PLACEHOLDER_DEPLOYMENT.chainId),
    WorkerRegistry:
      process.env.NEXT_PUBLIC_WORKER_REGISTRY ?? PLACEHOLDER_DEPLOYMENT.WorkerRegistry,
    JobEscrow: process.env.NEXT_PUBLIC_JOB_ESCROW ?? PLACEHOLDER_DEPLOYMENT.JobEscrow,
    MockUSDC: process.env.NEXT_PUBLIC_USDC_ADDRESS ?? PLACEHOLDER_DEPLOYMENT.MockUSDC,
    blockExplorer:
      process.env.NEXT_PUBLIC_ARC_EXPLORER ?? PLACEHOLDER_DEPLOYMENT.blockExplorer,
  };
}

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const deployment = readDeployment();

export const ENS_ROOT = "ward-agent.eth";
export const AGENT_ENS = "ward-agent.eth";

export const explorerTxUrl = (txHash: string) =>
  `${deployment.blockExplorer.replace(/\/$/, "")}/tx/${txHash}`;

export const explorerAddressUrl = (address: string) =>
  `${deployment.blockExplorer.replace(/\/$/, "")}/address/${address}`;

// ENS app deep link for a name (Sepolia). Worker subnames resolve here.
export const ensProfileUrl = (ensName: string) =>
  `https://sepolia.app.ens.domains/${ensName}`;

export const DATA_ADAPTER =
  (process.env.NEXT_PUBLIC_DATA_ADAPTER as "mock" | "supabase" | "live" | undefined) ??
  "mock";

// Base URL of the live WARD agent (its SSE / recent-events / healthz feed).
// Used by the "live" data adapter (NEXT_PUBLIC_DATA_ADAPTER=live).
export const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8091";

// Human-readable labels for job states (uppercase micro-labels stay uppercase).
export const JOB_STATE_LABEL: Record<JobState, string> = {
  OPEN: "OPEN",
  ACCEPTED: "ACCEPTED",
  WORK_DONE: "WORK DONE",
  ATTESTING: "ATTESTING",
  SETTLED: "SETTLED",
  EXPIRED: "EXPIRED",
  REFUNDED: "REFUNDED",
};
