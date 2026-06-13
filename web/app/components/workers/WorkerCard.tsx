"use client";

import { MapPin } from "lucide-react";
import type { Worker } from "@/lib/data/types";
import { formatUsdc, timeAgo } from "@/lib/format";
import { useEnsLive } from "@/lib/useEnsLive";
import { Chip } from "../primitives";
import { EnsLink } from "../links";

// One registry card per worker. Resolves the worker's ENS subname live on
// Sepolia (GET /api/ens/<subname>) and shows a "resolved live · Sepolia" badge
// when data.live is true, falling back to the labeled ENS link otherwise.
export function WorkerCard({ worker, now }: { worker: Worker; now: number }) {
  const { data, loading } = useEnsLive(worker.ensName, true);
  const live = data.live;

  return (
    <div className="flex min-h-0 flex-col bg-surface p-5 transition-colors hover:bg-subtle">
      {/* identity */}
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-sm bg-accent text-[18px] font-bold text-[#1a2e05]">
          {worker.handle[0]?.toUpperCase()}
        </span>
        <div className="min-w-0">
          <EnsLink name={worker.ensName} className="text-[14px]" />
          <div className="mt-1 text-[13px] text-fg-soft">{worker.title}</div>
        </div>
      </div>

      {/* live ENS badge */}
      <div className="mt-3 h-4 text-[11px]">
        {loading ? (
          <span className="text-faint">resolving ENS&hellip;</span>
        ) : live ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-accent-ink">
            <span className="dot bg-accent ward-live-dot" aria-hidden />
            resolved live · Sepolia
          </span>
        ) : (
          <span className="text-faint">fixture · RPC unavailable</span>
        )}
      </div>

      {/* skills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {worker.skills.map((skill) => (
          <Chip key={skill} tone="muted">
            {skill}
          </Chip>
        ))}
      </div>

      {/* region + eta */}
      <div className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
        <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
        {worker.region}
        <span className="text-faint">·</span>
        <span className="text-fg-soft">~{worker.etaMin} min away</span>
      </div>

      {/* reputation + rating + stake + jobs */}
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border">
        <div className="bg-subtle px-3 py-2.5">
          <div className="label">Reputation</div>
          <div className="mono mt-1 text-[26px] font-bold leading-none text-accent-ink">
            {worker.reputation}
          </div>
        </div>
        <div className="bg-subtle px-3 py-2.5">
          <div className="label">Rating</div>
          <div className="mono mt-1 text-[26px] font-bold leading-none text-fg">
            {worker.rating?.toFixed(1)}
            <span className="ml-1 font-sans text-[12px] font-medium text-muted">
              / 5
            </span>
          </div>
        </div>
        <div className="bg-subtle px-3 py-2.5">
          <div className="label">Staked</div>
          <div className="mono mt-1 text-[15px] font-semibold leading-none text-fg">
            {formatUsdc(worker.stakeUsdc)}
            <span className="ml-1 font-sans text-[11px] font-medium text-muted">
              USDC
            </span>
          </div>
        </div>
        <div className="bg-subtle px-3 py-2.5">
          <div className="label">Completed</div>
          <div className="mono mt-1 text-[15px] font-semibold leading-none text-fg">
            {worker.completedJobs}
            <span className="ml-1 font-sans text-[11px] font-medium text-muted">
              jobs
            </span>
          </div>
        </div>
      </div>

      {/* recent job history */}
      <div className="mt-4">
        <div className="label mb-2">Recent jobs</div>
        <div className="overflow-hidden rounded-sm border border-border">
          {(worker.jobHistory ?? []).map((job, index) => (
            <div
              key={`${job.device}-${job.whenIso}`}
              className={`flex items-center justify-between gap-3 px-3 py-2 ${
                index > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="min-w-0 truncate text-[12px] text-fg-soft">
                {job.device}
              </span>
              <span className="flex flex-none items-center gap-2 text-[12px]">
                <span className="text-faint">{timeAgo(job.whenIso, now)}</span>
                <span className="mono font-medium text-fg">
                  {formatUsdc(job.amountUsdc)}
                  <span className="ml-1 font-sans text-[10px] font-medium text-muted">
                    USDC
                  </span>
                </span>
                <span className="text-[11px] font-medium text-success-ink">
                  settled
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
