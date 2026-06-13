"use client";

import { Check } from "lucide-react";
import type { NarrativePhase } from "@/lib/data/types";
import { phasesForTrack } from "@/lib/narrative";

// The chunking solution: a bottom-center heads-up display showing which act WARD
// is in, one plain-English line, and the step rail for the current track (the L3
// hire arc, or the shorter L1 self-fix arc). When idle it reads as a calm
// standby. The story is carried here so the floor plan can stay visual.
export function PhaseHUD({ narrative }: { narrative?: NarrativePhase | null }) {
  const active = narrative ?? null;
  const rail = phasesForTrack(active?.track ?? "hire");
  const doneCopy =
    active?.track === "selffix"
      ? "WARD fixed it in software at L1. No human, no escrow, no spend."
      : "WARD fixed it and paid the human, autonomously. The sensor approved the payment, not a person.";
  return (
    <div className="rounded-sm border border-border bg-surface px-5 py-4 card-shadow">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
          <span
            className={
              active
                ? active.done
                  ? "text-success-ink"
                  : active.onChain
                    ? "text-accent-ink"
                    : "text-muted"
                : "text-muted"
            }
          >
            {active ? (active.done ? "Resolved" : `Phase ${active.index} of ${active.total}`) : "Standing by"}
          </span>
          {active && !active.done && <span className="text-faint">· {active.title}</span>}
        </div>

        <p className="mt-2 min-h-[40px] max-w-2xl text-[14px] leading-relaxed text-fg">
          {active
            ? active.done
              ? doneCopy
              : active.caption
            : "All systems nominal. Trigger a fault and watch WARD try the free fix first, then hire a human only if it can't."}
        </p>

        <ol className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {rail.map((p, i) => {
            const pos = i + 1;
            const isDone = active ? active.done || pos < active.index : false;
            const isActive = active ? !active.done && pos === active.index : false;
            return (
              <li
                key={p.id}
                className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  isActive
                    ? "border-accent bg-accent-soft text-accent-ink"
                    : isDone
                      ? "border-border bg-subtle text-success-ink"
                      : "border-border bg-surface text-faint"
                }`}
              >
                {isDone ? (
                  <Check className="h-3 w-3" strokeWidth={2.6} />
                ) : (
                  <span
                    className={`dot h-[6px] w-[6px] ${isActive ? "bg-accent ward-live-dot" : "bg-border-strong"}`}
                    aria-hidden
                  />
                )}
                {p.label}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
