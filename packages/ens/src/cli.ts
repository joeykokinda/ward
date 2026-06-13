#!/usr/bin/env tsx
// WARD ENS CLI.
//
//   pnpm resolve <name|0xaddress>           forward + reverse + round-trip
//   pnpm records <name>                      read ENSIP-26 / WARD text records
//   pnpm verify  [name]                      ENSIP-25 agent name verification
//   pnpm mint-subname <handle> --dry-run     plan (default) or --execute live
//   pnpm discover --skill router [--region "Greenwich"]
//
// Flags: --chain sepolia|mainnet (default sepolia), --rpc <url> override.
// All reads hit the live chain. Mint defaults to --dry-run; --execute requires
// CONTROLLER_PRIVATE_KEY and is never the default.

import { isAddress, type Address } from "viem";
import { rpcFor, WARD_ENS_ROOT } from "./config.js";
import { readAgentRecord, readWorkerRecord, workerRecordKeys } from "./records.js";
import { readTextRecords, resolveAddress, resolvePrimaryName, roundTrip } from "./resolve.js";
import { verifyAgentName, verifyWardAgent, encodeInteroperableAddress } from "./verify.js";
import { buildMintPlan, executeMintPlan, formatPlan } from "./subnames.js";
import { discoverWorkers } from "./discover.js";

type Chain = "sepolia" | "mainnet";

function parseFlags(argv: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(token);
    }
  }
  return { positional, flags };
}

function chainFlag(flags: Record<string, string | boolean>): Chain {
  const value = flags.chain;
  return value === "mainnet" ? "mainnet" : "sepolia";
}

async function cmdResolve(arg: string, chain: Chain): Promise<void> {
  console.log(`[resolve] chain=${chain} rpc=${rpcFor(chain)}`);
  if (isAddress(arg)) {
    const name = await resolvePrimaryName(arg as Address, chain);
    console.log(`  address     : ${arg}`);
    console.log(`  primaryName : ${name ?? "(none)"}`);
    return;
  }
  const rt = await roundTrip(arg, chain);
  console.log(`  name        : ${rt.name}`);
  console.log(`  address     : ${rt.address ?? "(unresolved)"}`);
  console.log(`  primaryName : ${rt.primaryName ?? "(none)"}`);
  console.log(`  round-trip  : ${rt.matches ? "MATCH (name owns its reverse record)" : "no reverse match"}`);
}

async function cmdRecords(name: string, chain: Chain): Promise<void> {
  console.log(`[records] ${name} chain=${chain}`);
  const isWorker = name.endsWith(`.${WARD_ENS_ROOT}`) && name !== WARD_ENS_ROOT;
  if (isWorker) {
    const record = await readWorkerRecord(name, chain);
    if (!record) {
      console.log("  (no WARD worker records found — name may be unminted)");
      // Still dump raw keys for transparency.
      const raw = await readTextRecords(name, workerRecordKeys(), chain);
      for (const [key, value] of Object.entries(raw)) console.log(`  ${key} = ${value ?? "(empty)"}`);
      return;
    }
    console.log(`  role        : ${record.role}`);
    console.log(`  skills      : ${record.skills.join(", ") || "(none)"}`);
    console.log(`  region      : ${record.region || "(none)"}`);
    console.log(`  reputation→ : ${record.reputationPointer || "(none)"}`);
    console.log(`  web         : ${record.webEndpoint ?? "(none)"}`);
    console.log(`  agent-context:\n${indent(record.agentContext || "(none)")}`);
    return;
  }
  const record = await readAgentRecord(name, chain);
  console.log(`  agent-context:\n${indent(record.agentContext || "(none)")}`);
  console.log(`  agent-endpoint[web] : ${record.webEndpoint ?? "(none)"}`);
  console.log(`  agent-endpoint[a2a] : ${record.a2aEndpoint ?? "(none)"}`);
  console.log(`  agent-endpoint[mcp] : ${record.mcpEndpoint ?? "(none)"}`);
}

async function cmdVerify(name: string | undefined, chain: Chain, flags: Record<string, string | boolean>): Promise<void> {
  let result;
  if (!name || name === WARD_ENS_ROOT) {
    result = await verifyWardAgent(chain);
  } else {
    const chainId = Number(flags["registry-chain"] ?? "11155111");
    const registry = String(flags.registry ?? "");
    const agentId = String(flags["agent-id"] ?? "1");
    if (!isAddress(registry)) {
      console.error("  --registry <0xaddress> required when verifying a non-WARD name");
      process.exitCode = 1;
      return;
    }
    result = await verifyAgentName(name, chainId, registry, agentId, chain);
  }
  console.log(`[verify] ENSIP-25 agent name verification`);
  console.log(`  ensName  : ${result.ensName}`);
  console.log(`  registry : ${result.registry} (chainId ${result.chainId})`);
  console.log(`  agentId  : ${result.agentId}`);
  console.log(`  erc7930  : ${encodeInteroperableAddress(result.chainId, result.registry)}`);
  console.log(`  key      : ${result.key}`);
  console.log(`  value    : ${result.value ?? "(empty)"}`);
  console.log(`  VERIFIED : ${result.verified ? "YES" : "NO (set the text record to attest)"}`);
}

