// Forward resolution, reverse (primary-name) resolution, and text-record reads.
//
// All three hit the chain through viem's ENS actions, which route through the
// Universal Resolver (CCIP-read aware, so offchain/L2 resolvers Just Work).
// Nothing here is memoized to a hardcoded answer — every call queries live.

import { namehash, type Address } from "viem";
import { normalize } from "viem/ens";
import { getClient } from "./config.js";

export type Chain = "sepolia" | "mainnet";

// name -> address. Returns null if the name does not resolve.
export async function resolveAddress(
  name: string,
  chain: Chain = "sepolia",
): Promise<Address | null> {
  const client = getClient(chain);
  const address = await client.getEnsAddress({ name: normalize(name) });
  return address ?? null;
}

// address -> primary name (reverse record). Returns null if none set.
export async function resolvePrimaryName(
  address: Address,
  chain: Chain = "sepolia",
): Promise<string | null> {
  const client = getClient(chain);
  const name = await client.getEnsName({ address });
  return name ?? null;
}

// Read a single text record (ENSIP-5 `text(node, key)`), live.
export async function readTextRecord(
  name: string,
  key: string,
  chain: Chain = "sepolia",
): Promise<string | null> {
  const client = getClient(chain);
  const value = await client.getEnsText({ name: normalize(name), key });
  return value ?? null;
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
// Useful to confirm a name actually has a resolver before reading records.
export async function getResolverAddress(
  name: string,
  chain: Chain = "sepolia",
): Promise<Address | null> {
  const client = getClient(chain);
  try {
    const resolver = await client.getEnsResolver({ name: normalize(name) });
    return resolver ?? null;
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
// reverse record is owner-controlled). The pitch uses this to show an address
// is "really" mike.ward-agent.eth, not just pointed at by it.
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
