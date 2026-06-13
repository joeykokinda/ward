"use client";

import { Check, MapPin } from "lucide-react";
import type { Worker } from "@/lib/data/types";
import { Chip } from "../primitives";
import { EnsLink } from "../links";

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Filter",
    body: "Keep only ENS-registered, staked workers whose skills match the needed repair.",
  },
  {
    n: "02",
    title: "Rank",
    body: "Score the survivors on skill match, proximity (ETA to the home), and on-chain reputation. The CAIP-10 pointer in each ENS record resolves to the Arc WorkerRegistry.",
  },
  {
    n: "03",
    title: "Dispatch",
    body: "Open and fund the ERC-8183 escrow for the single top candidate.",
  },
];

// A ranked candidate row in the worked LEAK example. The selected winner is
// highlighted with an amber ring + "selected" chip so the choice is visible.
function CandidateRow({
  worker,
  rank,
  selected,
}: {
  worker: Worker;
  rank: number;
  selected: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        selected ? "bg-accent-soft ward-active" : "bg-subtle"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="mono text-[12px] text-faint">#{rank}</span>
        <span
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-sm text-[15px] font-bold ${
            selected ? "bg-accent text-[#1a2e05]" : "bg-border-strong text-fg"
          }`}
        >
          {worker.handle[0]?.toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <EnsLink name={worker.ensName} className="text-[13px]" />
            {selected && (
              <Chip tone="accent">
                <Check className="h-3 w-3" strokeWidth={3} />
                selected
              </Chip>
            )}
          </div>
          <div className="text-[12px] text-muted">{worker.title}</div>
        </div>
      </div>

      <div className="flex flex-none items-center gap-5 sm:gap-6">
        <div className="text-right">
          <div className="label">ETA</div>
          <div className="mono mt-0.5 flex items-center justify-end gap-1 text-[14px] font-semibold text-fg">
            <MapPin className="h-3 w-3 text-faint" strokeWidth={2} />~{worker.etaMin}m
          </div>
        </div>
        <div className="text-right">
          <div className="label">Reputation</div>
          <div
            className={`mono mt-0.5 text-[14px] font-semibold ${
              selected ? "text-accent-ink" : "text-fg"
            }`}
          >
            {worker.reputation}
          </div>
        </div>
      </div>
    </div>
  );
}

// "How WARD picks": the 3-step ranking explainer plus a worked example for a
// LEAK incident: filter to plumbers (mike, lena), rank them, highlight mike as
// the winner (closest qualified plumber, highest reputation).
export function RankingExplainer({ candidates }: { candidates: Worker[] }) {
  // Rank plumbers: closer ETA + higher reputation wins. mike (14m / 98) over
  // lena (26m / 84), so the worked example shows mike selected.
  const ranked = [...candidates].sort(
    (a, b) => a.etaMin! - b.etaMin! || b.reputation - a.reputation,
  );

  return (
    <section className="border border-border bg-surface rounded-sm">
      <header className="border-b border-border px-5 py-4">
        <div className="label">The ranking</div>
        <h2 className="mt-1.5 text-[18px] font-semibold text-fg-soft">
          How WARD picks
        </h2>
      </header>

      {/* 3 steps */}
      <div className="grid gap-px bg-border sm:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.n} className="bg-surface p-5">
            <span className="mono text-[13px] text-accent-ink">{step.n}</span>
            <h3 className="mt-2 text-[14px] font-semibold text-fg-soft">
              {step.title}
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              {step.body}
            </p>
          </div>
        ))}
      </div>

      {/* worked example */}
      <div className="border-t border-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="warn">Worked example</Chip>
          <span className="text-[13px] text-muted">
            Leak sensor trips &mdash; filter to staked plumbers, then rank.
          </span>
        </div>

        <div className="mt-3 overflow-hidden rounded-sm border border-border">
          {ranked.map((worker, index) => (
            <div
              key={worker.handle}
              className={index > 0 ? "border-t border-border" : ""}
            >
              <CandidateRow
                worker={worker}
                rank={index + 1}
                selected={index === 0}
              />
            </div>
          ))}
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-faint">
          Both candidates are licensed, staked plumbers.{" "}
          <span className="text-fg-soft">{ranked[0]?.handle}</span> wins: the
          closest qualified plumber with the highest on-chain reputation. WARD
          opens and funds the escrow for {ranked[0]?.handle} only.
        </p>
      </div>
    </section>
  );
}