async function cmdMint(handle: string, flags: Record<string, string | boolean>): Promise<void> {
  const execute = flags.execute === true || flags.execute === "true";
  const owner = String(flags.owner ?? process.env.WARD_DEMO_WORKER_ADDRESS ?? "0x000000000000000000000000000000000000dEaD");
  if (!isAddress(owner)) {
    console.error(`  invalid --owner address: ${owner}`);
    process.exitCode = 1;
    return;
  }
  // The subname NFT is held by the WARD controller (fleet manager) so it can set
  // every worker's records; the addr record still points at the worker (--owner).
  const subnameOwner = flags["subname-owner"] ?? process.env.WARD_SUBNAME_OWNER;
  if (subnameOwner !== undefined && !isAddress(String(subnameOwner))) {
    console.error(`  invalid --subname-owner address: ${subnameOwner}`);
    process.exitCode = 1;
    return;
  }
  const plan = buildMintPlan({
    handle,
    ownerAddress: owner as Address,
    subnameOwner: subnameOwner ? (String(subnameOwner) as Address) : undefined,
    skills: String(flags.skills ?? "router,network").split(",").map((s) => s.trim()).filter(Boolean),
    region: String(flags.region ?? "Greenwich, CT"),
    reputationChainId: Number(flags["rep-chain"] ?? process.env.ARC_CHAIN_ID ?? "8008"),
    reputationRegistry: String(flags["rep-registry"] ?? process.env.WORKER_REGISTRY ?? "0x0000000000000000000000000000000000000000"),
    webBaseUrl: String(flags.web ?? process.env.WARD_WEB_BASE ?? "https://ward.demo/worker"),
  });

  if (!execute) {
    console.log(formatPlan(plan));
    console.log("\n(no transactions sent — pass --execute with CONTROLLER_PRIVATE_KEY to run live)");
    return;
  }
  console.log(`[mint] EXECUTING ${plan.subname} live on Sepolia…`);
  const result = await executeMintPlan(plan);
  result.txHashes.forEach((hash, i) => console.log(`  tx ${i + 1}: ${hash}`));
  console.log(`  done — ${plan.subname} minted with ${plan.calls.length} txs`);
}

async function cmdDiscover(flags: Record<string, string | boolean>, chain: Chain): Promise<void> {
  const skill = flags.skill ? String(flags.skill) : undefined;
  const region = flags.region ? String(flags.region) : undefined;
  console.log(`[discover] skill=${skill ?? "*"} region=${region ?? "*"} chain=${chain}`);
  console.log("  resolving candidate subnames of " + WARD_ENS_ROOT + " via ENS…");
  const workers = await discoverWorkers({ skill, region, chain });
  if (workers.length === 0) {
    console.log("  no workers matched (names may be unminted on this network)");
    return;
  }
  workers.forEach((w, i) => {
    const tag = i === 0 ? " ← agent dispatches this worker (top reputation)" : "";
    const rep = w.reputation >= 0 ? String(w.reputation) : "n/a (onchain read failed)";
    console.log(`  #${i + 1} ${w.ensName}  rep=${rep}  region=${w.region}  skills=[${w.skills.join(",")}]${tag}`);
  });
}

function indent(text: string): string {
  return text.split("\n").map((l) => `    | ${l}`).join("\n");
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;
  const { positional, flags } = parseFlags(rest);
  const chain = chainFlag(flags);
  if (typeof flags.rpc === "string") {
    process.env[chain === "mainnet" ? "MAINNET_RPC_URL" : "SEPOLIA_RPC_URL"] = flags.rpc;
  }

  switch (command) {
    case "resolve":
      if (!positional[0]) return usage("resolve <name|0xaddress>");
      return cmdResolve(positional[0], chain);
    case "records":
      if (!positional[0]) return usage("records <name>");
      return cmdRecords(positional[0], chain);
    case "verify":
      return cmdVerify(positional[0], chain, flags);
    case "mint-subname":
      if (!positional[0]) return usage("mint-subname <handle> [--dry-run|--execute]");
      return cmdMint(positional[0], flags);
    case "discover":
      return cmdDiscover(flags, chain);
    default:
      return usage();
  }
}

function usage(hint?: string): void {
  if (hint) console.error(`usage: ${hint}`);
  else {
    console.error("WARD ENS CLI commands:");
    console.error("  resolve <name|0xaddr>           forward/reverse/round-trip resolution");
    console.error("  records <name>                  read ENSIP-26 / WARD text records");
    console.error("  verify [name] [--registry 0x.. --agent-id N --registry-chain ID]");
    console.error("  mint-subname <handle> [--dry-run|--execute] [--owner 0x.. --skills a,b --region R]");
    console.error("  discover [--skill router] [--region Greenwich]");
    console.error("  (global: --chain sepolia|mainnet  --rpc <url>)");
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("error:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
