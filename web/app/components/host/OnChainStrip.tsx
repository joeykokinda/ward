"use client";

import { ArrowUpRight } from "lucide-react";
import type { Activity } from "@/lib/data/types";
import { explorerTxUrl } from "@/lib/config";
import { formatUsdc, shortHash, timeAgo } from "@/lib/format";

// The three most recent on-chain events, in human-readable language, each
// clickable to the Arc explorer. Not a scrolling log: three cards, replaced as
// new events land.
export function OnChainStrip({
  activity,
  now,
  mounted,
}: {
  activity: Activity[];
  now: number;
  mounted: boolean;
}) {
  const latest = activity.slice(0, 3);
  return (
    <div className="rounded-sm border border-border bg-surface card-shadow">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          On-chain activity
        </span>
        <span className="text-[11px] text-faint">Arc testnet</span>
      </div>
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
        {latest.map((a) => (
          <a
            key={a.id}
            href={explorerTxUrl(a.txHash)}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col gap-1.5 bg-surface p-3.5 transition-colors hover:bg-subtle"
          >
            <span className="text-[13px] font-medium leading-snug text-fg">
              {readableLabel(a)}
            </span>
            <span className="flex items-center justify-between gap-2">
              <span className="mono text-[11px] text-faint group-hover:text-muted">
                {shortHash(a.txHash)}
                <ArrowUpRight className="ml-1 inline h-3 w-3 align-[-1px]" strokeWidth={2} />
              </span>
              <span className="text-[11px] text-faint">
                {mounted ? timeAgo(a.ts, now) : ""}
              </span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function readableLabel(a: Activity): string {
  const amt = a.amountUsdc ? `${formatUsdc(a.amountUsdc)} USDC` : "";
  const who = a.ensName ?? "the worker";
  switch (a.kind) {
    case "JOB_CREATED":
      return `Smart contract locked ${amt} in escrow`;
    case "JOB_ACCEPTED":
      return `Hired ${who}`;
    case "WORK_DONE":
      return `${who} submitted the fix`;
    case "ATTESTED":
      return "Chainlink CRE attested the fix";
    case "JOB_SETTLED":
      return `Released ${amt} to ${who}`;
    case "REPUTATION_BUMP":
      return `${who} reputation +1`;
    case "TREASURY_FUNDED":
      return `Treasury funded ${amt}`;
    default:
      return a.label;
  }
}
