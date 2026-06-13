import { NextResponse } from "next/server";
import { LIVE_AGENT_URL } from "@/lib/liveAgent";

// Proxy the live agent's recent reasoning events (server-side, no CORS).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = new URL(req.url).searchParams.get("limit") ?? "60";
  try {
    const r = await fetch(
      `${LIVE_AGENT_URL}/events/recent?limit=${encodeURIComponent(limit)}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) return NextResponse.json({ events: [], reachable: false });
    const events = await r.json();
    return NextResponse.json({ events, reachable: true });
  } catch {
    return NextResponse.json({ events: [], reachable: false });
  }
}
