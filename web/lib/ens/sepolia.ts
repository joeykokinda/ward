// Live ENS resolution against Sepolia — server-side only.
//
// This reuses the exact addresses + resolution logic from packages/ens
// (resolve.ts / config.ts / verify.ts). We do NOT shell out and we do NOT
// hardcode any resolution RESULTS — every value here comes off-chain at request
// time. Only network coordinates (RPC URL, contract addresses) are constants,
// and each is overridable via env.
//
// Why we call the UniversalResolver's 2-arg resolve(bytes,bytes) directly rather
// than viem's bundled ENS actions: the live Sepolia UR (0xBaBC76…09725) honours
// records set on the registry's PublicResolver, but exposes the older 2-arg ABI.
// viem's getEnsAddress/getEnsText assume a newer UR variant and won't answer
// against this deployment. Calling the 2-arg method directly is what resolves
// on-chain today (mirrors packages/ens/src/resolve.ts).

import {
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  http,
  namehash,
  toHex,
  type Address,
  type PublicClient,
} from "viem";
import { sepolia } from "viem/chains";
import { normalize, packetToBytes } from "viem/ens";

// ── Network coordinates (env-overridable; defaults are the live Sepolia ENS) ──
function env(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.length > 0 ? value : fallback;
}

export const SEPOLIA_RPC_URL = env(
  "SEPOLIA_RPC_URL",
  "https://ethereum-sepolia-rpc.publicnode.com",
);

export const SEPOLIA_ENS = {
  registry: env("ENS_REGISTRY", "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e") as Address,
  // Current Sepolia PublicResolver the live UniversalResolver reads from.
  publicResolver: env("ENS_PUBLIC_RESOLVER", "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD") as Address,
  // Current Sepolia UniversalResolver (2-arg resolve; honours registry resolver).
  universalResolver: env(
    "ENS_UNIVERSAL_RESOLVER",
    "0xBaBC7678D7A63104f1658c11D6AE9A21cdA09725",
  ) as Address,
} as const;

// The WARD agent root + the on-chain ENSIP-25 registration the agent attests to.
// Defaults are the values actually written on Sepolia (read off ward-agent.eth's
// resolver): registry 0xc59f…9CAc on Arc (chainId 5042002), agentId "1".
export const WARD_ENS_ROOT = env("WARD_ENS_ROOT", "ward-agent.eth");
export const WARD_AGENT_REGISTRY = env(
  "WARD_AGENT_REGISTRY",
  "0xc59fabC06Cd268F826a905Cc13eD232a90A79CAc",
) as Address;
export const WARD_AGENT_REGISTRY_CHAIN_ID = Number(
  env("WARD_AGENT_REGISTRY_CHAIN_ID", "5042002"),
);
export const WARD_AGENT_ID = env("WARD_AGENT_ID", "1");

// ── ENSIP-26 / WARD text-record keys (single source of truth) ────────────────
export const AGENT_CONTEXT_KEY = "agent-context";
export const WARD_KEYS = {
  skills: "eth.ward.skills",
  region: "eth.ward.region",
  reputation: "eth.ward.reputation",
  role: "eth.ward.role",
} as const;
export function agentEndpointKey(protocol: "mcp" | "a2a" | "web"): string {
  return `agent-endpoint[${protocol}]`;
}

