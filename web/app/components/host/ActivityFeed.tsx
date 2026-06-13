"use client";

import type { Activity, ActivityKind } from "@/lib/data/types";
import { formatUsdc, timeAgo } from "@/lib/format";
import { Panel } from "../primitives";
import { EnsLink, TxLink } from "../links";

const KIND_LABEL: Record<ActivityKind, string> = {
  JOB_CREATED: "ESCROW LOCK",
  JOB_ACCEPTED: "ACCEPTED",
  WORK_DONE: "WORK DONE",
  ATTESTED: "CRE ATTEST",
  JOB_SETTLED: "SETTLED",
  REPUTATION_BUMP: "REP ++",
  TREASURY_FUNDED: "FUNDED",
};

const KIND_TONE: Record<ActivityKind, string> = {
  JOB_CREATED: "text-amber",
  JOB_ACCEPTED: "text-green",
  WORK_DONE: "text-text",
  ATTESTED: "text-blue",
  JOB_SETTLED: "text-green",
  REPUTATION_BUMP: "text-green",
  TREASURY_FUNDED: "text-amber",
};

export function ActivityFeed({
  activity,
  now,
  mounted,
}: {
  activity: Activity[];
  now: number;
  mounted: boolean;
}) {
  return (
    <Panel
      title="Onchain activity · Arc"
      right={<span className="mono text-[11px] text-muted">{activity.length} txs</span>}
      className="h-full"
      bodyClassName="overflow-auto ward-scroll"
    >
      <div className="divide-y divide-border">
        {activity.map((a, i) => (
          <div key={a.id} className={`px-3 py-2 ${i === 0 ? "ward-row-in" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <span
                className={`mono text-[10px] font-bold tracking-wider ${KIND_TONE[a.kind]}`}
              >
                {KIND_LABEL[a.kind]}
              </span>
              <span className="mono text-[10px] text-muted">
                {mounted ? timeAgo(a.ts, now) : "—"}
              </span>
            </div>
            <div className="mt-1 mono text-[12px] text-text">{a.label}</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <TxLink hash={a.txHash} />
              {a.amountUsdc && (
                <span className="mono text-[12px] text-amber">
                  {formatUsdc(a.amountUsdc)}
                  <span className="ml-1 text-[9px] text-amber/70">USDC</span>
                </span>
              )}
            </div>
            {a.ensName && (
              <div className="mt-0.5">
                <EnsLink name={a.ensName} className="text-[11px]" />
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
