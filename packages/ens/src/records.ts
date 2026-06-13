// ENSIP-26 "Agent Text Records" + WARD's worker record schema.
//
// ── What ENSIP-26 actually standardizes (https://docs.ens.domains/ensip/26/) ──
// ENSIP-26 extends ENSIP-5 with exactly TWO key shapes, read/written via the
// resolver's `text(bytes32 node, string key)` interface:
//
//   • `agent-context`            — free-form description of the agent (plain
//                                  text / Markdown / YAML / JSON). MAY reference
//                                  registries or endpoints.
//   • `agent-endpoint[<proto>]`  — a URL for a named agent protocol. Defined
//                                  protocols: `mcp`, `a2a`, `web`. Value MUST be
//                                  a valid URL (IPFS URIs allowed).
//
// A client resolves an agent by reading `agent-context`, then optionally the
// `agent-endpoint[...]` it needs. That is the whole spec — it is deliberately
// minimal and does NOT define skill/region/reputation keys.
//
// ── WARD's worker schema (this codebase) ──
// WARD needs structured worker attributes (skills, region, reputation pointer).
// Per the ENS philosophy, these are ordinary ENSIP-5 text records under a
// project namespace so they don't collide with any future standard key:
//
//   • `eth.ward.skills`      — comma-separated skill tags (e.g. "router,network")
//   • `eth.ward.region`      — service region (e.g. "Greenwich, CT")
//   • `eth.ward.reputation`  — a POINTER to onchain reputation, formatted as
//                              eip155:<chainId>:<registry>/reputationOf/<addr>.
//                              The number itself lives onchain in WorkerRegistry;
//                              ENS stores how to find it (no stale cached score).
//   • `eth.ward.role`        — "worker" (vs the agent's own records).
//
// Every worker subname ALSO carries the standard ENSIP-26 records so a generic
// agent crawler (not just WARD) can discover it:
//   • `agent-context`        — human/AI-readable blurb naming the worker + skills
//   • `agent-endpoint[web]`  — the worker's WARD profile page
//
// All keys live in one table below so reads/writes stay spec-aligned and there
// are zero magic strings scattered through the code.

// ── ENSIP-26 standard keys ──────────────────────────────────────────────────

export const AGENT_CONTEXT_KEY = "agent-context";

export type AgentProtocol = "mcp" | "a2a" | "web";

export function agentEndpointKey(protocol: AgentProtocol): string {
  return `agent-endpoint[${protocol}]`;
}

// ── WARD worker namespace keys (ENSIP-5 text records) ───────────────────────

export const WARD_KEYS = {
  skills: "eth.ward.skills",
  region: "eth.ward.region",
  reputation: "eth.ward.reputation",
  role: "eth.ward.role",
} as const;

// ── Typed worker record ─────────────────────────────────────────────────────

export type WorkerRecord = {
  ensName: string; // <handle>.ward-agent.eth
  skills: string[];
  region: string;
  // CAIP-10-style pointer to the onchain reputation source.
  reputationPointer: string;
  role: "worker";
  // ENSIP-26 records.
  agentContext: string;
  webEndpoint?: string;
};

// CAIP-10 / EIP-155 pointer to where the reputation number actually lives.
// Format: eip155:<chainId>:<registryAddress>/reputationOf/<workerAddress>
export function reputationPointer(
  chainId: number,
  registryAddress: string,
  workerAddress: string,
): string {
  return `eip155:${chainId}:${registryAddress}/reputationOf/${workerAddress}`;
}

