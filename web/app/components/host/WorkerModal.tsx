"use client";

import { MapPin, ShieldCheck, Star } from "lucide-react";
import type { Worker } from "@/lib/data/types";
import { formatUsdc } from "@/lib/format";
import { useEnsLive } from "@/lib/useEnsLive";
import { AddressLink, EnsLink } from "../links";

// The dispatched worker's ENS profile. We resolve the worker's subname LIVE on
// Sepolia (GET /api/ens/<subname>) and render the real ENSIP-26 / WARD text
// records (skills, region, reputation pointer, role) with a "resolved live ·
// Sepolia" indicator. If live resolution is unavailable (slow/failed RPC, or the
// subname isn't on this network), we fall back to the labeled fixture records so
// the cinematic demo never breaks.
export function WorkerModal({ worker }: { worker: Worker }) {
  // WorkerModal only mounts when the modal is open, so always fetch on mount.
  const { data, loading } = useEnsLive(worker.ensName, true);
  const live = data.live;

  // Records the modal renders: live ENS-resolved values when available, else the
  // fixture-backed records (clearly labeled in the panel header).
  const records: { key: string; value: string }[] = live
    ? [
        { key: "eth.ward.skills", value: data.records.skills.join(", ") || "—" },
        { key: "eth.ward.region", value: data.records.region || "—" },
        ...(data.records.reputationPointer
          ? [{ key: "eth.ward.reputation", value: data.records.reputationPointer }]
          : []),
        ...(data.records.role ? [{ key: "eth.ward.role", value: data.records.role }] : []),
        ...(data.records.webEndpoint
          ? [{ key: "agent-endpoint[web]", value: data.records.webEndpoint }]
          : []),
      ]
    : [
        { key: "skills", value: worker.skills.join(", ") },
        { key: "region", value: worker.region },
        { key: "ward.reputation", value: String(worker.reputation) },
        { key: "ward.completedJobs", value: String(worker.completedJobs) },
        { key: "ward.stake", value: `${formatUsdc(worker.stakeUsdc)} USDC` },
      ];

  // Address: prefer the live-resolved on-chain address when present.
  const address = live && data.address ? data.address : worker.address;

  return (
    <div className="p-5">
      <div className="flex items-start gap-3 pr-8">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-accent text-[20px] font-bold text-[#1a2e05]">
          {worker.handle[0]?.toUpperCase()}
        </span>
        <div className="min-w-0">
          <h3 id="worker-modal-title" className="mt-0.5">
            <EnsLink name={worker.ensName} className="text-[16px]" />
          </h3>
          <div className="mt-1">
            <AddressLink address={address} />
          </div>
        </div>
      </div>

      {/* headline reputation + stake */}
      <div className="mt-4 flex items-stretch gap-3">
        <div className="flex-1 rounded-xl bg-accent-soft px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-accent-ink">
            <Star className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
            On-chain reputation
          </div>
          <div className="mono mt-1 text-[28px] font-bold leading-none text-accent-ink">
            {worker.reputation}
          </div>
        </div>
        <div className="flex-1 rounded-xl bg-subtle px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
            Staked
          </div>
          <div className="mono mt-1 text-[28px] font-bold leading-none text-fg">
            {formatUsdc(worker.stakeUsdc).split(".")[0]}
            <span className="ml-1 font-sans text-[12px] font-medium text-muted">
              USDC
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
        <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
        {worker.region} · {worker.completedJobs} jobs completed
      </div>

      {/* ENSIP-26 records — live-resolved off Sepolia, fixture fallback otherwise */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            ENSIP-26 records
          </span>
          {loading ? (
            <span className="text-[11px] text-faint">resolving…</span>
          ) : live ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent-ink">
              <span className="dot bg-accent ward-live-dot" aria-hidden />
              resolved live · Sepolia
            </span>
          ) : (
            <span className="text-[11px] text-faint">fixture · RPC unavailable</span>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          {records.map((record, i) => (
            <div
              key={record.key}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="mono text-[12px] text-muted">{record.key}</span>
              <span className="mono max-w-[60%] truncate text-right text-[12px] font-medium text-fg-soft">
                {record.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        {live ? (
          <>
            Records read live from <span className="mono">{worker.ensName}</span> on
            Sepolia via the ENS UniversalResolver — no hardcoded values. Reputation is
            a CAIP-10 pointer to the on-chain WorkerRegistry; WARD ranks staked techs
            by skill match + reputation and dispatched this provider autonomously.
          </>
        ) : (
          <>
            Live Sepolia resolution was unavailable, so these are WARD&apos;s fixture
            records. WARD ranked staked techs by skill match + reputation and
            dispatched this provider autonomously; reputation is an on-chain pointer
            resolved off the ENS subname.
          </>
        )}
      </p>
    </div>
  );
}
