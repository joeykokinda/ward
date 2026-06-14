"use client";

import { useState } from "react";
import { useTick, useMounted, useWard } from "@/lib/useWard";
import { AgentModal } from "./AgentModal";
import { Header, type Persona } from "./Header";
import { Modal } from "./Modal";
import { HostView } from "./host/HostView";
import { WorkerView } from "./worker/WorkerView";
import { AgentView } from "./agent/AgentView";

export function App() {
  const [persona, setPersona] = useState<Persona>("host");
  const [agentOpen, setAgentOpen] = useState(false);
  const now = useTick(1000);
  const mounted = useMounted();
  const {
    snapshot,
    runScenario,
    killDevice,
    acceptJob,
    markJobComplete,
    reset,
    isRunning,
  } = useWard();

  // "live" = a job is in flight or a scenario is running.
  const live = isRunning || snapshot.activeJob !== null;

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <Header
        persona={persona}
        onPersona={setPersona}
        agent={snapshot.agent}
        live={live}
        onAgentClick={() => setAgentOpen(true)}
      />

      {persona === "host" && (
        <HostView
          snapshot={snapshot}
          now={now}
          mounted={mounted}
          isRunning={isRunning}
          onSimulate={() => runScenario("home-leak")}
          onKillDevice={killDevice}
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

      <footer className="flex flex-none items-center justify-center border-t border-border bg-surface px-5 py-2">
        <span className="text-[11px] text-faint">
          Today homeowners · tomorrow property managers &amp; DePIN — same protocol
        </span>
      </footer>

      {/* agent profile (header ENS click) */}
      <Modal
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        labelledBy="agent-modal-title"
      >
        <AgentModal snapshot={snapshot} mounted={mounted} />
      </Modal>
    </div>
  );
}
