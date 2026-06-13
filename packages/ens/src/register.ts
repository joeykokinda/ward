#!/usr/bin/env tsx
// Register the 2LD `ward-agent.eth` on Sepolia, wrap it into the NameWrapper,
// and set the agent's own records (ENSIP-26 endpoints/context + ENSIP-25
// agent-registration). This is the ONE on-chain bootstrap step the rest of the
// library (subnames.ts / records.ts / verify.ts) assumes already happened.
//
// Flow (all idempotent — safe to re-run):
//   1. ETHRegistrarController commit → wait minCommitmentAge → register
//      (resolver pre-set, addr record set during registration, reverseRecord
//       bit set so ward-agent.eth becomes the controller's primary name).
//   2. Wrap the .eth name via NameWrapper.wrapETH2LD (approve BaseRegistrar
//      first) so subnames can be issued with setSubnodeRecord.
//   3. Set the agent's ENSIP-26 records (agent-context, agent-endpoint[web])
//      and the ENSIP-25 agent-registration[...] attestation on the wrapped name.
//
// Signer: CONTROLLER_PRIVATE_KEY (the funded controller wallet). Reads/writes
// hit live Sepolia. Nothing is hardcoded as a "result"; every value is set
// on-chain here and resolved live elsewhere.

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
  WARD_ENS_ROOT,
  WARD_AGENT_ID,
  WARD_AGENT_REGISTRY,
  WARD_AGENT_REGISTRY_CHAIN_ID,
} from "./config.js";
import { agentRegistrationKey } from "./verify.js";
import { AGENT_CONTEXT_KEY, agentEndpointKey } from "./records.js";

const BASE_REGISTRAR = (process.env.ENS_BASE_REGISTRAR ??
  "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85") as Address;

// Sepolia .eth registrar — register(Registration) (selector 0xef9c8805). The
// active controller is the TestnetV1PremigrationRegistrar: free, single-tx, no
// commit/reveal, no rentPrice/available getters (they revert), so the ABI here
// is just register(). The Registration struct matches the standard
// IETHRegistrarController.Registration field order.
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
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const;

const NAME_WRAPPER_ABI = [
  {
    type: "function",
    name: "wrapETH2LD",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "wrappedOwner", type: "address" },
      { name: "ownerControlledFuses", type: "uint16" },
      { name: "resolver", type: "address" },
    ],
    outputs: [{ name: "expiry", type: "uint64" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
  },
  {
    type: "function",
    name: "setResolver",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "resolver", type: "address" },
    ],
    outputs: [],
  },
] as const;

