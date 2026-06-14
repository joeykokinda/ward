"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronsRight,
  CircleDot,
  Copy,
  Cpu,
  Droplet,
  Lock,
  Pause,
  Play,
  Search,
  Send,
  ShieldCheck,
  Thermometer,
  Wallet,
  WifiOff,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useTick } from "@/lib/useWard";
import { formatDuration, secondsSince, shortAddress, timeAgo } from "@/lib/format";
import { ARC, arcAddressUrl, normalizeArcTxUrl } from "@/lib/arc";

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

// How long each new reasoning line dwells before the next is revealed. The real
// agent settles in ~10s; we buffer its events and play them back a touch slower
// so a judge can read every line and click the on-chain links as they appear.
const PACE_MS = 1700;

const DEVICES: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "home-leak", label: "Trigger leak", Icon: Droplet },
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

// detect → diagnose → hire → repair → verify (mirrors lib/narrative.ts so /live
// and /demo tell the identical 5-phase story).
const PHASES: { label: string; Icon: LucideIcon }[] = [
  { label: "Detect", Icon: ActivityIcon },
  { label: "Diagnose", Icon: Search },
  { label: "Hire", Icon: Lock },
  { label: "Repair", Icon: Wrench },
  { label: "Verify", Icon: CheckCircle2 },
];

function tone(type: string): string {
  if (type === "RESOLVED") return "text-success-ink";
  if (type === "ESCROW" || type === "DISPATCH") return "text-accent-ink";
  if (type === "RESULT") return "text-fg";
  return "text-faint";
}

const isHeartbeat = (e: LiveEvent) => e.type === "MONITOR" && /Polled fleet/i.test(e.message);
const isFaultDetected = (e: LiveEvent) =>
  e.type === "MONITOR" && /fault detected/i.test(e.message);

// Which of the 5 phases an event belongs to (-1 = not part of an incident).
function phaseOf(e: LiveEvent): number {
  const m = e.message.toLowerCase();
  if (e.type === "RESOLVED") return 4;
  if (e.type === "RESULT") return /released|settl|recover|attest/.test(m) ? 4 : -1;
  if (e.type === "DISPATCH") return 3;
  if (e.type === "ESCROW") return 2;
  if (e.type === "DIAGNOSE" || e.type === "ACTION") return 1;
  if (isFaultDetected(e)) return 0;
  return -1;
}

function shortHashFromUrl(url: string): string {
  const h = normalizeArcTxUrl(url).split("/").pop() ?? url;
  return h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h;
}

