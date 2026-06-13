"use client";

import { Cpu } from "lucide-react";
import type { WardSnapshot } from "@/lib/data/types";
import { deployment } from "@/lib/config";
import { clock, formatUsdc } from "@/lib/format";
import { AddressLink, EnsLink } from "./links";
import { Chip } from "./primitives";

// Header "ward-agent.eth" click -> the agent's identity + a compact action
// history (recent autonomous decisions, latest first).
export function AgentModal({
  snapshot,
  mounted,
}: {
  snapshot: WardSnapshot;
  mounted: boolean;
}) {
  const { agent } = snapshot;
  const decisions = [...snapshot.jobs]
    .sort((a, b) => +new Date(b.createdAtIso) - +new Date(a.createdAtIso))
    .slice(0, 6);

  return (
    <div className="p-5">
      <div className="flex items-start gap-3 pr-8">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
          <Cpu className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h3 id="agent-modal-title">
            <EnsLink name={agent.ensName} className="text-[16px]" />
          </h3>
          <div className="mt-1">
            <AddressLink address={agent.address} />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-accent-soft px-4 py-3.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-accent-ink">
          Live USDC treasury
        </div>
        <div className="mono mt-1 text-[30px] font-bold leading-none text-accent-ink">
          {formatUsdc(agent.treasuryUsdc)}
          <span className="ml-2 font-sans text-[12px] font-medium text-accent-ink/70">
            USDC
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
        <Policy label="Per-job cap" value={formatUsdc(agent.policy.perJobCapUsdc)} />
        <Policy label="Daily cap" value={formatUsdc(agent.policy.dailyCapUsdc)} />
        <Policy
          label="Approval ≥"
          value={formatUsdc(agent.policy.ownerApprovalThresholdUsdc)}
        />
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
          Action history · Arc · chain {deployment.chainId}
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          {decisions.map((j, i) => {
            const completed = j.state === "Completed";
            return (
              <div
                key={j.jobId}
                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-fg">
                    Hire · Job #{j.jobId}
                  </div>
                  <div className="text-[11px] text-muted">
                    {j.worker ?? "unassigned"} ·{" "}
                    <span className="mono">
                      {mounted ? clock(j.createdAtIso) : "--:--:--"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mono text-[12.5px] font-semibold text-fg">
                    {formatUsdc(j.amount)}
                  </span>
                  <Chip tone={completed ? "accent" : "warn"}>
                    {completed ? "done" : "in flight"}
                  </Chip>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Policy({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-subtle px-2 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mono mt-0.5 text-[13px] font-semibold text-fg">{value}</div>
    </div>
  );
}
