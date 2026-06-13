// WARD ENS layer — runtime configuration.
//
// Everything that could be a hardcoded value (RPC endpoints, contract
// addresses, the agent root name, the AI-agent registry the agent is
// registered in) is read from the environment with a sane testnet default.
// Resolution RESULTS are never hardcoded; only network coordinates are.
//
// Networks: ENS for WARD lives on Sepolia (per ARCHITECTURE.md: "ENS stays on
// Sepolia regardless"). A mainnet client is also exposed so `resolve` can fall
// back to a known mainnet name when a Sepolia public RPC is flaky — the CLI
// reports which chain answered.

import { createPublicClient, http, type Address, type Chain, type PublicClient } from "viem";
import { mainnet, sepolia } from "viem/chains";

function env(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.length > 0 ? value : fallback;
}

// Public, keyless endpoints as defaults so the package runs with zero setup.
// Override in production with a dedicated provider (Alchemy/Infura/etc).
export const SEPOLIA_RPC_URL = env(
  "SEPOLIA_RPC_URL",
  // Two well-known public Sepolia endpoints; the first is tried, the CLI can
  // be pointed at the second via SEPOLIA_RPC_URL if it rate-limits.
  "https://ethereum-sepolia-rpc.publicnode.com",
);

export const MAINNET_RPC_URL = env(
  "MAINNET_RPC_URL",
  "https://ethereum-rpc.publicnode.com",
);

// The WARD agent root name and the network it lives on.
export const WARD_ENS_ROOT = env("WARD_ENS_ROOT", "ward-agent.eth");

// ENS contract addresses. Defaults are the canonical ENS deployments
// (identical Registry/UniversalResolver across chains; resolver/wrapper differ).
// Sourced from https://docs.ens.domains/learn/deployments/.
export type EnsContracts = {
  registry: Address;
  publicResolver: Address;
  nameWrapper: Address;
  ethRegistrarController: Address;
  universalResolver: Address;
  reverseRegistrar: Address;
};

export const SEPOLIA_ENS: EnsContracts = {
  registry: env("ENS_REGISTRY", "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e") as Address,
  publicResolver: env("ENS_PUBLIC_RESOLVER", "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5") as Address,
  nameWrapper: env("ENS_NAME_WRAPPER", "0x0635513f179D50A207757E05759CbD106d7dFcE8") as Address,
  ethRegistrarController: env("ENS_ETH_CONTROLLER", "0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968") as Address,
  universalResolver: env("ENS_UNIVERSAL_RESOLVER", "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe") as Address,
  reverseRegistrar: env("ENS_REVERSE_REGISTRAR", "0xA0a1AbcDAe1a2a4A2EF8e9113Ff0e02DD81DC0C6") as Address,
};

// The AI-agent registry the WARD agent claims membership in, for ENSIP-25
// verification. ERC-8004-style on-chain agent registries expose an integer
// agentId; WARD's agent is registered as WARD_AGENT_ID in WARD_AGENT_REGISTRY
// on WARD_AGENT_REGISTRY_CHAIN_ID. All env-driven; no fabricated default
// registration is asserted as real.
export const WARD_AGENT_REGISTRY = env(
  "WARD_AGENT_REGISTRY",
  // Placeholder ERC-8004 registry address; replace with the real one once the
  // agent is registered. Used only to COMPUTE the verification key, never to
  // assert a result.
  "0x0000000000000000000000000000000000000000",
) as Address;

export const WARD_AGENT_REGISTRY_CHAIN_ID = Number(
  env("WARD_AGENT_REGISTRY_CHAIN_ID", "11155111"),
);

export const WARD_AGENT_ID = env("WARD_AGENT_ID", "1");

let sepoliaClient: PublicClient | null = null;
let mainnetClient: PublicClient | null = null;

export function getClient(chain: "sepolia" | "mainnet" = "sepolia"): PublicClient {
  if (chain === "mainnet") {
    if (!mainnetClient) {
      mainnetClient = createPublicClient({
        chain: mainnet as Chain,
        transport: http(MAINNET_RPC_URL),
      });
    }
    return mainnetClient;
  }
  if (!sepoliaClient) {
    sepoliaClient = createPublicClient({
      chain: sepolia as Chain,
      transport: http(SEPOLIA_RPC_URL),
    });
  }
  return sepoliaClient;
}

export function rpcFor(chain: "sepolia" | "mainnet"): string {
  return chain === "mainnet" ? MAINNET_RPC_URL : SEPOLIA_RPC_URL;
}
