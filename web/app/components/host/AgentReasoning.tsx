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
import { CRE_WORKFLOW_URL, ENS_ROOT, ensProfileUrl } from "@/lib/config";
import { clock } from "@/lib/format";
import { isKeyEvent, logTone, toneText } from "../primitives";
import { TxLink } from "../links";
import { SponsorBadge } from "./SponsorBadge";

const EVENT_ICON: Record<LogType, LucideIcon> = {
  MONITOR: ActivityIcon,
  DIAGNOSE: Search,
  ACTION: Wrench,
  RESULT: CircleDot,
  ESCROW: Lock,
  DISPATCH: Send,
  RESOLVED: CheckCircle2,
};

// The agent's live thinking. Reads the same event stream the scripted player and
// the live agent feed both produce, so it shows real reasoning in either mode.
// On-chain writes carry an explicit Arc badge + a clickable tx.
export function AgentReasoning({
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
    <section className="flex min-h-0 flex-1 flex-col rounded-sm border border-border bg-surface card-shadow">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <span className="dot bg-success ward-live-dot" aria-hidden />
          Agent reasoning
        </span>
        <span className="text-[11px] text-faint">{events.length} events</span>
      </header>
      <div
        ref={scrollRef}
        className="max-h-[420px] min-h-[260px] flex-1 overflow-auto ward-scroll px-4 py-3"
      >
        <ol className="relative">
          {events.map((ev, i) => (
            <Row key={ev.id} ev={ev} mounted={mounted} isLast={i === events.length - 1} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function Row({
  ev,
  mounted,
  isLast,
}: {
  ev: AgentEvent;
  mounted: boolean;
  isLast: boolean;
}) {
  const key = isKeyEvent(ev.type);
  const tone = logTone(ev.type);
  const Icon = EVENT_ICON[ev.type];
  // Sponsor attribution: surface which sponsor's tech is firing on this line.
  const showEns = /\bENS\b|WorkerRegistry|Ranked .* tech/i.test(ev.message);
  const showCre = /Chainlink CRE|Evaluator/i.test(ev.message);
  return (
    <li className={`relative flex gap-3 pb-4 ${isLast ? "ward-row-in" : ""}`}>
      {!isLast && (
        <span className="absolute left-[13px] top-7 bottom-0 w-px bg-border" aria-hidden />
      )}
      <span
        className={`relative z-10 mt-0.5 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border ${
          key ? `border-current ${toneText(tone)}` : "border-border text-faint"
        }`}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            className={`text-[11px] font-semibold uppercase tracking-wide ${
              key ? toneText(tone) : "text-faint"
            }`}
          >
            {ev.type.toLowerCase()}
          </span>
          {ev.txHash && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-accent/50 bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-accent-ink">
              <Link2 className="h-2.5 w-2.5" strokeWidth={2.4} />
              On-chain · Arc
            </span>
          )}
          <span className="mono text-[11px] text-faint">
            {mounted ? clock(ev.ts) : "--:--:--"}
          </span>
        </div>
        <p
          className={`mt-0.5 text-[13px] leading-relaxed ${
            key ? "font-medium text-fg" : "text-fg-soft"
          }`}
        >
          {ev.message}
        </p>
        {(showEns || showCre || ev.txHash) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {showEns && (
              <SponsorBadge
                sponsor="ENS"
                label="ward-agent.eth subnames · ENSIP-26 records"
                href={ensProfileUrl(ENS_ROOT)}
              />
            )}
            {showCre && (
              <SponsorBadge
                sponsor="Chainlink"
                label="CRE attested fix · WriteReport to Arc"
                href={CRE_WORKFLOW_URL}
              />
            )}
            {ev.txHash && (
              <span className="mono inline-flex items-center gap-1 text-[11px] text-faint">
                Arc
                <TxLink hash={ev.txHash} />
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
