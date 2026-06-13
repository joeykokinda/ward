// Server-only base URL for the live WARD agent on brach (Tailscale Funnel,
// public HTTPS). Used by the /api/live/* route handlers to proxy the agent so
// the browser never hits brach directly (it sends no CORS headers). Set
// WARD_AGENT_URL at deploy to override; the fallback is the live brach funnel.
export const LIVE_AGENT_URL =
  process.env.WARD_AGENT_URL ?? "https://brach.taild3399f.ts.net:8443";
