"use client";

import { useState } from "react";
import { useTick, useMounted, useWard } from "@/lib/useWard";
import { Header, type Persona } from "./Header";
import { HostView } from "./host/HostView";
import { WorkerView } from "./worker/WorkerView";
import { AgentView } from "./agent/AgentView";

export function App() {
  const [persona, setPersona] = useState<Persona>("host");
  const now = useTick(1000);
  const mounted = useMounted();
  const {
    snapshot,
    runScenario,
    acceptJob,
    markJobComplete,
    reset,
    isRunning,
    adapterName,
  } = useWard();

  // "live" = a job is in flight or a scenario is running.
  const live = isRunning || snapshot.activeJob !== null;

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <Header
        persona={persona}
        onPersona={setPersona}
        agent={snapshot.agent}
        adapterName={adapterName}
        live={live}
      />

      {persona === "host" && (
        <HostView
          snapshot={snapshot}
          now={now}
          mounted={mounted}
          isRunning={isRunning}
          onSimulate={() => runScenario("router-failure")}
          onReset={reset}
        />
      )}

      {persona === "worker" && (
        <WorkerView
          snapshot={snapshot}
          now={now}
          mounted={mounted}
          onAccept={acceptJob}
          onComplete={markJobComplete}
        />
      )}

      {persona === "agent" && <AgentView snapshot={snapshot} mounted={mounted} />}
    </div>
  );
}
