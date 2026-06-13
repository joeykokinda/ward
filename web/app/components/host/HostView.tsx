"use client";

import { useEffect, useMemo, useState } from "react";
import type { Worker, WardSnapshot } from "@/lib/data/types";
import { Modal } from "../Modal";
import { ActorStrip } from "./ActorStrip";
import { AgentReasoning } from "./AgentReasoning";
import { DeviceModal } from "./DeviceModal";
import { FloorPlan } from "./FloorPlan";
import { IntroOverlay } from "./IntroOverlay";
import { OnChainStrip } from "./OnChainStrip";
import { PhaseHUD } from "./PhaseHUD";
import { TriggerPanel } from "./TriggerPanel";
import { WorkerModal } from "./WorkerModal";

const INTRO_KEY = "ward-intro-dismissed";

// The /demo cinematic. The homepage explains the product, so this view is
// visual: the floor plan is the stage, the phase HUD carries the story, the
// actor strip + on-chain strip show the agent / human / chain in lockstep.
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
  // Intro overlay: show once per session. Starts false so SSR + first client
  // render match; an effect flips it on if not yet dismissed.
  const [showIntro, setShowIntro] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Defer the read so we don't setState synchronously in the effect body
    // (matches the useTick pattern used elsewhere).
    const t = setTimeout(() => {
      if (!window.sessionStorage.getItem(INTRO_KEY)) setShowIntro(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const dismissIntro = () => {
    setShowIntro(false);
    try {
      window.sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      // ignore storage failures (private mode); the overlay still dismisses
    }
  };

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
      {showIntro && (
        <IntroOverlay
          onWatch={() => {
            dismissIntro();
            onSimulate();
          }}
          onDismiss={dismissIntro}
        />
      )}

      <div className="mx-auto w-full max-w-6xl px-5 py-5">
        {/* presenter controls */}
        <TriggerPanel
          snapshot={snapshot}
          isRunning={isRunning}
          onTrigger={onKillDevice}
          onReset={onReset}
        />

        {/* stage: floor plan (hero) + actors / agent thinking */}
        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
          <FloorPlan
            snapshot={snapshot}
            onKillDevice={onKillDevice}
            onDeviceClick={(id) => setOpenDeviceId(id)}
            onWorkerClick={() => setWorkerOpen(true)}
          />
          <div className="flex min-h-0 flex-col gap-5">
            <ActorStrip snapshot={snapshot} />
            <AgentReasoning events={snapshot.events} mounted={mounted} />
          </div>
        </div>

        {/* phase HUD: what's happening + why */}
        <div className="mt-5">
          <PhaseHUD narrative={snapshot.narrative} />
        </div>

        {/* on-chain proof: escrow created + settled, verified on Arc */}
        <div className="mt-5 pb-2">
          <OnChainStrip snapshot={snapshot} now={now} mounted={mounted} />
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
