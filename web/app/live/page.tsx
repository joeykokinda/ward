"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  Cpu,
  Droplet,
  Link2,
  Lock,
  Search,
  Send,
  Thermometer,
  WifiOff,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useTick } from "@/lib/useWard";
import { timeAgo } from "@/lib/format";

type LiveEvent = {
  ts: string;
  type: string;
  message: string;
  jobId?: number;
  txHash?: string; // full explorer URL from the agent
  propertyId?: string;
};

type Health = {
  reachable?: boolean;
  agent_address?: string;
  usdc_balance?: string;
  mode?: { chain?: string; evaluator?: string; llm?: string };
};

const DEVICES: { id: string; label: string; Icon: LucideIcon; hero?: boolean }[] = [
  { id: "home-leak", label: "Trigger leak", Icon: Droplet, hero: true },
  { id: "home-wifi", label: "Kill WiFi", Icon: WifiOff },
  { id: "home-lock", label: "Lock failure", Icon: Lock },
  { id: "home-thermostat", label: "HVAC fault", Icon: Thermometer },
];

const ICON: Record<string, LucideIcon> = {
  MONITOR: ActivityIcon,
  DIAGNOSE: Search,
  ACTION: Wrench,
  RESULT: CircleDot,
  ESCROW: Lock,
  DISPATCH: Send,
  RESOLVED: CheckCircle2,
};

function tone(type: string): string {
  if (type === "RESOLVED") return "text-success-ink";
  if (type === "ESCROW" || type === "DISPATCH") return "text-accent-ink";
  if (type === "RESULT") return "text-fg";
  return "text-faint";
}

// brach emits the explorer URL with a bare 64-hex hash (no 0x); arcscan returns
// 422 without the prefix, so normalize it.
function normalizeTxUrl(url: string): string {
  return url.replace(/\/tx\/(?!0x)([0-9a-fA-F]{64})\b/, "/tx/0x$1");
}

function shortHashFromUrl(url: string): string {
  const h = normalizeTxUrl(url).split("/").pop() ?? url;
  return h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h;
}

