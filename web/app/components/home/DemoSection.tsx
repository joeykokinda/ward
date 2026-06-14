"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { useMounted, useTick, useWard } from "@/lib/useWard";
import { FloorPlan } from "../host/FloorPlan";
import { AgentReasoning } from "../host/AgentReasoning";
import { PhaseHUD } from "../host/PhaseHUD";
import { OnChainStrip } from "../host/OnChainStrip";

// The homepage "see it run" section: the scripted cinematic, embedded inline and
// stripped of the booth chrome (no persona switcher, no treasury header, no intro
// overlay). Just the story — floor plan + reasoning + phase HUD + on-chain proof
// — driven by one "Watch it run" button, with a "Try it live" handoff to /live.
export function DemoSection() {
  const now = useTick(1000);
  const mounted = useMounted();
  const { snapshot, runScenario, killDevice, reset, isRunning } = useWard();
  const hasRun = snapshot.narrative != null || snapshot.activeJob != null;

  const watch = () => {
    reset();
    runScenario("home-leak");
  };

  return (
    <section id="see-it-run" className="scroll-mt-16 border-b border-border bg-bg">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
        <div className="reveal">
          <div className="label">See it run</div>
          <h2 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-fg md:text-5xl">
            One incident, handled end to end on-chain.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
            A 2am leak, the owner asleep in Tokyo. Hit play: WARD detects it, tries
            the free fix, hires a verified human through ENS, escrows USDC on Arc, and
            releases payment the moment a Chainlink oracle confirms the sensor reads
            dry. Every on-chain step below is a real, clickable link.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={watch}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-[#0a0a0f] transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="h-4 w-4" strokeWidth={2.4} />
              {isRunning ? "Running…" : hasRun ? "Run it again" : "Watch it run"}
            </button>
            <Link
              href="/live"
              className="inline-flex items-center gap-2 rounded-sm border border-border-strong bg-surface px-5 py-3 text-sm font-semibold text-fg transition-colors hover:border-faint hover:bg-subtle"
            >
              Try it live on Arc
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </div>

        {/* the stage: floor plan + the agent's live reasoning */}
        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
          <FloorPlan
            snapshot={snapshot}
            onKillDevice={killDevice}
            onDeviceClick={() => {}}
            onWorkerClick={() => {}}
          />
          <AgentReasoning events={snapshot.events} mounted={mounted} />
        </div>

        {/* what's happening + why */}
        <div className="mt-5">
          <PhaseHUD narrative={snapshot.narrative} />
        </div>

        {/* on-chain proof: escrow created + settled, verified on Arc */}
        <div className="mt-5">
          <OnChainStrip snapshot={snapshot} now={now} mounted={mounted} />
        </div>
      </div>
    </section>
  );
}
