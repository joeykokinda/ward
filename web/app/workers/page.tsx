"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { buildWorkers } from "@/lib/data/fixtures";
import { useTick } from "@/lib/useWard";
import { WardMark } from "../components/WardMark";
import { RankingExplainer } from "../components/workers/RankingExplainer";
import { WorkerCard } from "../components/workers/WorkerCard";
import { VerifyEns } from "../components/workers/VerifyEns";

export default function WorkersPage() {
  const workers = useMemo(() => buildWorkers(), []);

  // The leak worked-example candidates: every staked plumber in the registry.
  const plumbers = useMemo(
    () => workers.filter((worker) => worker.staked && worker.skills.includes("plumber")),
    [workers],
  );

  // timeAgo() needs a `now` ms value; useTick returns 0 until mount, so the
  // relative timestamps stay pure and never trigger a hydration mismatch.
  const now = useTick();

  return (
    <main className="min-h-screen bg-bg text-fg">
      {/* top nav */}
      <nav className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2" title="WARD home">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent">
              <WardMark className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[16px] font-semibold tracking-tight text-fg">
              WARD
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 border-l border-border pl-4 text-[12px] text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Home
          </Link>
        </div>
        <Link
          href="/live"
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-fg-soft transition-colors hover:border-border-strong hover:bg-subtle"
        >
          Try it live
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </nav>

      <div className="mx-auto w-full max-w-5xl px-5 py-10 md:py-14">
        {/* header */}
        <header>
          <div className="label">Worker registry</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-fg md:text-4xl">
            Worker registry
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted">
            Workers are human field techs registered as ENS subnames of{" "}
            <span className="mono text-fg-soft">ward-agent.eth</span>. The agent
            discovers and ranks them live by skill match, proximity, and on-chain
            reputation.
          </p>
        </header>

        {/* live ENS proof — resolve a name on Sepolia right now (not hardcoded) */}
        <div className="mt-8">
          <VerifyEns />
        </div>

        {/* ranking explainer + worked LEAK example */}
        <div className="mt-8">
          <RankingExplainer candidates={plumbers} />
        </div>

        {/* all workers grid */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[18px] font-semibold text-fg-soft">All workers</h2>
            <span className="text-[12px] text-faint">
              {workers.length} registered techs
            </span>
          </div>
          <div className="mt-4 grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {workers.map((worker) => (
              <WorkerCard key={worker.handle} worker={worker} now={now} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
