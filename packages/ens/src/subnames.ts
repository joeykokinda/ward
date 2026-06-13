// Mint a worker subname `<handle>.ward-agent.eth` and set its ENSIP-26 /
// WARD text records.
//
// ── Where subnames live (decision) ──
// WARD subnames are issued on **L1 Sepolia** using the **ENS NameWrapper**
// (the same path the ENS app uses for "create subname"). Rationale:
//   • ward-agent.eth itself is a wrapped .eth name on Sepolia, so the parent is
//     already an ERC-1155 NFT held by the NameWrapper — subnames are created by
//     calling NameWrapper.setSubnodeRecord on the parent node.
//   • Keeping the whole identity graph on one L1 testnet means the agent reads
//     workers, its own name, and reverse records from a single Sepolia client —
//     no cross-domain CCIP-read or L2 bridge needed for the demo.
//   • An L2 issuance path (e.g. Durin / Namechain subname registrar) is a valid
//     production optimization for gas, but adds a resolver-gateway dependency
//     that is not worth the demo risk. Documented as future work in README.md.
//
// Registry/wrapper used: ENS NameWrapper (Sepolia 0x0635…dCE8), with records on
// the ENS Public Resolver (Sepolia 0xE996…49b5).
//
// Minting needs a funded controller wallet (the owner of ward-agent.eth). That
// key is read from CONTROLLER_PRIVATE_KEY and is required ONLY for live mode.
// `--dry-run` (default) computes and prints every exact call/tx without a key
// and without touching the network for writes.
//
// NameWrapper method (https://github.com/ensdomains/name-wrapper):
//   setSubnodeRecord(
//     bytes32 parentNode, string label, address owner, address resolver,
//     uint64 ttl, uint32 fuses, uint64 expiry
//   ) → bytes32 node
// Resolver method (ENSIP-5): setText(bytes32 node, string key, string value)

import {
  createWalletClient,
  encodeFunctionData,
  http,
  namehash,
  type Address,
  type Hex,
} from "viem";
import { normalize } from "viem/ens";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { getClient, SEPOLIA_ENS, SEPOLIA_RPC_URL, WARD_ENS_ROOT } from "./config.js";
import {
  buildWorkerContext,
  reputationPointer,
  workerTextRecords,
  type WorkerRecord,
} from "./records.js";

