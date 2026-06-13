"use client";

import { Briefcase } from "lucide-react";
import type { Job, PropertyStatus } from "@/lib/data/types";
import { JOB_STATE_LABEL } from "@/lib/config";
import { formatDuration, formatUsdc, secondsSince } from "@/lib/format";
import { EnsLink, TxLink } from "../links";
import { Chip, jobStateTone } from "../primitives";

// Focal active-job card — only rendered when a job is live. Gentle accent ring.
export function ActiveJobBar({
  job,
  property,
  now,
  mounted,
}: {
  job: Job;
  property?: PropertyStatus;
  now: number;
  mounted: boolean;
}) {
  const tone = jobStateTone(job.state);
  const elapsed = mounted ? formatDuration(secondsSince(job.createdAtIso, now)) : "0s";

  return (
    <div className="ward-active rounded-xl border border-border bg-surface p-5 card-shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
            <Briefcase className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Active job
            </div>
            <div className="text-[15px] font-semibold text-fg">
              #{job.jobId} · {property?.name ?? job.propertyId}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-subtle px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-faint">
            ERC-8183
          </span>
          <Chip tone={tone}>{JOB_STATE_LABEL[job.state]}</Chip>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Field label="Worker">
          {job.worker ? (
            <EnsLink name={job.worker} className="text-[13px]" />
          ) : (
            <span className="text-[13px] text-muted">awaiting dispatch</span>
          )}
        </Field>
        <Field label="Amount">
          <span className="mono text-[15px] font-semibold text-fg">
            {formatUsdc(job.amount)}
            <span className="ml-1 font-sans text-[11px] font-medium text-muted">
              USDC
            </span>
          </span>
        </Field>
        <Field label="Elapsed">
          <span className="mono text-[14px] text-fg-soft">{elapsed}</span>
        </Field>
        <Field label="Transactions">
          <div className="flex flex-col gap-0.5">
            {job.txCreate && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                <span>lock</span>
                <TxLink hash={job.txCreate} />
              </span>
            )}
            {job.txSettle && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                <span>settle</span>
                <TxLink hash={job.txSettle} />
              </span>
            )}
            {!job.txCreate && !job.txSettle && (
              <span className="text-[13px] text-faint">—</span>
            )}
          </div>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-1 leading-tight">{children}</div>
    </div>
  );
}
