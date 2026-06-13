"use client";

import { ArrowUpRight } from "lucide-react";

export type Sponsor = "ENS" | "Arc" | "Chainlink";

// Small brand-color dot per sponsor, kept subtle on the dark surface.
const DOT: Record<Sponsor, string> = {
  ENS: "#6c8eef", // ENS blue
  Arc: "#f59e0b", // our amber (settlement)
  Chainlink: "#818cf8", // Chainlink indigo
};

// A credibility marker: which sponsor's tech is firing at this moment. Static
// (no animation), monospace, clickable to the proof. Sponsor name first, then a
// short description of what they are doing right now.
export function SponsorBadge({
  sponsor,
  label,
  href,
}: {
  sponsor: Sponsor;
  label: string;
  href?: string;
}) {
  const inner = (
    <span className="mono inline-flex items-center gap-1.5 rounded-sm border border-border bg-subtle px-2 py-0.5 text-[11px] leading-tight text-muted transition-colors hover:border-border-strong hover:bg-surface">
      <span
        className="inline-block h-[6px] w-[6px] flex-none rounded-full"
        style={{ background: DOT[sponsor] }}
        aria-hidden
      />
      <span className="font-semibold text-fg-soft">{sponsor}</span>
      <span className="text-muted">· {label}</span>
      {href && <ArrowUpRight className="h-3 w-3 flex-none text-faint" strokeWidth={2} />}
    </span>
  );
  if (!href) return inner;
  return (
    <a href={href} target="_blank" rel="noreferrer" title="Open the proof in a new tab">
      {inner}
    </a>
  );
}
