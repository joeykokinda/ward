"use client";

import type { Job, PropertyStatus } from "@/lib/data/types";
import { JOB_STATE_LABEL } from "@/lib/config";
import { formatDuration, formatUsdc, secondsSince } from "@/lib/format";
import { EnsLink, TxLink } from "../links";
import { jobStateTone } from "../primitives";

// Bottom bar — only rendered when a job is live. Amber border-opacity pulse.
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
    <div className="border-2 border-amber/60 ward-pulse bg-panel rounded-[4px] px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Field label="Active job">
          <span className="mono text-[13px] text-text">#{job.jobId}</span>
        </Field>
        <Divider />
        <Field label="Property">
          <span className="mono text-[13px] text-text">
            {property?.name ?? job.propertyId}
          </span>
        </Field>
        <Divider />
        <Field label="Worker">
          {job.worker ? (
            <EnsLink name={job.worker} className="text-[13px]" />
          ) : (
            <span className="mono text-[13px] text-muted">awaiting dispatch</span>
          )}
        </Field>
        <Divider />
        <Field label="Amount">
          <span className="mono text-[13px] text-amber">
            {formatUsdc(job.amount)}
            <span className="ml-1 text-[10px] text-amber/70">USDC</span>
          </span>
        </Field>
        <Divider />
        <Field label="Status">
          <span
            className={`mono text-[13px] font-semibold ${
              tone === "green"
                ? "text-green"
                : tone === "red"
                  ? "text-red"
                  : "text-amber"
            }`}
          >
            {JOB_STATE_LABEL[job.state]}
          </span>
        </Field>
        <Divider />
        <Field label="Elapsed">
          <span className="mono text-[13px] text-text">{elapsed}</span>
        </Field>

        <div className="ml-auto flex items-center gap-3">
          {job.txCreate && (
            <span className="flex items-center gap-1">
              <span className="label">CREATE</span>
              <TxLink hash={job.txCreate} />
            </span>
          )}
          {job.txSettle && (
            <span className="flex items-center gap-1">
              <span className="label">SETTLE</span>
              <TxLink hash={job.txSettle} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="label leading-none">{label}</span>
      <span className="mt-0.5 leading-tight">{children}</span>
    </div>
  );
}

function Divider() {
  return <span className="hidden sm:block h-7 w-px bg-border" aria-hidden />;
}
