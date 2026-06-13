"use client";

// Client hook: subscribes to the shared adapter via useSyncExternalStore and
// re-renders on every snapshot change. Also runs a 1s "tick" so uptime / elapsed
// timers advance smoothly even when no state event fires.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getAdapter } from "./data";
import type { ScenarioId, WardSnapshot } from "./data/types";

export function useWard() {
  const adapter = getAdapter();

  const subscribe = useCallback(
    (cb: () => void) => adapter.subscribe(cb),
    [adapter],
  );

  // Server snapshot must be referentially stable across SSR.
  const serverSnapshotRef = useRef<WardSnapshot | null>(null);
  const getServerSnapshot = useCallback(() => {
    if (!serverSnapshotRef.current) serverSnapshotRef.current = adapter.getSnapshot();
    return serverSnapshotRef.current;
  }, [adapter]);

  const snapshot = useSyncExternalStore(
    subscribe,
    () => adapter.getSnapshot(),
    getServerSnapshot,
  );

  return {
    snapshot,
    runScenario: useCallback((id: ScenarioId) => adapter.runScenario(id), [adapter]),
    killDevice: useCallback((deviceId: string) => adapter.killDevice(deviceId), [adapter]),
    acceptJob: useCallback(
      (jobId: number, workerAddress: string) => adapter.acceptJob(jobId, workerAddress),
      [adapter],
    ),
    markJobComplete: useCallback(
      (jobId: number) => adapter.markJobComplete(jobId),
      [adapter],
    ),
    reset: useCallback(() => adapter.reset(), [adapter]),
    isRunning: adapter.isRunning(),
    adapterName: adapter.name,
  };
}

// 1Hz heartbeat returning a wall-clock timestamp (ms). The clock is read
// inside the interval callback (an event context, not render), so render code
// stays pure and time-derived UI (uptime / elapsed) updates every second.
// Returns 0 until mounted so SSR + first client render match.
export function useTick(intervalMs = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    // Defer the first read so it does not run synchronously in the effect body.
    const seed = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(seed);
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

// Hydration-safe mounted flag without setState-in-effect: the store returns
// false during SSR/first render and true on the client.
const noopSubscribe = () => () => {};
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
