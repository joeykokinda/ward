import { NextResponse } from "next/server";
import { LIVE_AGENT_URL } from "@/lib/liveAgent";

// Triage a free-text resident report on the live agent (server-side proxy).
// The agent maps the text to a real instrumented device at runtime, injects the
// fault, and its poll loop reacts autonomously: diagnose, escrow, dispatch, settle.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let text = "";
  try {
    const body = await req.json();
    if (typeof body?.text === "string") text = body.text.trim().slice(0, 280);
  } catch {
    // fall through to the empty-text guard
  }
  if (!text) return NextResponse.json({ ok: false, error: "empty report" }, { status: 200 });

  try {
    const r = await fetch(`${LIVE_AGENT_URL}/incident/describe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, autoComplete: true }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return NextResponse.json({ ok: false, reachable: r.status !== 0 }, { status: 200 });
    const data = await r.json();
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json({ ok: false, reachable: false }, { status: 200 });
  }
}
