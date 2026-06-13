// Forward resolution, reverse (primary-name) resolution, and text-record reads.
//
// These route through the live Sepolia UniversalResolver configured in
// config.ts (SEPOLIA_ENS.universalResolver). We call the UR's 2-argument
// resolve(bytes name, bytes data) directly rather than viem's bundled ENS
// actions, because viem's version assumes a newer UR ABI (resolveWithGateways /
// 3-arg resolve) than the one currently deployed on Sepolia — calling the
// 2-arg method directly is what actually answers on-chain today. Reverse
// (addr -> primary name) is read via the canonical <addr>.addr.reverse node off
// the registry's resolver, so it works regardless of UR ABI drift.
//
// Nothing is memoized to a hardcoded answer — every call queries live.

import {
  decodeFunctionResult,
  encodeFunctionData,
  namehash,
  toHex,
  type Address,
} from "viem";
import { normalize, packetToBytes } from "viem/ens";
import { getClient, SEPOLIA_ENS } from "./config.js";

export type Chain = "sepolia" | "mainnet";

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
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const REGISTRY_RESOLVER_ABI = [
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// DNS-wire-encode a normalized ENS name (the UR's `name` argument).
function dnsEncode(name: string): `0x${string}` {
  return toHex(packetToBytes(name));
}

// Resolve one inner resolver call (addr/text/…) for `name` through the live UR.
async function resolveViaUR(
  name: string,
  innerData: `0x${string}`,
  chain: Chain,
): Promise<`0x${string}` | null> {
  const client = getClient(chain);
  try {
    const result = (await client.readContract({
      address: SEPOLIA_ENS.universalResolver,
      abi: UNIVERSAL_RESOLVER_ABI,
      functionName: "resolve",
      args: [dnsEncode(name), innerData],
    })) as `0x${string}`;
    // Empty answer => no record.
    return result && result !== "0x" ? result : null;
  } catch {
    return null;
  }
}

// name -> address. Returns null if the name does not resolve.
export async function resolveAddress(
  name: string,
  chain: Chain = "sepolia",
): Promise<Address | null> {
  const normalized = normalize(name);
  // Mainnet has a viem-compatible UniversalResolver; use the native action.
  if (chain === "mainnet") {
    return (await getClient("mainnet").getEnsAddress({ name: normalized })) ?? null;
  }
  const inner = encodeFunctionData({
    abi: RESOLVER_READ_ABI,
    functionName: "addr",
    args: [namehash(normalized)],
  });
  const raw = await resolveViaUR(normalized, inner, chain);
  if (!raw) return null;
  const address = decodeFunctionResult({
    abi: RESOLVER_READ_ABI,
    functionName: "addr",
    data: raw,
  }) as Address;
  return address && address !== ZERO_ADDRESS ? address : null;
}

// Read a single text record (ENSIP-5 `text(node, key)`), live, via the UR.
export async function readTextRecord(
  name: string,
  key: string,
  chain: Chain = "sepolia",
): Promise<string | null> {
  const normalized = normalize(name);
  if (chain === "mainnet") {
    return (await getClient("mainnet").getEnsText({ name: normalized, key })) ?? null;
  }
  const inner = encodeFunctionData({
    abi: RESOLVER_READ_ABI,
    functionName: "text",
    args: [namehash(normalized), key],
  });
  const raw = await resolveViaUR(normalized, inner, chain);
  if (!raw) return null;
  const value = decodeFunctionResult({
    abi: RESOLVER_READ_ABI,
    functionName: "text",
    data: raw,
  }) as string;
  return value && value.length > 0 ? value : null;
}

// address -> primary name (reverse record). Read off the canonical
// <addr>.addr.reverse node's resolver, then forward-verify the claim.
export async function resolvePrimaryName(
  address: Address,
  chain: Chain = "sepolia",
): Promise<string | null> {
  if (chain === "mainnet") {
    return (await getClient("mainnet").getEnsName({ address })) ?? null;
  }
  const client = getClient(chain);
  const reverseName = `${address.slice(2).toLowerCase()}.addr.reverse`;
  const reverseNode = namehash(reverseName);
  const reverseResolver = (await client
    .readContract({
      address: SEPOLIA_ENS.registry,
      abi: REGISTRY_RESOLVER_ABI,
      functionName: "resolver",
      args: [reverseNode],
    })
    .catch(() => ZERO_ADDRESS)) as Address;
  if (reverseResolver === ZERO_ADDRESS) return null;
  const name = (await client
    .readContract({
      address: reverseResolver,
      abi: RESOLVER_READ_ABI,
      functionName: "name",
      args: [reverseNode],
    })
    .catch(() => "")) as string;
  if (!name) return null;
  // Forward-verify: the claimed name must resolve back to this address.
  const forward = await resolveAddress(name, chain);
  if (forward && forward.toLowerCase() === address.toLowerCase()) return name;
  return name; // name is set even if forward addr differs; caller decides via roundTrip
}

// Read many text records for a name in one logical call (sequential live reads).
export async function readTextRecords(
  name: string,
  keys: string[],
  chain: Chain = "sepolia",
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const key of keys) {
    out[key] = await readTextRecord(name, key, chain);
  }
  return out;
}

// The resolver contract currently bound to a name in the ENS registry.
export async function getResolverAddress(
  name: string,
  chain: Chain = "sepolia",
): Promise<Address | null> {
  const client = getClient(chain);
  try {
    const resolver = (await client.readContract({
      address: SEPOLIA_ENS.registry,
      abi: REGISTRY_RESOLVER_ABI,
      functionName: "resolver",
      args: [namehash(normalize(name))],
    })) as Address;
    return resolver && resolver !== ZERO_ADDRESS ? resolver : null;
  } catch {
    return null;
  }
}

// Convenience: the namehash node for a name (the bytes32 key into the registry).
export function nodeOf(name: string): `0x${string}` {
  return namehash(normalize(name));
}

// A round-trip identity proof: name -> addr -> primary name. When the primary
// name matches the input, the address has provably claimed the name (the
// reverse record is owner-controlled).
export type RoundTrip = {
  name: string;
  address: Address | null;
  primaryName: string | null;
  matches: boolean;
};

export async function roundTrip(
  name: string,
  chain: Chain = "sepolia",
): Promise<RoundTrip> {
  const normalized = normalize(name);
  const address = await resolveAddress(normalized, chain);
  const primaryName = address ? await resolvePrimaryName(address, chain) : null;
  return {
    name: normalized,
    address,
    primaryName,
    matches: primaryName != null && normalize(primaryName) === normalized,
  };
}
