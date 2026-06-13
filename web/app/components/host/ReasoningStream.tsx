"use client";

import { useEffect, useRef } from "react";
import type { AgentEvent } from "@/lib/data/types";
import { clock } from "@/lib/format";
import { LOG_COLOR, Panel } from "../primitives";
import { TxLink } from "../links";

// Terminal-log stream: `[HH:MM:SS]  [TYPE]  message` with per-type colors.
export function ReasoningStream({
  events,
  mounted,
}: {
  events: AgentEvent[];
  mounted: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // auto-scroll to newest line
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <Panel
      title="Agent reasoning stream"
      right={
        <span className="mono text-[11px] text-muted">{events.length} events</span>
      }
      className="h-full"
      bodyClassName="overflow-hidden"
    >
      <div ref={scrollRef} className="h-full overflow-auto ward-scroll px-3 py-2">
        <div className="flex flex-col gap-[3px]">
          {events.map((ev, i) => (
            <LogLine key={ev.id} ev={ev} mounted={mounted} isLast={i === events.length - 1} />
          ))}
        </div>
      </div>
    </Panel>
  );
}

function LogLine({
  ev,
  mounted,
  isLast,
}: {
  ev: AgentEvent;
  mounted: boolean;
  isLast: boolean;
}) {
  const color = LOG_COLOR[ev.type];
  return (
    <div
      className={`mono text-[12.5px] leading-snug ${isLast ? "ward-row-in" : ""}`}
    >
      <span className="text-muted">[{mounted ? clock(ev.ts) : "--:--:--"}]</span>{" "}
      <span className={`${color} font-semibold`}>
        [{ev.type.padEnd(8, " ")}]
      </span>{" "}
      <span className={color}>{ev.message}</span>
      {ev.txHash && (
        <span className="ml-2 inline-flex items-center gap-1">
          <span className="text-muted">↳</span>
          <TxLink hash={ev.txHash} />
        </span>
      )}
    </div>
  );
}
