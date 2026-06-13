// GET /api/ens/<name> — resolve an ENS name LIVE on Sepolia.
//
// Returns the live address + ENSIP-26 / WARD text records + the ENSIP-25
// verification result for the WARD agent. Resolution is performed server-side
// with viem directly against the live Sepolia ENS contracts (no shelling out,
// no hardcoded RESULTS). This is the route the WorkerModal / AgentModal call so
// an ENS judge sees real on-chain records.
//
// Robustness contract (ENS bounty + demo stability): on ANY error or a name
// that doesn't resolve, we still return HTTP 200 with `{ live: false }` so the
// UI can fall back to its labeled fixture records and the cinematic demo never
// breaks if the public RPC is slow. The route is briefly cached (60s) so a judge
// clicking around doesn't hammer the RPC.

import { NextResponse } from "next/server";
import {
  AGENT_CONTEXT_KEY,
  WARD_ENS_ROOT,
  WARD_KEYS,
  agentEndpointKey,
  readTextRecords,
  resolveAddress,
  verifyAgentName,
} from "@/lib/ens/sepolia";

export const runtime = "nodejs";
// Cache the resolved payload for 60s (per-name); errors are returned uncached.
export const revalidate = 60;

type EnsRecords = {
  skills: string[];
  region: string;
  reputationPointer: string;
  role: string;
  agentContext: string;
  webEndpoint: string;
  a2aEndpoint: string;
  mcpEndpoint: string;
};

type LiveEnsResponse = {
  live: true;
  name: string;
  chain: "sepolia";
  address: string | null;
  records: EnsRecords;
  ensip25Verified: boolean;
  ensip25Key: string;
  resolvedAtIso: string;
};

type FallbackResponse = { live: false; name: string };

const TIMEOUT_MS = Number(process.env.ENS_RESOLVE_TIMEOUT_MS ?? "6000");

// Bound the live resolution so a slow public RPC can never hang the request;
// on timeout we fall through to the graceful { live:false } response.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ens-resolve-timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
): Promise<NextResponse<LiveEnsResponse | FallbackResponse>> {
  const { name: rawName } = await context.params;
  const name = decodeURIComponent(rawName ?? "").trim().toLowerCase();

  const fallback = (): NextResponse<FallbackResponse> =>
    NextResponse.json({ live: false, name }, { status: 200 });

  if (!name || !name.endsWith(".eth")) return fallback();

  try {
    const keys = [
      WARD_KEYS.role,
      WARD_KEYS.skills,
      WARD_KEYS.region,
      WARD_KEYS.reputation,
      AGENT_CONTEXT_KEY,
      agentEndpointKey("web"),
      agentEndpointKey("a2a"),
      agentEndpointKey("mcp"),
    ];

    // Resolve address, text records, and (for the agent root) ENSIP-25 in parallel.
    const isAgentRoot = name === WARD_ENS_ROOT.toLowerCase();
    const [address, values, ensip25] = await withTimeout(
      Promise.all([
        resolveAddress(name),
        readTextRecords(name, keys),
        isAgentRoot
          ? verifyAgentName(name)
          : Promise.resolve(null),
      ]),
      TIMEOUT_MS,
    );

    const skillsRaw = values[WARD_KEYS.skills] ?? "";
    const records: EnsRecords = {
      skills: skillsRaw
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
      region: values[WARD_KEYS.region] ?? "",
      reputationPointer: values[WARD_KEYS.reputation] ?? "",
      role: values[WARD_KEYS.role] ?? "",
      agentContext: values[AGENT_CONTEXT_KEY] ?? "",
      webEndpoint: values[agentEndpointKey("web")] ?? "",
      a2aEndpoint: values[agentEndpointKey("a2a")] ?? "",
      mcpEndpoint: values[agentEndpointKey("mcp")] ?? "",
    };

    // Treat the name as "not live" if nothing at all resolved — let the UI fall
    // back rather than render an empty live card.
    const anyData =
      address != null ||
      records.skills.length > 0 ||
      records.region.length > 0 ||
      records.agentContext.length > 0 ||
      records.webEndpoint.length > 0;
    if (!anyData) return fallback();

    const payload: LiveEnsResponse = {
      live: true,
      name,
      chain: "sepolia",
      address,
      records,
      ensip25Verified: ensip25?.verified ?? false,
      ensip25Key: ensip25?.key ?? "",
      resolvedAtIso: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return fallback();
  }
}
