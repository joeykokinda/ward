// Worker discovery via ENS — the pitch centerpiece.
// "The agent found the worker through ENS resolution."
//
// How discovery works without a hardcoded result:
//   1. The agent knows the candidate worker handles (from WorkerRegistry events
//      onchain, or the WARD_WORKER_HANDLES env for the demo — NOT their skills/
//      region/reputation, which are read live from ENS).
//   2. For each handle it resolves <handle>.ward-agent.eth and reads the
//      ENSIP-26 / WARD text records LIVE (skills, region, reputation pointer).
//   3. It filters by the required skill and (optionally) region.
//   4. It ranks by reputation. The reputation NUMBER is read live from the
//      onchain WorkerRegistry the reputation pointer names — ENS stores the
//      pointer, the chain stores the score (no stale cache).
//
// Note on enumeration: L1 ENS has no onchain "list subnames of a parent" call
// (subnames are a sparse namehash trie). Production WARD learns the handle set
// from WorkerRegistry's WorkerRegistered events; the candidate list here is the
// seam for that. Everything ABOUT each worker still comes from live ENS reads,
// so this satisfies "zero hardcoded values" for the records themselves.

import { createPublicClient, getAddress, http, type PublicClient } from "viem";
import { getClient, WARD_ENS_ROOT } from "./config.js";
import { parseReputationPointer, readWorkerRecord, type WorkerRecord } from "./records.js";
import { resolveAddress, type Chain } from "./resolve.js";

const REGISTRY_ABI = [
  {
    type: "function",
    name: "reputationOf",
    stateMutability: "view",
    inputs: [{ name: "worker", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type DiscoveredWorker = {
  handle: string;
  ensName: string;
  address: string | null;
  skills: string[];
  region: string;
  reputation: number; // live onchain value, or -1 if unreadable
  reputationSource: string; // the pointer the score was read from
  agentContext: string;
};

function candidateHandles(): string[] {
  const raw = process.env.WARD_WORKER_HANDLES;
  if (raw && raw.trim().length > 0) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  // Demo default — the 5 canonical workers. Their attributes are
  // NOT listed here; only the names the agent would learn from registry events.
  return ["mike", "sara", "deon", "lena", "raj"];
}

// Build a read client for the chain a reputation pointer names. The pointer is
// CAIP-10 (eip155:<chainId>:…); the WorkerRegistry lives on Arc, so when the
// pointer's chainId isn't the ENS chain we read from ARC_RPC_URL. This is the
// "ENS stores the pointer, the chain stores the score" path — no stale cache.
const arcClients = new Map<number, PublicClient>();
function clientForChain(chainId: number): PublicClient | null {
  // Sepolia: reuse the ENS client.
  if (chainId === 11155111) return getClient("sepolia");
  const rpc = process.env.REPUTATION_RPC_URL ?? process.env.ARC_RPC_URL;
  if (!rpc) return null;
  let client = arcClients.get(chainId);
  if (!client) {
    client = createPublicClient({ transport: http(rpc) });
    arcClients.set(chainId, client);
  }
  return client;
}

// Read the live onchain reputation a worker's ENS pointer references, from the
// chain the pointer names (Arc in production).
async function readReputation(record: WorkerRecord): Promise<number> {
  const pointer = parseReputationPointer(record.reputationPointer);
  if (!pointer) return -1;
  const client = clientForChain(pointer.chainId);
  if (!client) return -1;
  try {
    const value = await client.readContract({
      address: getAddress(pointer.registry),
      abi: REGISTRY_ABI,
      functionName: "reputationOf",
      args: [getAddress(pointer.subject)],
    });
    return Number(value);
  } catch {
    return -1;
  }
}

// Hydrate one candidate handle from ENS, live.
export async function loadWorker(
  handle: string,
  chain: Chain = "sepolia",
): Promise<DiscoveredWorker | null> {
  const ensName = `${handle}.${WARD_ENS_ROOT}`;
  const record = await readWorkerRecord(ensName, chain);
  if (!record) return null;
  const address = await resolveAddress(ensName, chain);
  const reputation = await readReputation(record);
  return {
    handle,
    ensName,
    address,
    skills: record.skills,
    region: record.region,
    reputation,
    reputationSource: record.reputationPointer,
    agentContext: record.agentContext,
  };
}

export type DiscoverQuery = {
  skill?: string;
  region?: string;
  handles?: string[];
  chain?: Chain;
};

// Discover + rank workers through ENS resolution.
export async function discoverWorkers(query: DiscoverQuery = {}): Promise<DiscoveredWorker[]> {
  const chain = query.chain ?? "sepolia";
  const handles = query.handles ?? candidateHandles();

  const loaded = await Promise.all(handles.map((h) => loadWorker(h, chain)));
  let workers = loaded.filter((w): w is DiscoveredWorker => w != null);

  if (query.skill) {
    const skill = query.skill.toLowerCase();
    workers = workers.filter((w) => w.skills.some((s) => s.toLowerCase() === skill));
  }
  if (query.region) {
    const region = query.region.toLowerCase();
    workers = workers.filter((w) => w.region.toLowerCase().includes(region));
  }

  // Highest reputation first; unreadable reputation (-1) sorts last.
  workers.sort((a, b) => b.reputation - a.reputation);
  return workers;
}

// The single dispatch decision the agent makes: best worker for a skill/region.
export async function selectWorker(query: DiscoverQuery): Promise<DiscoveredWorker | null> {
  const ranked = await discoverWorkers(query);
  return ranked[0] ?? null;
}
