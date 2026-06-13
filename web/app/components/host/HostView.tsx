"use client";

import { useMemo } from "react";
import { Play, RotateCcw } from "lucide-react";
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
    <div className="min-h-0 flex-1 overflow-auto ward-scroll">
      <div className="mx-auto w-full max-w-6xl px-5 py-6">
        {/* page heading + controls */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">
              Fleet operations
            </h1>
            <p className="mt-1 text-[14px] text-muted">
              WARD monitors your properties and dispatches paid repairs autonomously.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-fg-soft transition-colors hover:bg-subtle"
            >
              <RotateCcw className="h-4 w-4 text-muted" strokeWidth={2} />
              Reset
            </button>
            <button
              onClick={onSimulate}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-current" strokeWidth={0} />
              {isRunning ? "Simulating…" : "Simulate router failure"}
            </button>
          </div>
        </div>

        {/* active job — the focal area when a job is live */}
        {snapshot.activeJob && (
          <div className="mt-6">
            <ActiveJobBar
              job={snapshot.activeJob}
              property={activeProperty}
              now={now}
              mounted={mounted}
            />
          </div>
        )}

        {/* primary: reasoning timeline. secondary: fleet + activity. */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
          <ReasoningStream events={snapshot.events} mounted={mounted} />
          <div className="flex flex-col gap-6">
            <FleetGrid properties={snapshot.properties} liveUptime={liveUptime} />
            <ActivityFeed activity={snapshot.activity} now={now} mounted={mounted} />
          </div>
        </div>
      </div>
    </div>
  );
}
