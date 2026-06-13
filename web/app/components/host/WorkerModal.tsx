"use client";

import { MapPin, ShieldCheck, Star } from "lucide-react";
import type { Worker } from "@/lib/data/types";
import { formatUsdc } from "@/lib/format";
import { AddressLink, EnsLink } from "../links";

// The dispatched worker's ENS profile. ENSIP-26 text records (skills / region /
// reputation pointer) live alongside their on-chain reputation + stake. All
// read from the data layer today; live-ENS resolution is wired next.
export function WorkerModal({ worker }: { worker: Worker }) {
  // ENSIP-26: typed text records resolved off the worker's ENS subname.
  const records: { key: string; value: string }[] = [
    { key: "skills", value: worker.skills.join(", ") },
    { key: "region", value: worker.region },
    { key: "ward.reputation", value: String(worker.reputation) },
    { key: "ward.completedJobs", value: String(worker.completedJobs) },
    { key: "ward.stake", value: `${formatUsdc(worker.stakeUsdc)} USDC` },
  ];

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
            <AddressLink address={worker.address} />
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

      {/* ENSIP-26 records */}
      <div className="mt-4">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
          ENSIP-26 records
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          {records.map((r, i) => (
            <div
              key={r.key}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="mono text-[12px] text-muted">{r.key}</span>
              <span className="mono text-[12px] font-medium text-fg-soft">
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        WARD ranked staked techs by skill match + reputation and dispatched this
        provider autonomously. Reputation is an on-chain pointer resolved off the
        ENS subname.
      </p>
    </div>
  );
}