// ── ABIs ──────────────────────────────────────────────────────────────────
const UNIVERSAL_RESOLVER_ABI = [
  {
    type: "function",
    name: "resolve",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "bytes" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
] as const;

const RESOLVER_READ_ABI = [
  {
    type: "function",
    name: "addr",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "text",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ── Client (cached across requests within a server runtime) ─────────────────
let sepoliaClient: PublicClient | null = null;
export function getSepoliaClient(): PublicClient {
  if (!sepoliaClient) {
    sepoliaClient = createPublicClient({
      chain: sepolia,
      transport: http(SEPOLIA_RPC_URL),
    });
  }
  return sepoliaClient;
}

// DNS-wire-encode a normalized ENS name (the UR's `name` argument).
function dnsEncode(name: string): `0x${string}` {
  return toHex(packetToBytes(name));
}

// Resolve one inner resolver call (addr/text) for `name` through the live UR.
async function resolveViaUR(
  name: string,
  innerData: `0x${string}`,
): Promise<`0x${string}` | null> {
  try {
    const result = (await getSepoliaClient().readContract({
      address: SEPOLIA_ENS.universalResolver,
      abi: UNIVERSAL_RESOLVER_ABI,
      functionName: "resolve",
      args: [dnsEncode(name), innerData],
    })) as `0x${string}`;
    return result && result !== "0x" ? result : null;
  } catch {
    return null;
  }
}

// name -> address. Returns null if the name does not resolve.
export async function resolveAddress(name: string): Promise<Address | null> {
  const normalized = normalize(name);
  const inner = encodeFunctionData({
    abi: RESOLVER_READ_ABI,
    functionName: "addr",
    args: [namehash(normalized)],
  });
  const raw = await resolveViaUR(normalized, inner);
  if (!raw) return null;
  try {
    const address = decodeFunctionResult({
      abi: RESOLVER_READ_ABI,
      functionName: "addr",
      data: raw,
    }) as Address;
    return address && address !== ZERO_ADDRESS ? address : null;
  } catch {
    return null;
  }
}

// Read a single ENSIP-5 text record (text(node, key)), live, via the UR.
export async function readTextRecord(name: string, key: string): Promise<string | null> {
  const normalized = normalize(name);
  const inner = encodeFunctionData({
    abi: RESOLVER_READ_ABI,
    functionName: "text",
    args: [namehash(normalized), key],
  });
  const raw = await resolveViaUR(normalized, inner);
  if (!raw) return null;
  try {
    const value = decodeFunctionResult({
      abi: RESOLVER_READ_ABI,
      functionName: "text",
      data: raw,
    }) as string;
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

// Read several text records concurrently (one logical hydrate of a profile).
export async function readTextRecords(
  name: string,
  keys: string[],
): Promise<Record<string, string | null>> {
  const values = await Promise.all(keys.map((key) => readTextRecord(name, key)));
  const out: Record<string, string | null> = {};
  keys.forEach((key, i) => {
    out[key] = values[i];
  });
  return out;
}

// ── ENSIP-25 / ERC-7930 (mirrors packages/ens/src/verify.ts) ────────────────
const ERC7930_VERSION = "0001";
const CHAINTYPE_EIP155 = "0000";

function minimalBeHex(value: number): string {
  if (value === 0) return "00";
  let hex = value.toString(16);
  if (hex.length % 2 === 1) hex = `0${hex}`;
  return hex;
}
function lenByte(n: number): string {
  return n.toString(16).padStart(2, "0");
}

// Encode an EVM (chainId, address) pair as an ERC-7930 interoperable address.
export function encodeInteroperableAddress(chainId: number, address: string): `0x${string}` {
  const addrHex = getAddress(address).slice(2).toLowerCase();
  const chainRef = minimalBeHex(chainId);
  const body =
    ERC7930_VERSION +
    CHAINTYPE_EIP155 +
    lenByte(chainRef.length / 2) +
    chainRef +
    lenByte(addrHex.length / 2) +
    addrHex;
  return `0x${body}` as `0x${string}`;
}

// Build the ENSIP-25 verification text-record key for a registry/agent pair.
export function agentRegistrationKey(
  chainId: number,
  registryAddress: string,
  agentId: string,
): string {
  const registry = encodeInteroperableAddress(chainId, registryAddress);
  return `agent-registration[${registry}][${agentId}]`;
}

export type Ensip25Result = {
  key: string;
  verified: boolean;
  registry: Address;
  chainId: number;
  agentId: string;
};

// Live ENSIP-25 verification: verified iff the resolved record is non-empty.
export async function verifyAgentName(
  ensName: string,
  chainId: number = WARD_AGENT_REGISTRY_CHAIN_ID,
  registryAddress: string = WARD_AGENT_REGISTRY,
  agentId: string = WARD_AGENT_ID,
): Promise<Ensip25Result> {
  const key = agentRegistrationKey(chainId, registryAddress, agentId);
  const value = await readTextRecord(ensName, key);
  return {
    key,
    verified: value != null && value.length > 0,
    registry: getAddress(registryAddress),
    chainId,
    agentId,
  };
}
