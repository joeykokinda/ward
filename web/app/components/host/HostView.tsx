"use client";

import { useMemo, useState } from "react";
import { Droplet, Play, RotateCcw } from "lucide-react";
import type { Worker, WardSnapshot } from "@/lib/data/types";
import { Modal } from "../Modal";
import { ActiveJobBar } from "./ActiveJobBar";
import { ActivityFeed } from "./ActivityFeed";
import { DeviceModal } from "./DeviceModal";
import { FloorPlan } from "./FloorPlan";
import { NarrativeBar } from "./NarrativeBar";
import { ReasoningStream } from "./ReasoningStream";
import { WorkerModal } from "./WorkerModal";

export function HostView({
  snapshot,
  now,
  mounted,
  isRunning,
  onSimulate,
  onKillDevice,
  onReset,
}: {
  snapshot: WardSnapshot;
  now: number;
  mounted: boolean;
  isRunning: boolean;
  onSimulate: () => void;
  onKillDevice: (deviceId: string) => void;
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

  // modal state
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);
  const [workerOpen, setWorkerOpen] = useState(false);

  const openDevice = openDeviceId
    ? snapshot.properties.find((p) => p.id === openDeviceId)
    : undefined;

  // the worker on the plan: the active job's provider (fall back to the
  // top-reputation tech so the worker modal always has something to show).
  const dispatchedWorker: Worker | undefined = useMemo(() => {
    const ens = snapshot.activeJob?.worker;
    if (ens) return snapshot.workers.find((w) => w.ensName === ens);
    return [...snapshot.workers].sort((a, b) => b.reputation - a.reputation)[0];
  }, [snapshot.activeJob, snapshot.workers]);

  return (
    <div className="min-h-0 flex-1 overflow-auto ward-scroll">
      <div className="mx-auto w-full max-w-6xl px-5 py-6">
        {/* page heading + controls */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">My home</h1>
            <p className="mt-1 max-w-2xl text-[14px] text-muted">
              Click any device for its live status, or trip a fault and watch the
              agent diagnose, hire, and pay.
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
              {isRunning ? (
                <Play className="h-4 w-4 fill-current" strokeWidth={0} />
              ) : (
                <Droplet className="h-4 w-4 fill-current" strokeWidth={0} />
              )}
              {isRunning ? "Simulating…" : "Simulate: water leak"}
            </button>
          </div>
        </div>

        {/* narrative spine: the intro explainer when idle, the phase stepper
            (what's happening + why, with on-chain badges) while it runs */}
        <div className="mt-6">
          <NarrativeBar
            narrative={snapshot.narrative}
            onStart={onSimulate}
            isRunning={isRunning}
          />
        </div>

        {/* active job — the focal status strip when a job is live */}
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

        {/* HERO: the animated floor plan + the agent reasoning stream */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.55fr_1fr]">
          <FloorPlan
            snapshot={snapshot}
            onKillDevice={onKillDevice}
            onDeviceClick={(id) => setOpenDeviceId(id)}
            onWorkerClick={() => setWorkerOpen(true)}
          />
          <ReasoningStream events={snapshot.events} mounted={mounted} />
        </div>

        {/* on-chain activity feed — a compact bottom strip with its own bounded
            scroll, so the floor plan + reasoning stay the hero and the feed never
            pushes content into an awkward cutoff at laptop heights */}
        <div className="mt-6 pb-2">
          <ActivityFeed
            activity={snapshot.activity}
            now={now}
            mounted={mounted}
            bodyClassName="max-h-[240px] divide-y divide-border overflow-auto ward-scroll"
          />
        </div>
      </div>

      {/* device modal: status + kill */}
      <Modal
        open={!!openDevice}
        onClose={() => setOpenDeviceId(null)}
        labelledBy="device-modal-title"
      >
        {openDevice && (
          <DeviceModal
            property={openDevice}
            liveUptimeSec={liveUptime[openDevice.id] ?? openDevice.device.uptimeSec}
            busy={isRunning}
            onKill={() => {
              onKillDevice(openDevice.id);
              setOpenDeviceId(null);
            }}
          />
        )}
      </Modal>

      {/* worker modal: ENS profile + reputation */}
      <Modal
        open={workerOpen}
        onClose={() => setWorkerOpen(false)}
        labelledBy="worker-modal-title"
      >
        {dispatchedWorker && <WorkerModal worker={dispatchedWorker} />}
      </Modal>
    </div>
  );
}