export default function LivePage() {
  const [allEvents, setAllEvents] = useState<LiveEvent[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [health, setHealth] = useState<Health>({});
  const [monitored, setMonitored] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const now = useTick(1000);

  const allRef = useRef<LiveEvent[]>([]);
  const pausedRef = useRef(false);
  const seeded = useRef(false);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Poll the live agent: keep the full (de-noised) event buffer + health.
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const [e, h] = await Promise.all([
          fetch("/api/live/events?limit=120", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/live/healthz", { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (!alive) return;
        if (Array.isArray(e.events)) {
          const rows = e.events as LiveEvent[];
          const lastBeat = [...rows].reverse().find(isHeartbeat);
          if (lastBeat) {
            const mm = lastBeat.message.match(/Polled fleet:\s*(\d+)\s*devices/i);
            if (mm) setMonitored(Number(mm[1]));
          }
          const filtered = rows.filter((ev) => !isHeartbeat(ev)); // chronological
          allRef.current = filtered;
          setAllEvents(filtered);
          // First successful load: surface the whole backlog at once, then pace
          // only events that arrive afterwards (an incident the judge triggers).
          if (!seeded.current && filtered.length) {
            seeded.current = true;
            setRevealed(filtered.length);
          }
        }
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

  // Paced reveal: tick one buffered event into view at a readable cadence.
  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setRevealed((r) => Math.min(r + 1, allRef.current.length));
    }, PACE_MS);
    return () => clearInterval(id);
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
          ? "Incident injected on Arc. Watch the agent work through it below, line by line."
          : "Could not reach the live agent. It may be offline right now.",
      );
    } catch {
      setNote("Could not reach the live agent.");
    }
    setBusy(false);
  };

  const reachable = health.reachable;
  const pending = Math.max(0, allEvents.length - revealed);
  const shown = useMemo(() => allEvents.slice(0, revealed), [allEvents, revealed]);

  // Derive the current incident (everything since the last "fault detected"),
  // the phase the agent has reached, and the on-chain job taking shape.
  const incident = useMemo(() => deriveIncident(shown), [shown]);
  const feed = useMemo(() => [...shown].reverse(), [shown]); // newest first

  return (
    <main className="min-h-screen bg-bg text-fg">
      <nav className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-[16px] font-semibold tracking-tight text-fg transition-colors hover:text-accent-ink"
            >
              WARD
            </Link>
            {!reachable && (
              <span className="flex items-center gap-2 text-[12px]">
                <span className="dot bg-danger" aria-hidden />
                <span className="text-danger">agent offline</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-5 text-[13px]">
            <Link href="/workers" className="text-muted transition-colors hover:text-fg">
              Workers
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-6xl px-5 py-7">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">Real agent · Arc testnet</div>
        <h1 className="mt-1.5 text-[24px] font-semibold tracking-tight text-fg">
          This is the real WARD agent, running on Arc.
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-muted">
          Not a script. Click a fault and the real agent reacts on its own loop: it diagnoses with
          Claude, tries the free fix, opens and funds a real USDC escrow on Arc, dispatches a worker,
          and the Chainlink CRE evaluator releases payment when telemetry attests the fix. Every line
          below is played back as it happens; every transaction and contract is real and clickable.
        </p>

        {/* trigger controls */}
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-sm border border-border bg-surface px-3 py-3 card-shadow">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-accent-ink">
            Trigger a real incident
          </span>
          {DEVICES.map((d) => (
            <button
              key={d.id}
              onClick={() => trigger(d.id)}
              disabled={busy || !reachable}
              className="inline-flex items-center gap-2 rounded-sm border border-border bg-subtle px-3 py-2 text-[12px] font-semibold text-fg-soft transition-colors hover:border-border-strong hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              <d.Icon className="h-4 w-4" strokeWidth={2} />
              {d.label}
            </button>
          ))}
          {busy && <span className="text-[12px] text-muted">injecting…</span>}
        </div>
        {note && <p className="mt-2 text-[12px] text-accent-ink">{note}</p>}

        {/* phase stepper */}
        <PhaseStepper incident={incident} monitored={monitored} reachable={!!reachable} />

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* LEFT: active job + paced reasoning feed */}
          <div className="lg:col-span-2">
            <ActiveJobCard incident={incident} now={now} />

            <div className="mt-5 rounded-sm border border-border bg-surface card-shadow">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <span className="dot bg-accent ward-live-dot" aria-hidden />
                  Agent reasoning
                </span>
                <div className="flex items-center gap-2">
                  {pending > 0 && (
                    <span className="mono text-[10.5px] text-accent-ink">+{pending} queued</span>
                  )}
                  <button
                    onClick={() => setPaused((p) => !p)}
                    className="inline-flex items-center gap-1 rounded-sm border border-border bg-subtle px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-fg-soft transition-colors hover:border-border-strong"
                    title={paused ? "Resume playback" : "Pause so you can click a link"}
                  >
                    {paused ? <Play className="h-3 w-3" strokeWidth={2.2} /> : <Pause className="h-3 w-3" strokeWidth={2.2} />}
                    {paused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={() => setRevealed(allEvents.length)}
                    disabled={pending === 0}
                    className="inline-flex items-center gap-1 rounded-sm border border-border bg-subtle px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-fg-soft transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
                    title="Skip the pacing and jump to the latest event"
                  >
                    <ChevronsRight className="h-3 w-3" strokeWidth={2.2} />
                    Jump to live
                  </button>
                </div>
              </div>
              <ol className="max-h-[520px] divide-y divide-border overflow-auto ward-scroll">
                {feed.length === 0 && (
                  <li className="px-4 py-10 text-center text-[13px] text-faint">
                    {reachable
                      ? "Agent is monitoring. Trigger a fault above to watch it react, line by line."
                      : "Waiting for the live agent…"}
                  </li>
                )}
                {feed.map((e, i) => {
                  const Icon = ICON[e.type] ?? CircleDot;
                  const t = tone(e.type);
                  const latest = i === 0 && pending > 0; // freshest revealed line while playing
                  return (
                    <li
                      key={`${e.ts}-${i}`}
                      className={`ward-row-in flex gap-3 px-4 py-2.5 ${latest ? "bg-accent-soft" : ""}`}
                    >
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
                          {typeof e.jobId === "number" && e.jobId >= 0 && (
                            <span className="mono text-[10.5px] text-faint">job #{e.jobId}</span>
                          )}
                          <span className="text-[11px] text-faint">{now ? timeAgo(e.ts, now) : ""}</span>
                        </div>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-fg-soft">{e.message}</p>
                        {e.txHash && (
                          <a
                            href={normalizeArcTxUrl(e.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            title="Verified on arcscan · click to open the transaction"
                            className="mono mt-1.5 inline-flex items-center gap-1 rounded-sm border border-accent/50 bg-accent-soft px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-accent-ink transition-colors hover:bg-surface"
                          >
                            <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
                            View on Arc · {shortHashFromUrl(e.txHash)}
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* RIGHT: identity + deployed contracts */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-5 space-y-3">
              <Stat
                Icon={Cpu}
                label="Agent"
                value={
                  health.agent_address
                    ? `${health.agent_address.slice(0, 6)}…${health.agent_address.slice(-4)}`
                    : "ward-agent.eth"
                }
                href={arcAddressUrl(health.agent_address ?? ARC.agent)}
              />
              <Stat
                Icon={Wallet}
                label="Treasury"
                value={health.usdc_balance ? `${Number(health.usdc_balance).toFixed(2)} USDC` : "—"}
              />
              <Stat
                Icon={ShieldCheck}
                label="Evaluator (Chainlink CRE)"
                value={
                  health.mode?.evaluator === "ready"
                    ? "ready"
                    : reachable
                      ? "starting"
                      : "offline"
                }
                href={arcAddressUrl(ARC.evaluator)}
              />

              <div className="rounded-sm border border-border bg-surface card-shadow">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-ink">
                    Deployed on Arc
                  </span>
                  <a
                    href={`${ARC.explorer}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mono text-[10.5px] text-faint transition-colors hover:text-fg"
                  >
                    chainId {ARC.chainId} ↗
                  </a>
                </div>
                <div className="divide-y divide-border">
                  <ContractRow
                    label="WardEscrow"
                    sub="ERC-8183 · holds USDC, releases on attestation"
                    address={ARC.escrow}
                  />
                  <ContractRow
                    label="WorkerRegistry"
                    sub="On-chain worker identity + reputation"
                    address={ARC.registry}
                  />
                  <ContractRow
                    label="USDC (native)"
                    sub="Settlement asset + gas on Arc"
                    address={ARC.usdc}
                  />
                  <ContractRow
                    label="Evaluator EOA"
                    sub="CRE oracle · signs complete()"
                    address={ARC.evaluator}
                  />
                </div>
                <p className="border-t border-border px-4 py-2.5 text-[10.5px] leading-relaxed text-faint">
                  Both contracts are source-verified on Blockscout. Every tap opens the live
                  explorer.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-faint">
          Real Claude reasoning · real USDC escrow + settlement on Arc · the{" "}
          <Link href="/#see-it-run" className="text-muted underline underline-offset-2 hover:text-fg">
            homepage walkthrough
          </Link>{" "}
          is the narrated version of this same flow.
        </p>
      </div>
    </main>
  );
}

// ── derived incident state ──────────────────────────────────────────────────

type Incident = {
  active: boolean;
  startTs: string | null;
  phase: number; // 0..4, highest phase reached this incident
  resolved: boolean;
  jobId: number | null;
  amount: string | null; // "1.00"
  worker: string | null; // ENS
  fundTx: string | null; // explorer URL
  completeTx: string | null; // explorer URL
  state: "Opening" | "Funded" | "Submitted" | "Completed";
};

function deriveIncident(shown: LiveEvent[]): Incident {
  const empty: Incident = {
    active: false,
    startTs: null,
    phase: -1,
    resolved: false,
    jobId: null,
    amount: null,
    worker: null,
    fundTx: null,
    completeTx: null,
    state: "Opening",
  };
  // Last "fault detected" marks the start of the current incident.
  let start = -1;
  for (let i = shown.length - 1; i >= 0; i--) {
    if (isFaultDetected(shown[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return empty;

  const slice = shown.slice(start);
  let phase = 0;
  let resolved = false;
  let jobId: number | null = null;
  let amount: string | null = null;
  let worker: string | null = null;
  let fundTx: string | null = null;
  let completeTx: string | null = null;
  let submitted = false;

  for (const e of slice) {
    const p = phaseOf(e);
    if (p > phase) phase = p;
    if (e.type === "RESOLVED") resolved = true;
    if (typeof e.jobId === "number" && e.jobId >= 0) jobId = e.jobId;

    const m = e.message;
    if (!worker) {
      const w = m.match(/worker\s+([a-z0-9.-]+\.eth)/i);
      if (w) worker = w[1];
    }
    if (e.type === "ESCROW" && /funded into wardescrow/i.test(m)) {
      const a = m.match(/([\d.]+)\s*USDC funded/i);
      if (a) amount = Number(a[1]).toFixed(2);
      if (e.txHash) fundTx = e.txHash;
    }
    if (/submitted the repair deliverable/i.test(m)) submitted = true;
    if (e.type === "RESULT" && /released/i.test(m)) {
      const a = m.match(/released\s+([\d.]+)\s*USDC/i);
      if (a && !amount) amount = Number(a[1]).toFixed(2);
      if (e.txHash) completeTx = e.txHash;
    }
  }

  const state: Incident["state"] =
    resolved || completeTx ? "Completed" : submitted ? "Submitted" : fundTx ? "Funded" : "Opening";

  return {
    active: true,
    startTs: slice[0]?.ts ?? null,
    phase,
    resolved,
    jobId,
    amount,
    worker,
    fundTx,
    completeTx,
    state,
  };
}

// ── components ──────────────────────────────────────────────────────────────

function PhaseStepper({
  incident,
  monitored,
  reachable,
}: {
  incident: Incident;
  monitored: number | null;
  reachable: boolean;
}) {
  const active = incident.active;
  const done = incident.resolved;
  return (
    <div className="mt-5 rounded-sm border border-border bg-surface px-4 py-3.5 card-shadow">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Incident lifecycle
        </span>
        <span className="text-[11px] text-faint">
          {!active
            ? reachable
              ? `Monitoring${monitored != null ? ` ${monitored} devices` : ""} · idle`
              : "offline"
            : done
              ? "Settled · incident closed"
              : `In progress · ${PHASES[Math.max(0, incident.phase)].label}`}
        </span>
      </div>
      <div className="flex items-center">
        {PHASES.map((ph, i) => {
          const state: "done" | "active" | "pending" = done
            ? "done"
            : active && i < incident.phase
              ? "done"
              : active && i === incident.phase
                ? "active"
                : "pending";
          const circle =
            state === "done"
              ? "border-success bg-success-soft text-success-ink"
              : state === "active"
                ? "border-accent bg-accent-soft text-accent-ink ward-active"
                : "border-border bg-subtle text-faint";
          const StepIcon = state === "done" ? Check : ph.Icon;
          return (
            <div key={ph.label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-8 w-8 flex-none items-center justify-center rounded-full border ${circle}`}
                >
                  <StepIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
                <span
                  className={`text-[10.5px] font-semibold uppercase tracking-wide ${
                    state === "pending" ? "text-faint" : state === "active" ? "text-accent-ink" : "text-fg-soft"
                  }`}
                >
                  {ph.label}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <span
                  className={`mx-1.5 mb-5 h-px flex-1 ${
                    done || (active && i < incident.phase) ? "bg-success" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActiveJobCard({ incident, now }: { incident: Incident; now: number }) {
  if (!incident.active) {
    return (
      <div className="rounded-sm border border-dashed border-border bg-surface px-4 py-5 text-center text-[12px] text-faint card-shadow">
        No active job. Trigger a fault above — when the agent escalates to a human, the on-chain
        escrow appears here in real time.
      </div>
    );
  }
  const elapsed = incident.startTs && now ? formatDuration(secondsSince(incident.startTs, now)) : "—";
  const badge =
    incident.state === "Completed"
      ? "border-success bg-success-soft text-success-ink"
      : incident.state === "Opening"
        ? "border-border bg-subtle text-muted"
        : "border-accent/50 bg-accent-soft text-accent-ink";

  return (
    <div className="rounded-sm border border-border bg-surface card-shadow">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <Lock className="h-3.5 w-3.5" strokeWidth={2} />
          On-chain job {incident.jobId != null ? `#${incident.jobId}` : ""}
        </span>
        <span className={`mono rounded-sm border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${badge}`}>
          {incident.state}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5 sm:grid-cols-4">
        <Field label="Amount" value={incident.amount ? `${incident.amount} USDC` : "—"} />
        <Field label="Worker" value={incident.worker ?? "selecting…"} />
        <Field label="Elapsed" value={elapsed} />
        <Field label="Phase" value={incident.resolved ? "settled" : PHASES[Math.max(0, incident.phase)].label.toLowerCase()} />
      </div>
      {(incident.fundTx || incident.completeTx) && (
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          {incident.fundTx && (
            <TxLink label="Escrow funded" url={incident.fundTx} />
          )}
          {incident.completeTx && (
            <TxLink label="Payment released" url={incident.completeTx} done />
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className="mono mt-0.5 truncate text-[13px] font-semibold text-fg" title={value}>
        {value}
      </div>
    </div>
  );
}

function TxLink({ label, url, done }: { label: string; url: string; done?: boolean }) {
  return (
    <a
      href={normalizeArcTxUrl(url)}
      target="_blank"
      rel="noreferrer"
      className={`mono inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
        done
          ? "border-success/50 bg-success-soft text-success-ink hover:bg-surface"
          : "border-accent/50 bg-accent-soft text-accent-ink hover:bg-surface"
      }`}
    >
      {done ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} /> : <Lock className="h-3.5 w-3.5" strokeWidth={2.2} />}
      {label}
      <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
    </a>
  );
}

function Stat({ Icon, label, value, href }: { Icon: LucideIcon; label: string; value: string; href?: string }) {
  const body = (
    <div className="flex items-center gap-3 rounded-sm border border-border bg-surface px-4 py-3 card-shadow transition-colors hover:border-border-strong">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-sm bg-accent-soft text-accent-ink">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-medium uppercase tracking-wide text-muted">{label}</div>
        <div className="mono mt-0.5 truncate text-[13px] font-semibold text-fg">{value}</div>
      </div>
      {href && <ArrowUpRight className="h-3.5 w-3.5 flex-none text-faint" strokeWidth={2} />}
    </div>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="block">
      {body}
    </a>
  ) : (
    body
  );
}

function ContractRow({ label, sub, address }: { label: string; sub: string; address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard blocked; the explorer link still works
    }
  };
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-fg-soft">{label}</div>
        <div className="text-[10.5px] leading-snug text-faint">{sub}</div>
        <div className="mono mt-0.5 text-[10.5px] text-muted">{shortAddress(address)}</div>
      </div>
      <button
        onClick={copy}
        title="Copy address"
        className="flex-none rounded-sm border border-border bg-subtle p-1.5 text-faint transition-colors hover:border-border-strong hover:text-fg"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success-ink" strokeWidth={2.2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2} />}
      </button>
      <a
        href={arcAddressUrl(address)}
        target="_blank"
        rel="noreferrer"
        title="Open on arcscan"
        className="flex-none rounded-sm border border-border bg-subtle p-1.5 text-faint transition-colors hover:border-border-strong hover:text-accent-ink"
      >
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
      </a>
    </div>
  );
}
