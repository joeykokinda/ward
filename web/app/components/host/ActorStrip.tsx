"use client";

import { Cpu, Link2, Wrench, type LucideIcon } from "lucide-react";
import type { Job, NarrativePhaseId, WardSnapshot } from "@/lib/data/types";
import { formatUsdc } from "@/lib/format";
import { Dot, toneText, type Tone } from "../primitives";

// The three actors, visibly syncing with the phase HUD: the agent that decides
// and pays, the human who does the physical fix, and the chain where the money
// lives. Each row's state is derived from the same narrative phase.
export function ActorStrip({ snapshot }: { snapshot: WardSnapshot }) {
  const phase: NarrativePhaseId | "idle" = snapshot.narrative?.id ?? "idle";
  const done = snapshot.narrative?.done ?? false;
  // The live job once the escrow exists. After completion activeJob clears, so
  // in the resolved state fall back to the just-settled job (to keep showing who
  // got paid). Do NOT fall back mid-incident: before the escrow is funded there
  // is no job yet, and pulling a historical job would show the wrong worker.
  const job = snapshot.activeJob ?? (done ? latestCompleted(snapshot.jobs) : undefined);
  const amount = job ? `${formatUsdc(job.amount)} USDC` : null;
  const workerEns = job?.worker ?? null;
  const idleish = phase === "idle" || phase === "detect" || phase === "diagnose";

  const rows: ActorRow[] = [
    { Icon: Cpu, role: "Agent", name: snapshot.agent.ensName, ...agentState(phase, done) },
    {
      Icon: Wrench,
      role: "Human",
      name: workerEns ?? (idleish ? "no one hired" : "selecting"),
      ...humanState(phase, done, workerEns),
    },
    { Icon: Link2, role: "Arc chain", name: "Arc testnet", ...chainState(phase, done, amount) },
  ];

  return (
    <div className="rounded-sm border border-border bg-surface card-shadow">
      <div className="border-b border-border px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Actors</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.role} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-sm bg-subtle text-muted">
              <row.Icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-semibold text-fg">{row.role}</span>
                <span className="mono truncate text-[11px] text-faint">{row.name}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <Dot tone={row.tone} pulse={row.tone === "accent"} />
                <span className={`text-[12px] font-medium ${toneText(row.tone)}`}>{row.state}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type ActorRow = { Icon: LucideIcon; role: string; name: string; state: string; tone: Tone };

// Most recently settled job, so the resolved state keeps showing who got paid.
function latestCompleted(jobs: Job[]): Job | undefined {
  return [...jobs]
    .filter((j) => j.state === "Completed")
    .sort(
      (a, b) =>
        new Date(b.settledAtIso ?? b.createdAtIso).getTime() -
        new Date(a.settledAtIso ?? a.createdAtIso).getTime(),
    )[0];
}

function agentState(phase: NarrativePhaseId | "idle", done: boolean): { state: string; tone: Tone } {
  switch (phase) {
    case "detect":
      return { state: "fault detected", tone: "warn" };
    case "diagnose":
      return { state: "diagnosing", tone: "warn" };
    case "hire":
      return { state: "hiring via ENS", tone: "accent" };
    case "repair":
      return { state: "monitoring repair", tone: "accent" };
    case "verify":
      return done ? { state: "resolved", tone: "success" } : { state: "verifying via CRE", tone: "accent" };
    default:
      return { state: "watching the home", tone: "muted" };
  }
}

function humanState(
  phase: NarrativePhaseId | "idle",
  done: boolean,
  workerEns: string | null,
): { state: string; tone: Tone } {
  switch (phase) {
    case "hire":
      return workerEns
        ? { state: "selected", tone: "accent" }
        : { state: "selecting via ENS", tone: "accent" };
    case "repair":
      return { state: "on site", tone: "accent" };
    case "verify":
      return done ? { state: "paid", tone: "success" } : { state: "finishing up", tone: "accent" };
    default:
      return { state: "on standby", tone: "muted" };
  }
}

function chainState(
  phase: NarrativePhaseId | "idle",
  done: boolean,
  amount: string | null,
): { state: string; tone: Tone } {
  switch (phase) {
    case "hire":
      return amount
        ? { state: `escrow locked: ${amount}`, tone: "accent" }
        : { state: "locking escrow", tone: "accent" };
    case "repair":
      return { state: amount ? `holding ${amount}` : "escrow held", tone: "accent" };
    case "verify":
      return done
        ? { state: amount ? `released: ${amount}` : "released", tone: "success" }
        : { state: "releasing escrow", tone: "accent" };
    default:
      return { state: "no open escrow", tone: "muted" };
  }
}