// Minimal ABIs for the two contracts we call.
const NAME_WRAPPER_ABI = [
  {
    type: "function",
    name: "setSubnodeRecord",
    stateMutability: "nonpayable",
    inputs: [
      { name: "parentNode", type: "bytes32" },
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "resolver", type: "address" },
      { name: "ttl", type: "uint64" },
      { name: "fuses", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "node", type: "bytes32" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
  },
] as const;

const RESOLVER_ABI = [
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
] as const;

// NameWrapper fuse constants (subset). For a worker subname we keep it simple:
// no fuses burned (0) and no expiry restriction (max uint64) so the parent can
// still manage/revoke the worker name. Production could burn PARENT_CANNOT_*.
export const FUSES = {
  CANNOT_UNWRAP: 1,
  PARENT_CANNOT_CONTROL: 65536,
} as const;

const NO_FUSES = 0;
const MAX_EXPIRY = (2n ** 64n - 1n).toString(); // uint64 max; "no earlier expiry"

export type PlannedCall = {
  step: number;
  description: string;
  to: Address;
  contract: "NameWrapper" | "PublicResolver";
  functionName: string;
  args: unknown[];
  data: Hex;
};

export type MintPlan = {
  handle: string;
  subname: string; // <handle>.ward-agent.eth
  parentName: string; // ward-agent.eth
  parentNode: Hex;
  childNode: Hex;
  owner: Address;
  resolver: Address;
  record: WorkerRecord;
  calls: PlannedCall[];
};

// Build the full set of transactions to mint a worker subname + set records.
// Pure / offline: this is what --dry-run prints, and what live mode executes.
export function buildMintPlan(params: {
  handle: string;
  ownerAddress: Address; // the worker's wallet — what the subname RESOLVES to
  // (addr record) and the reputation subject. Defaults to also owning the
  // subname unless subnameOwner is given.
  skills: string[];
  region: string;
  // For the reputation pointer (WorkerRegistry on Arc).
  reputationChainId: number;
  reputationRegistry: string;
  webBaseUrl?: string; // e.g. https://ward.example/worker — handle appended
  resolver?: Address;
  // Who holds the subname NFT. WARD keeps the fleet under the controller (the
  // agent that hires workers) so it can set/curate every worker's records,
  // while the addr record still points at the worker's wallet. If omitted the
  // worker owns its own subname (then only the worker can edit its records).
  subnameOwner?: Address;
}): MintPlan {
  const handle = normalize(params.handle);
  const parentName = WARD_ENS_ROOT;
  const subname = `${handle}.${parentName}`;
  const parentNode = namehash(parentName);
  const childNode = namehash(subname);
  const resolver = params.resolver ?? SEPOLIA_ENS.publicResolver;
  const subnameOwner = params.subnameOwner ?? params.ownerAddress;

  const record: WorkerRecord = {
    ensName: subname,
    skills: params.skills,
    region: params.region,
    reputationPointer: reputationPointer(
      params.reputationChainId,
      params.reputationRegistry,
      params.ownerAddress,
    ),
    role: "worker",
    agentContext: buildWorkerContext(handle, params.skills, params.region),
    webEndpoint: params.webBaseUrl ? `${params.webBaseUrl.replace(/\/$/, "")}/${handle}` : undefined,
  };

  const calls: PlannedCall[] = [];

  // Step 1 — create the subname (owner = subnameOwner), resolver pre-set.
  const mintArgs = [
    parentNode,
    handle,
    subnameOwner,
    resolver,
    BigInt(0), // ttl
    NO_FUSES,
    BigInt(MAX_EXPIRY),
  ];
  calls.push({
    step: 1,
    description: `Create subname ${subname} via NameWrapper.setSubnodeRecord (owner=${subnameOwner}, addr→${params.ownerAddress}, resolver=${resolver})`,
    to: SEPOLIA_ENS.nameWrapper,
    contract: "NameWrapper",
    functionName: "setSubnodeRecord",
    args: mintArgs,
    data: encodeFunctionData({
      abi: NAME_WRAPPER_ABI,
      functionName: "setSubnodeRecord",
      args: mintArgs as never,
    }),
  });

  // Step 2 — set the forward addr record (worker wallet) on the child node so
  // <handle>.ward-agent.eth resolves to the worker's address.
  const setAddrArgs = [childNode, params.ownerAddress];
  calls.push({
    step: 2,
    description: `Set addr record -> ${params.ownerAddress} on ${subname}`,
    to: resolver,
    contract: "PublicResolver",
    functionName: "setAddr",
    args: setAddrArgs,
    data: encodeFunctionData({
      abi: RESOLVER_ABI,
      functionName: "setAddr",
      args: setAddrArgs as never,
    }),
  });

  // Steps 3..N — one setText per record on the child node.
  let step = 3;
  for (const { key, value } of workerTextRecords(record)) {
    const args = [childNode, key, value];
    calls.push({
      step,
      description: `Set text record "${key}" on ${subname}`,
      to: resolver,
      contract: "PublicResolver",
      functionName: "setText",
      args,
      data: encodeFunctionData({
        abi: RESOLVER_ABI,
        functionName: "setText",
        args: args as never,
      }),
    });
    step += 1;
  }

  return {
    handle,
    subname,
    parentName,
    parentNode,
    childNode,
    owner: subnameOwner,
    resolver,
    record,
    calls,
  };
}

export type MintResult = {
  plan: MintPlan;
  dryRun: boolean;
  txHashes: Hex[]; // populated only when executed live
};

// Pretty-print a plan as the "exact calls/txs it would make" for --dry-run.
export function formatPlan(plan: MintPlan): string {
  const lines: string[] = [];
  lines.push(`DRY RUN — mint ${plan.subname}`);
  lines.push(`  parent     : ${plan.parentName}  (node ${plan.parentNode})`);
  lines.push(`  subname    : ${plan.subname}  (node ${plan.childNode})`);
  lines.push(`  owner      : ${plan.owner}`);
  lines.push(`  resolver   : ${plan.resolver}`);
  lines.push(`  controller : signs all txs (must own ${plan.parentName})`);
  lines.push(`  txs        : ${plan.calls.length}`);
  lines.push("");
  for (const call of plan.calls) {
    lines.push(`  [tx ${call.step}] ${call.contract}.${call.functionName}`);
    lines.push(`        to   : ${call.to}`);
    lines.push(`        what : ${call.description}`);
    lines.push(`        args : ${JSON.stringify(call.args, bigintReplacer)}`);
    lines.push(`        data : ${call.data.slice(0, 74)}…`);
    lines.push("");
  }
  lines.push(`  Resolved records on ${plan.subname}:`);
  for (const { key, value } of workerTextRecords(plan.record)) {
    const oneLine = value.replace(/\n/g, " ⏎ ");
    lines.push(`    ${key} = ${oneLine.length > 80 ? oneLine.slice(0, 80) + "…" : oneLine}`);
  }
  return lines.join("\n");
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

// Execute the plan live. Requires CONTROLLER_PRIVATE_KEY (owner of the parent
// name). Sends each tx sequentially and waits for the receipt. NEVER called by
// default; the CLI requires explicit --execute AND a present key.
export async function executeMintPlan(plan: MintPlan): Promise<MintResult> {
  const pk = process.env.CONTROLLER_PRIVATE_KEY;
  if (!pk) {
    throw new Error(
      "CONTROLLER_PRIVATE_KEY is required for live minting. Run with --dry-run to preview.",
    );
  }
  const account = privateKeyToAccount(pk.startsWith("0x") ? (pk as Hex) : (`0x${pk}` as Hex));
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(SEPOLIA_RPC_URL),
  });
  const publicClient = getClient("sepolia");

  const txHashes: Hex[] = [];
  for (const call of plan.calls) {
    const hash = await wallet.sendTransaction({ to: call.to, data: call.data });
    await publicClient.waitForTransactionReceipt({ hash });
    txHashes.push(hash);
  }
  return { plan, dryRun: false, txHashes };
}
