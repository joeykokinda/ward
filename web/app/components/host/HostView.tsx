"use client";

import { useMemo } from "react";
import type { WardSnapshot } from "@/lib/data/types";
import { ActiveJobBar } from "./ActiveJobBar";
import { ActivityFeed } from "./ActivityFeed";
import { FleetGrid } from "./FleetGrid";
import { ReasoningStream } from "./ReasoningStream";

export function HostView({
  snapshot,
  now,
  mounted,
  isRunning,
  onSimulate,
  onReset,
}: {
  snapshot: WardSnapshot;
  now: number;
  mounted: boolean;
  isRunning: boolean;
  onSimulate: () => void;
  onReset: () => void;
}) {
  // live uptime: advance per second from the last device snapshot. `now` is a
  // tick timestamp from useTick (0 before mount), so render stays pure.
  const liveUptime = useMemo(() => {
    const out: Record<string, number> = {};
    const reference = now || 0;
    for (const p of snapshot.properties) {
      if (!p.device.online) {
        out[p.id] = 0;
        continue;
      }
      const extra = reference
        ? Math.floor((reference - new Date(p.device.lastChangedIso).getTime()) / 1000)
        : 0;
      out[p.id] = p.device.uptimeSec + Math.max(0, extra);
    }
    return out;
  }, [snapshot.properties, now]);

  const activeProperty = snapshot.activeJob
    ? snapshot.properties.find((p) => p.id === snapshot.activeJob!.propertyId)
    : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      {/* control row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onSimulate}
            disabled={isRunning}
            className="border border-red/60 bg-red/10 px-3 py-2 rounded-[4px] text-red mono text-[12px] font-semibold tracking-wide hover:bg-red/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ▶ SIMULATE ROUTER FAILURE
          </button>
          <span className="mono text-[11px] text-muted">
            target: Greenwich Cottage (prop-2)
          </span>
        </div>
        <button
          onClick={onReset}
          className="border border-border bg-bg px-3 py-2 rounded-[4px] text-text mono text-[12px] font-semibold tracking-wide hover:border-muted"
        >
          ⟲ RESET
        </button>
      </div>

      {/* three-column grid */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.5fr)_minmax(280px,1fr)]">
        <FleetGrid properties={snapshot.properties} liveUptime={liveUptime} />
        <ReasoningStream events={snapshot.events} mounted={mounted} />
        <ActivityFeed activity={snapshot.activity} now={now} mounted={mounted} />
      </div>

      {/* bottom active-job bar — only when a job is live */}
      {snapshot.activeJob && (
        <ActiveJobBar
          job={snapshot.activeJob}
          property={activeProperty}
          now={now}
          mounted={mounted}
        />
      )}
    </div>
  );
}
