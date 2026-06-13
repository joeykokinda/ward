#!/usr/bin/env tsx
// Register a SECOND, sovereign agent name on Sepolia to demonstrate WARD's
// federated-identity architecture: an agent that lives under its OWNER's own
// domain, separate from the protocol/demo agent `ward-agent.eth`.
//
//   demo-home.eth          ← the homeowner's own 2LD (registered + wrapped here)
//   agent.demo-home.eth    ← that home's sovereign agent (subname + records)
//
// The subname carries the same ENSIP-26 (agent-context / agent-endpoint[web])
// and ENSIP-25 (agent-registration[...]) records the protocol agent has, so it
// resolves live and verifies per ENSIP-25 against the WARD registry on Arc.
//
// SAFETY: this deliberately does NOT call ReverseRegistrar.setName, so the
// controller's primary name (ward-agent.eth) is left untouched. Every step is
// idempotent — safe to re-run. Read-only by default; pass --execute to broadcast.
//
// Run from packages/ens:
//   tsx --env-file-if-exists=../../.env src/register-sovereign.ts            # preflight (read-only)
//   tsx --env-file-if-exists=../../.env src/register-sovereign.ts --execute  # broadcast

import {
  createWalletClient,
  http,
  keccak256,
  labelhash,
  namehash,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { normalize } from "viem/ens";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  getClient,
  SEPOLIA_ENS,
  SEPOLIA_RPC_URL,
  WARD_AGENT_ID,
  WARD_AGENT_REGISTRY,
  WARD_AGENT_REGISTRY_CHAIN_ID,
} from "./config.js";
import { agentRegistrationKey } from "./verify.js";
import { AGENT_CONTEXT_KEY, agentEndpointKey } from "./records.js";

const BASE_REGISTRAR = (process.env.ENS_BASE_REGISTRAR ??
  "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85") as Address;

// Owner 2LD label + the agent subname under it (env-overridable).
const HOME_LABEL = process.env.SOVEREIGN_HOME_LABEL ?? "demo-home"; // demo-home.eth
const AGENT_LABEL = process.env.SOVEREIGN_AGENT_LABEL ?? "agent"; // agent.demo-home.eth

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const MAX_EXPIRY = 2n ** 64n - 1n; // uint64 max — clamped to parent expiry by the wrapper

const CONTROLLER_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "payable",
    inputs: [
      {
        name: "registration",
        type: "tuple",
        components: [
          { name: "label", type: "string" },
          { name: "owner", type: "address" },
          { name: "duration", type: "uint256" },
          { name: "secret", type: "bytes32" },
          { name: "resolver", type: "address" },
          { name: "data", type: "bytes[]" },
          { name: "reverseRecord", type: "uint8" },
          { name: "referrer", type: "bytes32" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

const BASE_REGISTRAR_ABI = [
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "isApprovedForAll", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "setApprovalForAll", stateMutability: "nonpayable", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] },
] as const;

const NAME_WRAPPER_ABI = [
  { type: "function", name: "wrapETH2LD", stateMutability: "nonpayable", inputs: [{ name: "label", type: "string" }, { name: "wrappedOwner", type: "address" }, { name: "ownerControlledFuses", type: "uint16" }, { name: "resolver", type: "address" }], outputs: [{ name: "expiry", type: "uint64" }] },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ name: "owner", type: "address" }] },
  { type: "function", name: "setResolver", stateMutability: "nonpayable", inputs: [{ name: "node", type: "bytes32" }, { name: "resolver", type: "address" }], outputs: [] },
  { type: "function", name: "setSubnodeRecord", stateMutability: "nonpayable", inputs: [{ name: "parentNode", type: "bytes32" }, { name: "label", type: "string" }, { name: "owner", type: "address" }, { name: "resolver", type: "address" }, { name: "ttl", type: "uint64" }, { name: "fuses", type: "uint32" }, { name: "expiry", type: "uint64" }], outputs: [{ name: "node", type: "bytes32" }] },
] as const;

const ENS_REGISTRY_ABI = [
  { type: "function", name: "resolver", stateMutability: "view", inputs: [{ name: "node", type: "bytes32" }], outputs: [{ name: "", type: "address" }] },
] as const;

const RESOLVER_ABI = [
  { type: "function", name: "setAddr", stateMutability: "nonpayable", inputs: [{ name: "node", type: "bytes32" }, { name: "a", type: "address" }], outputs: [] },
  { type: "function", name: "addr", stateMutability: "view", inputs: [{ name: "node", type: "bytes32" }], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "setText", stateMutability: "nonpayable", inputs: [{ name: "node", type: "bytes32" }, { name: "key", type: "string" }, { name: "value", type: "string" }], outputs: [] },
  { type: "function", name: "text", stateMutability: "view", inputs: [{ name: "node", type: "bytes32" }, { name: "key", type: "string" }], outputs: [{ name: "", type: "string" }] },
] as const;

