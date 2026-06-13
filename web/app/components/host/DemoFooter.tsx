"use client";

import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import {
  CRE_WORKFLOW_URL,
  ENS_ROOT,
  deployment,
  ensProfileUrl,
  explorerAddressUrl,
} from "@/lib/config";

// Persistent orientation for any judge who walks up mid-demo: who does what, and
// the proof for each is one click away from any moment.
const SPONSORS = [
  { role: "Identity", name: "ENS", dot: "#6c8eef" },
  { role: "Settlement", name: "Arc", dot: "#f59e0b" },
  { role: "Attestation", name: "Chainlink CRE", dot: "#818cf8" },
];

const LINKS = [
  { label: "WardEscrow on arcscan", href: explorerAddressUrl(deployment.JobEscrow) },
  { label: "Workers on ENS", href: ensProfileUrl(ENS_ROOT) },
  { label: "CRE workflow source", href: CRE_WORKFLOW_URL },
];

export function DemoFooter() {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 border-t border-border pt-4 pb-2">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px]">
        {SPONSORS.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span
              className="inline-block h-[6px] w-[6px] rounded-full"
              style={{ background: s.dot }}
              aria-hidden
            />
            <span className="text-muted">{s.role}:</span>
            <span className="font-medium text-fg-soft">{s.name}</span>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px]">
        {LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            className="mono inline-flex items-center gap-1 text-faint transition-colors hover:text-fg-soft"
          >
            {l.label}
            <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
          </a>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
        <Link
          href="/live"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-success-ink transition-colors hover:text-success"
        >
          <span className="dot bg-success ward-live-dot" aria-hidden />
          Run it live: the real agent on Arc (not scripted)
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
        <Link
          href="/workers"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent-ink transition-colors hover:text-accent"
        >
          Worker registry: discovery + ranking via ENS
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
