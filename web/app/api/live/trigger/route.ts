import { NextResponse } from "next/server";
import { LIVE_AGENT_URL } from "@/lib/liveAgent";

// Trigger a real incident on the live agent (server-side proxy). The agent's
// poll loop reacts autonomously: diagnose, escrow on Arc, dispatch, settle.
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["home-leak", "home-wifi", "home-lock", "home-thermostat"]);

export async function POST(req: Request) {
  let propertyId = "home-leak";
  try {
    const body = await req.json();
    if (body?.propertyId && ALLOWED.has(body.propertyId)) propertyId = body.propertyId;
  } catch {
    // default to the leak
  }
  try {
    const r = await fetch(`${LIVE_AGENT_URL}/incident/simulate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ propertyId, mode: "hard", autoComplete: true }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return NextResponse.json({ ok: false, reachable: r.status !== 0 }, { status: 200 });
    const data = await r.json();
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json({ ok: false, reachable: false }, { status: 200 });
  }
}
