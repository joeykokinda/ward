"use client";

import { useEffect, useRef } from "react";
import {
  Activity as ActivityIcon,
  CheckCircle2,
  CircleDot,
  Link2,
  Lock,
  Search,
  Send,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AgentEvent, LogType } from "@/lib/data/types";
import { clock } from "@/lib/format";
import { isKeyEvent, Panel } from "../primitives";
import { TxLink } from "../links";

const EVENT_ICON: Record<LogType, LucideIcon> = {
  MONITOR: ActivityIcon,
  DIAGNOSE: Search,
  ACTION: Wrench,
  RESULT: CircleDot,
  ESCROW: Lock,
  DISPATCH: Send,
  RESOLVED: CheckCircle2,
};

// Tasteful timeline: muted text by default, accent for the key events
// (escrow / dispatch / resolved). Small flat icons, no per-type rainbow.
export function ReasoningStream({
  events,
  mounted,
}: {
  events: AgentEvent[];
  mounted: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <Panel
      title="Agent reasoning"
      right={<span className="text-[12px] text-muted">{events.length} events</span>}
      className="min-h-[420px]"
      bodyClassName="overflow-hidden"
    >
      <div
        ref={scrollRef}
        className="h-full max-h-[640px] overflow-auto ward-scroll px-4 py-3"
      >
        <ol className="relative">
          {events.map((ev, i) => (
            <TimelineRow
              key={ev.id}
              ev={ev}
              mounted={mounted}
              isLast={i === events.length - 1}
              isFinal={i === events.length - 1}
            />
          ))}
        </ol>
      </div>
    </Panel>
  );
}

function TimelineRow({
  ev,
  mounted,
  isLast,
  isFinal,
}: {
  ev: AgentEvent;
  mounted: boolean;
  isLast: boolean;
  isFinal: boolean;
}) {
  const key = isKeyEvent(ev.type);
  const Icon = EVENT_ICON[ev.type];
  return (
    <li className={`relative flex gap-3 pb-4 ${isFinal ? "ward-row-in" : ""}`}>
      {/* connector line */}
      {!isLast && (
        <span
          className="absolute left-[13px] top-7 bottom-0 w-px bg-border"
          aria-hidden
        />
      )}
      <span
        className={`relative z-10 mt-0.5 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border ${
          key
            ? "border-accent bg-accent-soft text-accent-ink"
            : "border-border bg-surface text-faint"
        }`}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            className={`text-[11px] font-semibold uppercase tracking-wide ${
              key ? "text-accent-ink" : "text-faint"
            }`}
          >
            {ev.type.toLowerCase()}
          </span>
          {/* every event carrying a tx is a real write to Arc — make that
              explicit so a non-crypto judge sees the blockchain at work */}
          {ev.txHash && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-accent-ink">
              <Link2 className="h-2.5 w-2.5" strokeWidth={2.4} />
              On-chain · Arc
            </span>
          )}
          <span className="mono text-[11px] text-faint">
            {mounted ? clock(ev.ts) : "--:--:--"}
          </span>
        </div>
        <p
          className={`mt-0.5 text-[13.5px] leading-relaxed ${
            key ? "font-medium text-fg" : "text-fg-soft"
          }`}
        >
          {ev.message}
        </p>
        {ev.txHash && (
          <div className="mt-1">
            <TxLink hash={ev.txHash} />
          </div>
        )}
      </div>
    </li>
  );
}