// Parse a reputation pointer back into its parts (for the frontend to build a
// live onchain read). Returns null if the string isn't a WARD pointer.
export function parseReputationPointer(pointer: string): {
  chainId: number;
  registry: string;
  method: string;
  subject: string;
} | null {
  const match = pointer.match(/^eip155:(\d+):([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return {
    chainId: Number(match[1]),
    registry: match[2],
    method: match[3],
    subject: match[4],
  };
}

// Build the default `agent-context` blurb for a worker. Markdown, per ENSIP-26
// ("any format suitable for agentic systems").
export function buildWorkerContext(handle: string, skills: string[], region: string): string {
  return [
    `# ${handle} — WARD field worker`,
    ``,
    `Verified human technician in the WARD agent economy.`,
    `Skills: ${skills.join(", ")}.`,
    `Service region: ${region}.`,
    `Hired and paid in USDC by ward-agent.eth on attested physical-world fixes.`,
  ].join("\n");
}

// The full set of (key, value) text records WARD writes onto a worker subname.
// `subnames.ts` turns each of these into a resolver `setText` call. This is the
// single source of truth for what a worker's ENS profile contains.
export function workerTextRecords(record: WorkerRecord): { key: string; value: string }[] {
  const entries: { key: string; value: string }[] = [
    { key: WARD_KEYS.role, value: record.role },
    { key: WARD_KEYS.skills, value: record.skills.join(",") },
    { key: WARD_KEYS.region, value: record.region },
    { key: WARD_KEYS.reputation, value: record.reputationPointer },
    { key: AGENT_CONTEXT_KEY, value: record.agentContext },
  ];
  if (record.webEndpoint) {
    entries.push({ key: agentEndpointKey("web"), value: record.webEndpoint });
  }
  return entries;
}

// All keys to read when hydrating a worker profile from a subname (used by
// discover.ts and the frontend). Order matters only for display grouping.
export function workerRecordKeys(): string[] {
  return [
    WARD_KEYS.role,
    WARD_KEYS.skills,
    WARD_KEYS.region,
    WARD_KEYS.reputation,
    AGENT_CONTEXT_KEY,
    agentEndpointKey("web"),
  ];
}

import { readTextRecords } from "./resolve.js";
import type { Chain } from "./resolve.js";

// Read a worker's records LIVE from its subname and assemble a typed object.
// Returns null only if the name has no role/skills at all (i.e. not a worker).
export async function readWorkerRecord(
  ensName: string,
  chain: Chain = "sepolia",
): Promise<WorkerRecord | null> {
  const values = await readTextRecords(ensName, workerRecordKeys(), chain);
  const skillsRaw = values[WARD_KEYS.skills];
  const role = values[WARD_KEYS.role];
  if (!skillsRaw && role !== "worker") return null;
  return {
    ensName,
    skills: (skillsRaw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    region: values[WARD_KEYS.region] ?? "",
    reputationPointer: values[WARD_KEYS.reputation] ?? "",
    role: "worker",
    agentContext: values[AGENT_CONTEXT_KEY] ?? "",
    webEndpoint: values[agentEndpointKey("web")] ?? undefined,
  };
}

// The agent's OWN ENSIP-26 records (ward-agent.eth), distinct from a worker's.
export type AgentRecord = {
  ensName: string;
  agentContext: string;
  webEndpoint?: string;
  a2aEndpoint?: string;
  mcpEndpoint?: string;
};

export function agentTextRecords(record: AgentRecord): { key: string; value: string }[] {
  const entries: { key: string; value: string }[] = [
    { key: AGENT_CONTEXT_KEY, value: record.agentContext },
  ];
  if (record.webEndpoint) entries.push({ key: agentEndpointKey("web"), value: record.webEndpoint });
  if (record.a2aEndpoint) entries.push({ key: agentEndpointKey("a2a"), value: record.a2aEndpoint });
  if (record.mcpEndpoint) entries.push({ key: agentEndpointKey("mcp"), value: record.mcpEndpoint });
  return entries;
}

export async function readAgentRecord(
  ensName: string,
  chain: Chain = "sepolia",
): Promise<AgentRecord> {
  const keys = [
    AGENT_CONTEXT_KEY,
    agentEndpointKey("web"),
    agentEndpointKey("a2a"),
    agentEndpointKey("mcp"),
  ];
  const values = await readTextRecords(ensName, keys, chain);
  return {
    ensName,
    agentContext: values[AGENT_CONTEXT_KEY] ?? "",
    webEndpoint: values[agentEndpointKey("web")] ?? undefined,
    a2aEndpoint: values[agentEndpointKey("a2a")] ?? undefined,
    mcpEndpoint: values[agentEndpointKey("mcp")] ?? undefined,
  };
}
