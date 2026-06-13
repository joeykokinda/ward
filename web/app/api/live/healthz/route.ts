import { NextResponse } from "next/server";
import { LIVE_AGENT_URL } from "@/lib/liveAgent";

// Proxy the live agent's health (identity, USDC treasury, policy, mode).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await fetch(`${LIVE_AGENT_URL}/healthz`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return NextResponse.json({ reachable: false });
    const health = await r.json();
    return NextResponse.json({ ...health, reachable: true });
  } catch {
    return NextResponse.json({ reachable: false });
  }
}
