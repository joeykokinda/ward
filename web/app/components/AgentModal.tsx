"use client";

import { BadgeCheck, Cpu } from "lucide-react";
import type { WardSnapshot } from "@/lib/data/types";
import { deployment } from "@/lib/config";
import { clock, formatUsdc } from "@/lib/format";
import { useEnsLive } from "@/lib/useEnsLive";
import { AddressLink, EnsLink } from "./links";
import { Chip } from "./primitives";

// Header "ward-agent.eth" click -> the agent's identity + a compact action
// history (recent autonomous decisions, latest first). The agent's name is
// resolved LIVE on Sepolia (GET /api/ens/<name>) and the ENSIP-25 verification
// badge reflects the real on-chain agent-registration attestation.
export function AgentModal({
  snapshot,
  mounted,
}: {
  snapshot: WardSnapshot;
  mounted: boolean;
}) {
  const { agent } = snapshot;
  // AgentModal only mounts when its modal is open, so always resolve on mount.
  const { data, loading } = useEnsLive(agent.ensName, true);
  const live = data.live;
  const ensip25Verified = live && data.ensip25Verified;
  const liveAddress = live && data.address ? data.address : agent.address;
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
          <h3 id="agent-modal-title" className="flex flex-wrap items-center gap-2">
            <EnsLink name={agent.ensName} className="text-[16px]" />
            {loading ? (
              <span className="text-[11px] text-faint">verifying…</span>
            ) : ensip25Verified ? (
              <Chip tone="accent" className="!py-0.5">
                <BadgeCheck className="h-3 w-3" strokeWidth={2.4} />
                ENSIP-25 ✓
              </Chip>
            ) : null}
          </h3>
          <div className="mt-1">
            <AddressLink address={liveAddress} />
          </div>
          <div className="mt-1 text-[11px]">
            {loading ? (
              <span className="text-faint">resolving live · Sepolia</span>
            ) : live ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-accent-ink">
                <span className="dot bg-accent ward-live-dot" aria-hidden />
                resolved live · Sepolia
              </span>
            ) : (
              <span className="text-faint">fixture · RPC unavailable</span>
            )}
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
          How the agent runs
        </div>
        <div className="divide-y divide-border overflow-hidden rounded-sm border border-border">
          <StackRow label="Runtime" value="Purpose-built Python agent, asyncio control loop, no framework" />
          <StackRow label="Reasoning" value="Claude via the Anthropic SDK, structured JSON output + extended thinking" />
          <StackRow label="On-chain" value="web3.py, opens + funds the ERC-8183 escrow on Arc" />
          <StackRow label="Discovery" value="ENS resolution, finds + ranks workers by on-chain reputation" />
          <StackRow label="Settlement" value="Chainlink CRE attests telemetry, releases the escrow" />
        </div>
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

function StackRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-3.5 py-2.5">
      <span className="w-[72px] flex-none text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="text-[12px] leading-snug text-fg-soft">{value}</span>
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
