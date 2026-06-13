"use client";

import {
  Check,
  Cpu,
  Link2,
  Play,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { NarrativePhase } from "@/lib/data/types";
import { NARRATIVE_PHASES } from "@/lib/narrative";

// The narrative spine of the demo. When idle it frames WHAT WARD is and WHO the
// three actors are (so a first-time judge has a mental model before anything
// moves). Once an incident is running it becomes the phase stepper: which of the
// five acts we're in, a plain-language caption, and an explicit on-chain badge.
export function NarrativeBar({
  narrative,
  onStart,
  isRunning,
}: {
  narrative?: NarrativePhase | null;
  onStart: () => void;
  isRunning: boolean;
}) {
  if (narrative) return <PhaseStepper narrative={narrative} />;
  return <IntroFrame onStart={onStart} isRunning={isRunning} />;
}

// ───────────────────────────── idle: the explainer ─────────────────────────

function IntroFrame({
  onStart,
  isRunning,
}: {
  onStart: () => void;
  isRunning: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 card-shadow sm:p-6">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        How WARD works
      </div>
      <h2 className="mt-1.5 max-w-3xl text-[19px] font-semibold leading-snug tracking-tight text-fg sm:text-[21px]">
        An AI agent guards your home, and pays a real human to fix what it
        can&apos;t.
      </h2>
      <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-muted">
        WARD watches every device. The moment one breaks it diagnoses the fault
        and tries the free remote fix. If that fails, it hires a verified pro and
        releases payment on-chain, all without waking you.
      </p>

      <div className="mt-5 flex flex-col gap-4 border-t border-border pt-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Actor
            Icon={Cpu}
            name="The agent"
            sub="ward-agent.eth · decides & pays"
          />
          <Actor
            Icon={Wrench}
            name="A human pro"
            sub="found & ranked via ENS"
          />
          <Actor
            Icon={Link2}
            name="Arc chain"
            sub="escrows + settles the USDC"
          />
        </div>
        <button
          onClick={onStart}
          disabled={isRunning}
          className="inline-flex flex-none items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="h-4 w-4 fill-current" strokeWidth={0} />
          Watch it work
        </button>
      </div>
    </div>
  );
}

function Actor({
  Icon,
  name,
  sub,
}: {
  Icon: LucideIcon;
  name: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-subtle text-muted">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-fg">{name}</div>
        <div className="truncate text-[11.5px] text-muted">{sub}</div>
      </div>
    </div>
  );
}

// ──────────────────────────── running: the stepper ─────────────────────────

function PhaseStepper({ narrative }: { narrative: NarrativePhase }) {
  const { index, total, title, caption, onChain, done } = narrative;
  return (
    <div
      className={`rounded-xl border bg-surface p-5 card-shadow ${
        done
          ? "border-accent/60"
          : onChain
            ? "border-accent/60 ward-active"
            : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          {done ? "Resolved" : `Phase ${index} of ${total}`}
        </span>
        {done ? (
          <Badge Icon={ShieldCheck}>Paid on-chain · device healthy</Badge>
        ) : (
          onChain && <Badge Icon={Link2}>On-chain · Arc</Badge>
        )}
      </div>

      <h2 className="mt-1.5 text-[17px] font-semibold leading-snug tracking-tight text-fg">
        {done ? "WARD fixed it and paid the human, autonomously." : title}
      </h2>
      <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-fg-soft">
        {caption}
      </p>

      {/* the five acts as a progress rail */}
      <ol className="mt-4 flex flex-wrap items-center gap-1.5">
        {NARRATIVE_PHASES.map((p, i) => {
          const pos = i + 1;
          const isDone = done || pos < index;
          const isActive = !done && pos === index;
          return (
            <li
              key={p.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                isActive
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : isDone
                    ? "border-border bg-subtle text-fg-soft"
                    : "border-border bg-surface text-faint"
              }`}
            >
              <StepMark active={isActive} done={isDone} onChain={p.onChain} />
              {p.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepMark({
  active,
  done,
  onChain,
}: {
  active: boolean;
  done: boolean;
  onChain: boolean;
}) {
  if (done) return <Check className="h-3 w-3 text-accent-ink" strokeWidth={2.5} />;
  if (active)
    return <span className="dot bg-accent ward-live-dot h-[7px] w-[7px]" aria-hidden />;
  if (onChain) return <Link2 className="h-3 w-3 text-faint" strokeWidth={2} />;
  return <span className="dot bg-border-strong h-[7px] w-[7px]" aria-hidden />;
}

function Badge({
  Icon,
  children,
}: {
  Icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent-soft px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-accent-ink">
      <Icon className="h-3 w-3" strokeWidth={2.4} />
      {children}
    </span>
  );
}
