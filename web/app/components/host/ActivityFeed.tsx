"use client";

import type { Activity, ActivityKind } from "@/lib/data/types";
import { formatUsdc, timeAgo } from "@/lib/format";
import { Chip, Panel, type Tone } from "../primitives";
import { EnsLink, TxLink } from "../links";

const KIND_LABEL: Record<ActivityKind, string> = {
  JOB_CREATED: "Escrow lock",
  JOB_ACCEPTED: "Accepted",
  WORK_DONE: "Work done",
  ATTESTED: "CRE attest",
  JOB_SETTLED: "Settled",
  REPUTATION_BUMP: "Reputation",
  TREASURY_FUNDED: "Funded",
};

const KIND_TONE: Record<ActivityKind, Tone> = {
  JOB_CREATED: "warn",
  JOB_ACCEPTED: "muted",
  WORK_DONE: "muted",
  ATTESTED: "muted",
  JOB_SETTLED: "accent",
  REPUTATION_BUMP: "accent",
  TREASURY_FUNDED: "muted",
};

export function ActivityFeed({
  activity,
  now,
  mounted,
  bodyClassName = "divide-y divide-border overflow-auto ward-scroll",
}: {
  activity: Activity[];
  now: number;
  mounted: boolean;
  bodyClassName?: string;
}) {
  return (
    <Panel
      title="On-chain activity"
      right={
        <span className="text-[12px] text-muted">Arc · {activity.length} txns</span>
      }
      bodyClassName={bodyClassName}
    >
      {activity.map((a, i) => (
        <div key={a.id} className={`px-4 py-3 ${i === 0 ? "ward-row-in" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <Chip tone={KIND_TONE[a.kind]}>{KIND_LABEL[a.kind]}</Chip>
            <span className="text-[11px] text-faint">
              {mounted ? timeAgo(a.ts, now) : "—"}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] text-fg-soft">{a.label}</p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TxLink hash={a.txHash} />
              {a.ensName && <EnsLink name={a.ensName} className="text-[12px]" />}
            </div>
            {a.amountUsdc && (
              <span className="mono text-[13px] font-semibold text-fg">
                {formatUsdc(a.amountUsdc)}
                <span className="ml-1 font-sans text-[10px] font-medium text-muted">
                  USDC
                </span>
              </span>
            )}
          </div>
        </div>
      ))}
    </Panel>
  );
}