const ENS_REGISTRY_ABI = [
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const REVERSE_REGISTRAR_ABI = [
  {
    type: "function",
    name: "setName",
    stateMutability: "nonpayable",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "node",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const RESOLVER_ABI = [
  {
    type: "function",
    name: "setAddr",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "a", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "addr",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "setText",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
] as const;

type Registration = {
  label: string;
  owner: Address;
  duration: bigint;
  secret: Hex;
  resolver: Address;
  data: Hex[];
  reverseRecord: number;
  referrer: Hex;
};

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

function requireKey(): Hex {
  const pk = process.env.CONTROLLER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) {
    throw new Error(
      "CONTROLLER_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY) required to register/wrap ward-agent.eth.",
    );
  }
  return (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
}

async function main(): Promise<void> {
  const label = WARD_ENS_ROOT.replace(/\.eth$/, ""); // "ward-agent"
  const name = WARD_ENS_ROOT;
  const node = namehash(name);
  // BaseRegistrar ERC721 id = labelhash(label); NameWrapper ERC1155 id = node.
  const tokenId = BigInt(labelhash(label));
  const wrapperId = BigInt(node);
  const resolver = SEPOLIA_ENS.publicResolver;

  const account = privateKeyToAccount(requireKey());
  const controller = account.address;
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(SEPOLIA_RPC_URL) });
  const pub = getClient("sepolia");

  console.log(`[register] name=${name} controller=${controller}`);
  console.log(`           resolver=${resolver} wrapper=${SEPOLIA_ENS.nameWrapper}`);

  const startBalance = await pub.getBalance({ address: controller });
  console.log(`           start balance: ${startBalance} wei`);

  // ── Step 1: register the 2LD if not already owned by the controller ──────────
  const baseOwner = (await pub
    .readContract({ address: BASE_REGISTRAR, abi: BASE_REGISTRAR_ABI, functionName: "ownerOf", args: [tokenId] })
    .catch(() => null)) as Address | null;
  const wrapperOwner = (await pub
    .readContract({ address: SEPOLIA_ENS.nameWrapper, abi: NAME_WRAPPER_ABI, functionName: "ownerOf", args: [wrapperId] })
    .catch(() => null)) as Address | null;

  const alreadyWrapped =
    wrapperOwner != null && wrapperOwner.toLowerCase() === controller.toLowerCase();
  const ownedUnwrapped =
    baseOwner != null && baseOwner.toLowerCase() === controller.toLowerCase();
  // When wrapped, the BaseRegistrar token is held by the NameWrapper.
  const heldByWrapper =
    baseOwner != null && baseOwner.toLowerCase() === SEPOLIA_ENS.nameWrapper.toLowerCase();

  if (!ownedUnwrapped && !alreadyWrapped && !heldByWrapper) {
    const duration = BigInt(process.env.WARD_REG_DURATION ?? 31536000); // 1 year
    // A fresh secret (the premigration registrar still takes one in the struct).
    const secret = keccak256(toHex(`${label}:${controller}:${Date.now()}`));

    // Register directly through the active Sepolia .eth registrar (the
    // TestnetV1PremigrationRegistrar — the only authorized controller on the
    // BaseRegistrar right now). It is free (value 0), single-tx, no commit/
    // reveal. We register with resolver=0 / data=[] / reverseRecord=0 and set
    // the resolver, records and reverse separately after wrapping (steps 2-4),
    // mirroring the working registration pattern observed on-chain.
    const registration: Registration = {
      label,
      owner: controller,
      duration,
      secret,
      resolver: ZERO_ADDRESS,
      data: [],
      reverseRecord: 0,
      referrer: ZERO_BYTES32,
    };

    console.log(`[register] via ${SEPOLIA_ENS.ethRegistrarController} (no commit, free)`);
    const registerHash = await wallet.writeContract({
      address: SEPOLIA_ENS.ethRegistrarController,
      abi: CONTROLLER_ABI,
      functionName: "register",
      args: [registration],
      value: 0n,
    });
    console.log(`  register tx: ${registerHash}`);
    const rcpt = await pub.waitForTransactionReceipt({ hash: registerHash });
    if (rcpt.status !== "success") throw new Error(`register tx reverted: ${registerHash}`);
    console.log(`  REGISTERED ${name} in block ${rcpt.blockNumber}`);
  } else {
    console.log(`[register] ${name} already owned (skip). wrapped=${alreadyWrapped} unwrapped=${ownedUnwrapped} heldByWrapper=${heldByWrapper}`);
  }

  // ── Step 2: wrap into NameWrapper so subnames can be issued ──────────────────
  const wrappedNow = (await pub
    .readContract({ address: SEPOLIA_ENS.nameWrapper, abi: NAME_WRAPPER_ABI, functionName: "ownerOf", args: [wrapperId] })
    .catch(() => null)) as Address | null;
  if (wrappedNow != null && wrappedNow.toLowerCase() === controller.toLowerCase()) {
    console.log(`[wrap] ${name} already wrapped (owner=${wrappedNow}) — skip`);
  } else {
    const approved = (await pub.readContract({
      address: BASE_REGISTRAR,
      abi: BASE_REGISTRAR_ABI,
      functionName: "isApprovedForAll",
      args: [controller, SEPOLIA_ENS.nameWrapper],
    })) as boolean;
    if (!approved) {
      const approveHash = await wallet.writeContract({
        address: BASE_REGISTRAR,
        abi: BASE_REGISTRAR_ABI,
        functionName: "setApprovalForAll",
        args: [SEPOLIA_ENS.nameWrapper, true],
      });
      console.log(`[wrap] approve NameWrapper tx: ${approveHash}`);
      await pub.waitForTransactionReceipt({ hash: approveHash });
    }
    const wrapHash = await wallet.writeContract({
      address: SEPOLIA_ENS.nameWrapper,
      abi: NAME_WRAPPER_ABI,
      functionName: "wrapETH2LD",
      args: [label, controller, 0, resolver],
    });
    console.log(`[wrap] wrapETH2LD tx: ${wrapHash}`);
    await pub.waitForTransactionReceipt({ hash: wrapHash });
    console.log(`[wrap] WRAPPED ${name}`);
  }

  // ── Step 2b: ensure the registry resolver points at the configured resolver ──
  // (The name is wrapped, so the resolver is set through the NameWrapper.)
  const currentResolver = (await pub
    .readContract({ address: SEPOLIA_ENS.registry, abi: ENS_REGISTRY_ABI, functionName: "resolver", args: [node] })
    .catch(() => null)) as Address | null;
  if (!currentResolver || currentResolver.toLowerCase() !== resolver.toLowerCase()) {
    const h = await wallet.writeContract({
      address: SEPOLIA_ENS.nameWrapper,
      abi: NAME_WRAPPER_ABI,
      functionName: "setResolver",
      args: [node, resolver],
    });
    console.log(`[resolver] setResolver(${resolver}) tx: ${h}`);
    await pub.waitForTransactionReceipt({ hash: h });
  } else {
    console.log(`[resolver] registry resolver already ${resolver} — skip`);
  }

  // ── Step 3: set the agent's own records (idempotent setText/setAddr) ─────────
  const webEndpoint = process.env.WARD_AGENT_WEB ?? "https://web-nine-ashen-75.vercel.app";
  const agentContext =
    process.env.WARD_AGENT_CONTEXT ??
    [
      `# WARD — autonomous agent that hires & pays human field technicians`,
      ``,
      `ward-agent.eth dispatches verified workers to physical-world jobs and pays`,
      `them in USDC on attested completion. Workers are subnames of this name`,
      `(<handle>.ward-agent.eth), each carrying ENSIP-26 records + WARD skill/`,
      `region/reputation attributes. Reputation lives onchain in the Arc`,
      `WorkerRegistry; this name verifies per ENSIP-25 against that registry.`,
    ].join("\n");

  const ensip25Key = agentRegistrationKey(
    WARD_AGENT_REGISTRY_CHAIN_ID,
    WARD_AGENT_REGISTRY,
    WARD_AGENT_ID,
  );

  const texts: { key: string; value: string }[] = [
    { key: AGENT_CONTEXT_KEY, value: agentContext },
    { key: agentEndpointKey("web"), value: webEndpoint },
    { key: ensip25Key, value: "1" }, // ENSIP-25 attestation (non-empty => verified)
  ];

  // Ensure the forward addr record is set (it is set during registration, but
  // re-assert in case of a re-run on an already-registered name).
  const currentAddr = (await pub
    .readContract({ address: resolver, abi: RESOLVER_ABI, functionName: "addr", args: [node] })
    .catch(() => null)) as Address | null;
  if (!currentAddr || currentAddr.toLowerCase() !== controller.toLowerCase()) {
    const h = await wallet.writeContract({
      address: resolver,
      abi: RESOLVER_ABI,
      functionName: "setAddr",
      args: [node, controller],
    });
    console.log(`[records] setAddr tx: ${h}`);
    await pub.waitForTransactionReceipt({ hash: h });
  }

  for (const { key, value } of texts) {
    const h = await wallet.writeContract({
      address: resolver,
      abi: RESOLVER_ABI,
      functionName: "setText",
      args: [node, key, value],
    });
    console.log(`[records] setText "${key.length > 40 ? key.slice(0, 40) + "…" : key}" tx: ${h}`);
    await pub.waitForTransactionReceipt({ hash: h });
  }
  console.log(`[records] ENSIP-25 key set: ${ensip25Key}`);

  // ── Step 4: set the controller's primary name to ward-agent.eth ──────────────
  // (Separate from registration because the controller's inline reverseRecord
  //  path reverts on this deployment.) Enables the resolve round-trip proof.
  const setNameHash = await wallet.writeContract({
    address: SEPOLIA_ENS.reverseRegistrar,
    abi: REVERSE_REGISTRAR_ABI,
    functionName: "setName",
    args: [name],
  });
  console.log(`[reverse] setName(${name}) tx: ${setNameHash}`);
  await pub.waitForTransactionReceipt({ hash: setNameHash });

  const endBalance = await pub.getBalance({ address: controller });
  console.log(`[register] end balance: ${endBalance} wei`);
  console.log(`[register] spent so far: ${startBalance - endBalance} wei`);
  console.log(`[register] DONE — ${name} registered, wrapped, records set.`);
}

main().catch((error) => {
  console.error("error:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
