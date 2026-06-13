// WARD ENS identity layer — public surface for the frontend (web/lib) and agent.
//
//   import { resolvePrimaryName, readWorkerRecord, verifyWardAgent,
//            discoverWorkers, buildMintPlan } from "@ward/ens";
//
// Everything here queries the chain live (Sepolia by default) — no hardcoded
// resolution results. Names render in the UI; records resolve in real time.

export * from "./config.js";
export * from "./resolve.js";
export * from "./records.js";
export * from "./verify.js";
export * from "./subnames.js";
export * from "./discover.js";
export * from "./derive.js";
