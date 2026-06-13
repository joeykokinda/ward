// ENSIP-25 — AI Agent Registry ENS Name Verification.
// Spec: https://docs.ens.domains/ensip/25/
//
// ── The spec, exactly ──
// ENSIP-25 verifies that an ENS name and an AI-agent identity in an onchain
// agent registry refer to the same agent, using ONE parameterized text record:
//
//     agent-registration[<registry>][<agentId>]
//
//   • <registry> is an ERC-7930 interoperable address (0x-hex) identifying the
//     registry contract + its chain.
//   • <agentId>  is the registry-defined id string (MUST NOT contain `[` `]`).
//   • The VALUE: "MUST be a non-empty string." Implementations SHOULD set it to
//     "1". Presence of any non-empty value IS the attestation by the ENS owner.
//
// Verification (registry → ENS) is 4 steps:
//   1. Get claimed ENS name, agentId, registry from the registry entry.
//   2. Build the key with the parameterized format.
//   3. Resolve that text record on the claimed name.
//   4. Non-empty resolved value ⇒ the ENS name is verified for that agent.
//
// ── ERC-7930 interoperable address (binary) ──
// Spec: https://eips.ethereum.org/EIPS/eip-7930
// Fields, in order:
//   Version              2 bytes   (0x0001 for v1)
//   ChainType            2 bytes   (0x0000 = eip155 / EVM namespace)
//   ChainReferenceLength 1 byte    (length of the chain reference that follows)
//   ChainReference       N bytes   (chain id, big-endian, minimal length)
//   AddressLength        1 byte    (length of the address that follows)
//   Address              M bytes   (20 for an EVM address)
//
// Mainnet (chainId 1) registry 0x8004…a432 encodes to:
//   0001 0000 01 01 14 8004a169fb4a3325136eb29fa0ceb6d2e539a432
//   ver  ctyp rl cr al  <20-byte address>

import { getAddress, isAddress, type Address } from "viem";
import { readTextRecord } from "./resolve.js";
import type { Chain } from "./resolve.js";
import {
  WARD_AGENT_ID,
  WARD_AGENT_REGISTRY,
  WARD_AGENT_REGISTRY_CHAIN_ID,
  WARD_ENS_ROOT,
} from "./config.js";

const ERC7930_VERSION = "0001";
const CHAINTYPE_EIP155 = "0000";

// Minimal big-endian hex for a non-negative integer (no 0x, even length, no
// leading zero byte unless the value is 0 → "00").
function minimalBeHex(value: number): string {
  if (value < 0 || !Number.isInteger(value)) {
    throw new Error(`chain id must be a non-negative integer, got ${value}`);
  }
  if (value === 0) return "00";
  let hex = value.toString(16);
  if (hex.length % 2 === 1) hex = `0${hex}`;
  return hex;
}

function byteLen(hexNo0x: string): number {
  return hexNo0x.length / 2;
}

function lenByte(n: number): string {
  if (n > 0xff) throw new Error(`length ${n} exceeds one byte`);
  return n.toString(16).padStart(2, "0");
}

// Encode an EVM (chainId, address) pair as an ERC-7930 interoperable address.
export function encodeInteroperableAddress(chainId: number, address: string): `0x${string}` {
  if (!isAddress(address)) throw new Error(`invalid address: ${address}`);
  const addrHex = getAddress(address).slice(2).toLowerCase(); // 40 hex chars
  const chainRef = minimalBeHex(chainId);
  const body =
    ERC7930_VERSION +
    CHAINTYPE_EIP155 +
    lenByte(byteLen(chainRef)) +
    chainRef +
    lenByte(byteLen(addrHex)) +
    addrHex;
  return `0x${body}` as `0x${string}`;
}

// Decode for inspection / debugging (round-trips encodeInteroperableAddress).
export function decodeInteroperableAddress(encoded: string): {
  version: string;
  chainType: string;
  chainId: number;
  address: Address;
} {
  const hex = encoded.startsWith("0x") ? encoded.slice(2) : encoded;
  let i = 0;
  const take = (bytes: number) => {
    const slice = hex.slice(i, i + bytes * 2);
    i += bytes * 2;
    return slice;
  };
  const version = take(2);
  const chainType = take(2);
  const chainRefLen = parseInt(take(1), 16);
  const chainRef = take(chainRefLen);
  const addrLen = parseInt(take(1), 16);
  const addr = take(addrLen);
  return {
    version,
    chainType,
    chainId: chainRef.length ? parseInt(chainRef, 16) : 0,
    address: getAddress(`0x${addr}`),
  };
}

// Build the ENSIP-25 verification text-record key for a registry/agent pair.
export function agentRegistrationKey(
  chainId: number,
  registryAddress: string,
  agentId: string,
): string {
  if (agentId.includes("[") || agentId.includes("]")) {
    throw new Error("agentId MUST NOT contain '[' or ']' (ENSIP-25)");
  }
  const registry = encodeInteroperableAddress(chainId, registryAddress);
  return `agent-registration[${registry}][${agentId}]`;
}

export type VerificationResult = {
  ensName: string;
  chainId: number;
  registry: string;
  agentId: string;
  key: string;
  value: string | null;
  verified: boolean;
};

// Perform the ENSIP-25 verification LIVE against the chain. `verified` is true
// iff the resolved text record is a non-empty string (step 4 of the spec).
export async function verifyAgentName(
  ensName: string,
  chainId: number,
  registryAddress: string,
  agentId: string,
  // ENS records for WARD live on Sepolia; the registry chainId is independent.
  ensChain: Chain = "sepolia",
): Promise<VerificationResult> {
  const key = agentRegistrationKey(chainId, registryAddress, agentId);
  const value = await readTextRecord(ensName, key, ensChain);
  return {
    ensName,
    chainId,
    registry: getAddress(registryAddress),
    agentId,
    key,
    value,
    verified: value != null && value.length > 0,
  };
}

// Convenience: verify the WARD agent (ward-agent.eth) using the env-configured
// registry/agentId. This is the call the agent + frontend make.
export async function verifyWardAgent(ensChain: Chain = "sepolia"): Promise<VerificationResult> {
  return verifyAgentName(
    WARD_ENS_ROOT,
    WARD_AGENT_REGISTRY_CHAIN_ID,
    WARD_AGENT_REGISTRY,
    WARD_AGENT_ID,
    ensChain,
  );
}
