"use client";

import { Cpu, Link2, Play, Wrench, X, type LucideIcon } from "lucide-react";

// Auto-shown on the first /demo visit of a session. Loads the mental model in
// one card before anything moves, then drops the judge straight into the
// cinematic. Dismissable; shows once per session.
export function IntroOverlay({
  onWatch,
  onDismiss,
}: {
  onWatch: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="ward-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="ward-modal relative w-full max-w-lg rounded-sm border border-border bg-surface p-7 card-shadow-lg">
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-sm text-faint transition-colors hover:bg-subtle hover:text-fg"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          WARD
        </div>
        <h2 className="mt-2 text-[20px] font-semibold leading-snug tracking-tight text-fg">
          An AI agent guards your home. When it can&apos;t fix something, it hires
          and pays a real human on-chain.
        </h2>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <Actor Icon={Cpu} name="Agent" sub="decides + pays" />
          <Actor Icon={Wrench} name="Human" sub="verified via ENS" />
          <Actor Icon={Link2} name="Arc chain" sub="settles the USDC" />
        </div>

        <button
          onClick={onWatch}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-accent px-5 py-3 text-[14px] font-semibold text-[#0a0a0f] transition-colors hover:bg-accent-hover"
        >
          <Play className="h-4 w-4 fill-current" strokeWidth={0} />
          Watch it work
        </button>
        <button
          onClick={onDismiss}
          className="mt-2 w-full text-[12px] text-muted transition-colors hover:text-fg"
        >
          or explore on your own
        </button>
      </div>
    </div>
  );
}

function Actor({ Icon, name, sub }: { Icon: LucideIcon; name: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-sm border border-border bg-subtle px-2 py-3 text-center">
      <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-surface text-accent-ink">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="text-[12px] font-semibold text-fg">{name}</span>
      <span className="text-[10.5px] leading-tight text-muted">{sub}</span>
    </div>
  );
}
