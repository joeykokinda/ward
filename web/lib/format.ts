// Formatting helpers. USDC is 6 decimals everywhere.

const USDC_DECIMALS = 6n;
const USDC_DIVISOR = 1_000_000n;

// "75000000" -> "75.00"
export function formatUsdc(raw: string | bigint): string {
  const value = typeof raw === "bigint" ? raw : BigInt(raw || "0");
  const whole = value / USDC_DIVISOR;
  const frac = value % USDC_DIVISOR;
  const fracStr = frac.toString().padStart(Number(USDC_DECIMALS), "0").slice(0, 2);
  // group thousands in the whole part
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${wholeStr}.${fracStr}`;
}

// "75.00 USDC"
export function formatUsdcLabel(raw: string | bigint): string {
  return `${formatUsdc(raw)} USDC`;
}

export function usdc(amountWhole: number): string {
  return (BigInt(Math.round(amountWhole)) * USDC_DIVISOR).toString();
}

export function addUsdc(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}

export function subUsdc(a: string, b: string): string {
  const r = BigInt(a) - BigInt(b);
  return (r < 0n ? 0n : r).toString();
}

// [HH:MM:SS] for log lines (local time).
export function clock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

export function shortHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function shortAddress(addr: string): string {
  if (addr.length <= 13) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// "2h 14m" / "47s" — uptime + elapsed timers.
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

// elapsed since iso, in seconds, relative to a caller-supplied `now` (ms).
// Pass a tick timestamp so render stays pure.
export function secondsSince(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / 1000;
}

// relative "3m ago" / "2h ago" for the activity feed, relative to `now` (ms).
export function timeAgo(iso: string, now: number): string {
  const sec = secondsSince(iso, now);
  if (sec < 60) return `${Math.floor(Math.max(0, sec))}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

// signal strength bucket from dBm (router). pairs with text, never color-only.
export function signalLabel(dbm: number): string {
  if (dbm >= -55) return "EXCELLENT";
  if (dbm >= -67) return "GOOD";
  if (dbm >= -75) return "FAIR";
  if (dbm >= -85) return "WEAK";
  return "NONE";
}