function requireKey(): Hex {
  const pk = process.env.CONTROLLER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("CONTROLLER_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY) required.");
  return (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const homeName = normalize(`${HOME_LABEL}.eth`);
  const agentName = normalize(`${AGENT_LABEL}.${homeName}`);
  const homeNode = namehash(homeName);
  const agentNode = namehash(agentName);
  const homeTokenId = BigInt(labelhash(HOME_LABEL));
  const homeWrapperId = BigInt(homeNode);
  const resolver = SEPOLIA_ENS.publicResolver;

  const account = privateKeyToAccount(requireKey());
  const controller = account.address;
  const pub = getClient("sepolia");
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(SEPOLIA_RPC_URL) });

  const mode = execute ? "EXECUTE (broadcasting txs)" : "PREFLIGHT (read-only)";
  console.log(`[sovereign] ${mode}`);
  console.log(`[sovereign] home=${homeName} agent=${agentName}`);
  console.log(`[sovereign] controller=${controller} resolver=${resolver}`);

  const balance = await pub.getBalance({ address: controller });
  console.log(`[sovereign] controller balance: ${(Number(balance) / 1e18).toFixed(6)} ETH`);

  // ── State reads ────────────────────────────────────────────────────────────
  const homeBaseOwner = (await pub.readContract({ address: BASE_REGISTRAR, abi: BASE_REGISTRAR_ABI, functionName: "ownerOf", args: [homeTokenId] }).catch(() => null)) as Address | null;
  const homeWrapOwner = (await pub.readContract({ address: SEPOLIA_ENS.nameWrapper, abi: NAME_WRAPPER_ABI, functionName: "ownerOf", args: [homeWrapperId] }).catch(() => null)) as Address | null;
  const agentWrapOwner = (await pub.readContract({ address: SEPOLIA_ENS.nameWrapper, abi: NAME_WRAPPER_ABI, functionName: "ownerOf", args: [BigInt(agentNode)] }).catch(() => null)) as Address | null;

  const ours = (a: Address | null) => a != null && a.toLowerCase() === controller.toLowerCase();
  const wrapper = SEPOLIA_ENS.nameWrapper.toLowerCase();
  const homeOwnedByOther = homeBaseOwner != null && homeBaseOwner.toLowerCase() !== controller.toLowerCase() && homeBaseOwner.toLowerCase() !== wrapper;
  const homeWrapped = ours(homeWrapOwner);
  const homeOwned = ours(homeBaseOwner) || homeWrapped || (homeBaseOwner != null && homeBaseOwner.toLowerCase() === wrapper);

  console.log(`[state] ${homeName}: baseOwner=${homeBaseOwner ?? "<none>"} wrapOwner=${homeWrapOwner ?? "<none>"} → ${homeOwnedByOther ? "TAKEN BY SOMEONE ELSE" : homeOwned ? "ours" : "AVAILABLE"}`);
  console.log(`[state] ${agentName}: wrapOwner=${agentWrapOwner ?? "<none>"} → ${ours(agentWrapOwner) ? "exists (ours)" : "not yet created"}`);

  if (homeOwnedByOther) {
    console.log(`\n[abort] ${homeName} is registered to another address. Set SOVEREIGN_HOME_LABEL to a free label and re-run.`);
    process.exitCode = 1;
    return;
  }

  const ensip25Key = agentRegistrationKey(WARD_AGENT_REGISTRY_CHAIN_ID, WARD_AGENT_REGISTRY, WARD_AGENT_ID);
  const webEndpoint = process.env.WARD_AGENT_WEB ?? "https://web-nine-ashen-75.vercel.app";
  const agentContext = [
    `# ${agentName} — a sovereign WARD home agent`,
    ``,
    `This is one home's own autonomous agent, owned by the homeowner under their`,
    `own ENS domain (${homeName}) — not by the WARD platform. It runs the same`,
    `protocol as ward-agent.eth: hires verified human field techs and settles`,
    `USDC on attested completion. Reputation lives onchain in the Arc`,
    `WorkerRegistry; this name verifies per ENSIP-25 against that registry.`,
  ].join("\n");
  const texts: { key: string; value: string }[] = [
    { key: AGENT_CONTEXT_KEY, value: agentContext },
    { key: agentEndpointKey("web"), value: webEndpoint },
    { key: ensip25Key, value: "1" },
  ];

  if (!execute) {
    console.log(`\n[preflight] planned steps (idempotent):`);
    if (!homeOwned) console.log(`  1. register ${homeName} (free premigration registrar) + wrap`);
    else if (!homeWrapped) console.log(`  1. wrap ${homeName}`);
    else console.log(`  1. ${homeName} already registered+wrapped — skip`);
    console.log(`  2. setSubnodeRecord → create ${agentName} (owner=controller)`);
    console.log(`  3. setAddr(${agentName}) → ${controller}`);
    texts.forEach((t, i) => console.log(`  ${4 + i}. setText "${t.key.length > 44 ? t.key.slice(0, 44) + "…" : t.key}"`));
    console.log(`\n[preflight] ENSIP-25 key: ${ensip25Key}`);
    console.log(`[preflight] no txs sent. Re-run with --execute to broadcast.`);
    return;
  }

  // ── Step 1: register + wrap the home 2LD ─────────────────────────────────────
  if (!homeOwned) {
    const duration = BigInt(process.env.WARD_REG_DURATION ?? 31536000);
    const secret = keccak256(toHex(`${HOME_LABEL}:${controller}:sovereign`));
    const registration = { label: HOME_LABEL, owner: controller, duration, secret, resolver: ZERO_ADDRESS, data: [] as Hex[], reverseRecord: 0, referrer: ZERO_BYTES32 };
    const h = await wallet.writeContract({ address: SEPOLIA_ENS.ethRegistrarController, abi: CONTROLLER_ABI, functionName: "register", args: [registration], value: 0n });
    console.log(`[register] ${homeName} tx: ${h}`);
    const r = await pub.waitForTransactionReceipt({ hash: h });
    if (r.status !== "success") throw new Error(`register reverted: ${h}`);
  } else {
    console.log(`[register] ${homeName} already owned — skip`);
  }

  if (!homeWrapped) {
    const approved = (await pub.readContract({ address: BASE_REGISTRAR, abi: BASE_REGISTRAR_ABI, functionName: "isApprovedForAll", args: [controller, SEPOLIA_ENS.nameWrapper] })) as boolean;
    if (!approved) {
      const ah = await wallet.writeContract({ address: BASE_REGISTRAR, abi: BASE_REGISTRAR_ABI, functionName: "setApprovalForAll", args: [SEPOLIA_ENS.nameWrapper, true] });
      console.log(`[wrap] approve NameWrapper tx: ${ah}`);
      await pub.waitForTransactionReceipt({ hash: ah });
    }
    const wh = await wallet.writeContract({ address: SEPOLIA_ENS.nameWrapper, abi: NAME_WRAPPER_ABI, functionName: "wrapETH2LD", args: [HOME_LABEL, controller, 0, resolver] });
    console.log(`[wrap] wrapETH2LD ${homeName} tx: ${wh}`);
    await pub.waitForTransactionReceipt({ hash: wh });
  } else {
    console.log(`[wrap] ${homeName} already wrapped — skip`);
  }

  // Ensure the home's registry resolver is the public resolver.
  const homeResolver = (await pub.readContract({ address: SEPOLIA_ENS.registry, abi: ENS_REGISTRY_ABI, functionName: "resolver", args: [homeNode] }).catch(() => null)) as Address | null;
  if (!homeResolver || homeResolver.toLowerCase() !== resolver.toLowerCase()) {
    const h = await wallet.writeContract({ address: SEPOLIA_ENS.nameWrapper, abi: NAME_WRAPPER_ABI, functionName: "setResolver", args: [homeNode, resolver] });
    console.log(`[resolver] setResolver(${homeName}) tx: ${h}`);
    await pub.waitForTransactionReceipt({ hash: h });
  }

  // ── Step 2: create the agent subname ─────────────────────────────────────────
  if (!ours(agentWrapOwner)) {
    const sh = await wallet.writeContract({ address: SEPOLIA_ENS.nameWrapper, abi: NAME_WRAPPER_ABI, functionName: "setSubnodeRecord", args: [homeNode, AGENT_LABEL, controller, resolver, 0n, 0, MAX_EXPIRY] });
    console.log(`[subname] create ${agentName} tx: ${sh}`);
    await pub.waitForTransactionReceipt({ hash: sh });
  } else {
    console.log(`[subname] ${agentName} already exists — skip`);
  }

  // ── Step 3: records on agent.demo-home.eth (addr + ENSIP-26 + ENSIP-25) ──────
  const curAddr = (await pub.readContract({ address: resolver, abi: RESOLVER_ABI, functionName: "addr", args: [agentNode] }).catch(() => null)) as Address | null;
  if (!curAddr || curAddr.toLowerCase() !== controller.toLowerCase()) {
    const h = await wallet.writeContract({ address: resolver, abi: RESOLVER_ABI, functionName: "setAddr", args: [agentNode, controller] });
    console.log(`[records] setAddr ${agentName} tx: ${h}`);
    await pub.waitForTransactionReceipt({ hash: h });
  }
  for (const { key, value } of texts) {
    const h = await wallet.writeContract({ address: resolver, abi: RESOLVER_ABI, functionName: "setText", args: [agentNode, key, value] });
    console.log(`[records] setText "${key.length > 44 ? key.slice(0, 44) + "…" : key}" tx: ${h}`);
    await pub.waitForTransactionReceipt({ hash: h });
  }

  const endBalance = await pub.getBalance({ address: controller });
  console.log(`[sovereign] spent: ${(Number(balance - endBalance) / 1e18).toFixed(6)} ETH`);
  console.log(`[sovereign] DONE — ${agentName} registered, records set, ENSIP-25 key: ${ensip25Key}`);
  console.log(`[sovereign] ward-agent.eth untouched (no reverse setName).`);
}

main().catch((error) => {
  console.error("error:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