export default function LivePage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [health, setHealth] = useState<Health>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const now = useTick(1000);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const [e, h] = await Promise.all([
          fetch("/api/live/events?limit=80", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/live/healthz", { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (!alive) return;
        if (Array.isArray(e.events)) setEvents(e.events);
        setHealth(h);
      } catch {
        // ignore a dropped poll
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const trigger = async (propertyId: string) => {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/live/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId }),
      }).then((res) => res.json());
      setNote(
        r.ok
          ? "Incident injected on Arc. Watch the agent react below, about 10 seconds end to end."
          : "Could not reach the live agent. It may be offline right now.",
      );
    } catch {
      setNote("Could not reach the live agent.");
    }
    setBusy(false);
  };

  const reachable = health.reachable;
  // de-noise: hide the repetitive fleet-poll heartbeat, keep the real decisions
  const feed = [...events]
    .filter((e) => !(e.type === "MONITOR" && /Polled fleet/i.test(e.message)))
    .reverse();

  return (
    <main className="min-h-screen bg-bg text-fg">
      <nav className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3">
        <div className="flex items-center gap-4">
          <span className="text-[16px] font-semibold tracking-tight text-fg">WARD</span>
          <span className="flex items-center gap-2 text-[12px]">
            <span
              className={`dot ${reachable ? "bg-success ward-live-dot" : "bg-danger"}`}
              aria-hidden
            />
            <span className={reachable ? "text-success-ink" : "text-danger"}>
              {reachable ? "LIVE · real agent on Arc testnet" : "agent offline"}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-[13px]">
          <Link href="/demo" className="text-muted transition-colors hover:text-fg">
            Scripted demo
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Home
          </Link>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-4xl px-5 py-7">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Live agent
        </div>
        <h1 className="mt-1.5 text-[24px] font-semibold tracking-tight text-fg">
          This is the real WARD agent, running on Arc.
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">
          Not a script. Click a fault below and the real agent reacts on its own loop:
          it diagnoses with Claude, tries the free fix, opens and funds a real USDC
          escrow on Arc, dispatches a worker, and the Chainlink CRE evaluator releases
          payment when telemetry attests the fix. About 10 seconds end to end. Amounts
          are faucet-bounded (1 USDC), and every transaction below is real and clickable.
        </p>

        {/* agent identity + treasury */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            Icon={Cpu}
            label="Agent"
            value={health.agent_address ? `${health.agent_address.slice(0, 6)}…${health.agent_address.slice(-4)}` : "ward-agent.eth"}
          />
          <Stat
            Icon={Link2}
            label="Treasury (live)"
            value={health.usdc_balance ? `${Number(health.usdc_balance).toFixed(2)} USDC` : "—"}
          />
          <Stat
            Icon={CheckCircle2}
            label="Evaluator"
            value={health.mode?.evaluator === "ready" ? "CRE ready" : reachable ? "starting" : "offline"}
          />
        </div>

        {/* trigger controls */}
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-sm border border-border bg-surface px-3 py-3 card-shadow">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Trigger a real incident
          </span>
          {DEVICES.map((d) => (
            <button
              key={d.id}
              onClick={() => trigger(d.id)}
              disabled={busy || !reachable}
              className={`inline-flex items-center gap-2 rounded-sm px-3 py-2 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                d.hero
                  ? "bg-accent text-[#0a0a0f] hover:bg-accent-hover"
                  : "border border-border bg-subtle text-fg-soft hover:border-border-strong hover:bg-surface"
              }`}
            >
              <d.Icon className="h-4 w-4" strokeWidth={2} />
              {d.label}
            </button>
          ))}
          {busy && <span className="text-[12px] text-muted">injecting…</span>}
        </div>
        {note && <p className="mt-2 text-[12px] text-accent-ink">{note}</p>}

        {/* live reasoning feed */}
        <div className="mt-5 rounded-sm border border-border bg-surface card-shadow">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <span className="dot bg-success ward-live-dot" aria-hidden />
              Agent reasoning (live)
            </span>
            <span className="text-[11px] text-faint">{feed.length} events</span>
          </div>
          <ol className="max-h-[460px] divide-y divide-border overflow-auto ward-scroll">
            {feed.length === 0 && (
              <li className="px-4 py-8 text-center text-[13px] text-faint">
                {reachable
                  ? "Agent is monitoring. Trigger a fault above to see it react."
                  : "Waiting for the live agent…"}
              </li>
            )}
            {feed.map((e, i) => {
              const Icon = ICON[e.type] ?? CircleDot;
              const t = tone(e.type);
              return (
                <li key={`${e.ts}-${i}`} className="flex gap-3 px-4 py-2.5">
                  <span className={`mt-0.5 flex-none ${t}`}>
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className={`text-[11px] font-semibold uppercase tracking-wide ${t}`}>
                        {e.type.toLowerCase()}
                      </span>
                      {e.propertyId && (
                        <span className="mono text-[10.5px] text-faint">{e.propertyId}</span>
                      )}
                      <span className="text-[11px] text-faint">
                        {now ? timeAgo(e.ts, now) : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-fg-soft">{e.message}</p>
                    {e.txHash && (
                      <a
                        href={normalizeTxUrl(e.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        title="Verified on arcscan · click to open"
                        className="mono mt-1 inline-flex items-center gap-1 rounded-sm border border-accent/50 bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-accent-ink transition-colors hover:bg-surface"
                      >
                        <Link2 className="h-2.5 w-2.5" strokeWidth={2.4} />
                        On-chain · Arc · {shortHashFromUrl(e.txHash)}
                        <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={2.4} />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="mt-4 text-center text-[11px] text-faint">
          Real Claude reasoning · real USDC escrow + settlement on Arc · the scripted{" "}
          <Link href="/demo" className="text-muted underline underline-offset-2 hover:text-fg">
            /demo
          </Link>{" "}
          is the narrated walkthrough of this same flow.
        </p>
      </div>
    </main>
  );
}

function Stat({ Icon, label, value }: { Icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-sm border border-border bg-surface px-4 py-3 card-shadow">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-sm bg-subtle text-muted">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="text-[10.5px] font-medium uppercase tracking-wide text-muted">{label}</div>
        <div className="mono mt-0.5 truncate text-[13px] font-semibold text-fg">{value}</div>
      </div>
    </div>
  );
}
