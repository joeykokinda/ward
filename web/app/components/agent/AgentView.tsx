"use client";

import {
  Activity as ActivityIcon,
  CheckCircle2,
  CircleDot,
  Lock,
  Search,
  Send,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { LogType, WardSnapshot } from "@/lib/data/types";
import { deployment } from "@/lib/config";
import { clock, formatUsdc, subUsdc } from "@/lib/format";
import { AddressLink, EnsLink, TxLink } from "../links";
import { Chip, isKeyEvent, Panel } from "../primitives";

const EVENT_ICON: Record<LogType, LucideIcon> = {
  MONITOR: ActivityIcon,
  DIAGNOSE: Search,
  ACTION: Wrench,
  RESULT: CircleDot,
  ESCROW: Lock,
  DISPATCH: Send,
  RESOLVED: CheckCircle2,
};

export function AgentView({
  snapshot,
  mounted,
}: {
  snapshot: WardSnapshot;
  mounted: boolean;
}) {
  const { agent } = snapshot;
  const policy = agent.policy;
  const dailyRemaining = subUsdc(policy.dailyCapUsdc, policy.spentTodayUsdc);

  const decisions = [...snapshot.jobs]
    .sort((a, b) => +new Date(b.createdAtIso) - +new Date(a.createdAtIso))
    .slice(0, 6);

  const trace = snapshot.events.slice(-12).reverse();

  return (
    <div className="min-h-0 flex-1 overflow-auto ward-scroll">
      <div className="mx-auto w-full max-w-5xl px-5 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            Agent profile
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            Identity, spending policy, and an auditable history of every autonomous
            decision.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Identity card */}
          <Panel title="Identity">
            <div className="px-5 py-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
                ENS name · ENSIP-25 verified
              </div>
              <div className="mt-1">
                <EnsLink name={agent.ensName} className="text-[19px]" />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    Wallet address
                  </div>
                  <div className="mt-1">
                    <AddressLink address={agent.address} />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    Chain
                  </div>
                  <div className="mt-1 text-[13px] text-fg-soft">
                    Arc testnet · {deployment.chainId}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-accent-soft px-4 py-3.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-accent-ink">
                  Live USDC balance
                </div>
                <div className="mono mt-1 text-[32px] font-bold leading-none text-accent-ink">
                  {formatUsdc(agent.treasuryUsdc)}
                  <span className="ml-2 font-sans text-[13px] font-medium text-accent-ink/70">
                    USDC
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
                <Contract
                  label="Worker registry"
                  addr={deployment.WorkerRegistry}
                />
                <Contract label="Job escrow" addr={deployment.JobEscrow} />
              </div>
            </div>
          </Panel>

          {/* Spending policy */}
          <Panel title="Spending policy">
            <div className="px-5 py-4">
              <PolicyRow
                label="Per-job cap"
                value={`${formatUsdc(policy.perJobCapUsdc)} USDC`}
              />
              <PolicyRow
                label="Daily cap"
                value={`${formatUsdc(policy.dailyCapUsdc)} USDC`}
              />
              <PolicyRow
                label="Owner-approval threshold"
                value={`${formatUsdc(policy.ownerApprovalThresholdUsdc)} USDC`}
                highlight
              />
              <div className="my-3 border-t border-border" />
              <PolicyRow
                label="Spent today"
                value={`${formatUsdc(policy.spentTodayUsdc)} USDC`}
              />
              <PolicyRow
                label="Daily remaining"
                value={`${formatUsdc(dailyRemaining)} USDC`}
                tone="accent"
              />

              <div className="mt-4 rounded-xl bg-subtle px-4 py-3">
                <p className="text-[12.5px] leading-relaxed text-muted">
                  Jobs{" "}
                  <span className="font-medium text-fg-soft">
                    ≤ {formatUsdc(policy.ownerApprovalThresholdUsdc)} USDC
                  </span>{" "}
                  settle autonomously. Above the threshold, the contract requires{" "}
                  <span className="mono text-fg-soft">ownerApproved</span> before{" "}
                  <span className="mono text-fg-soft">createJob</span> succeeds. The
                  demo job (75.00 USDC) is below the line, so no human sign-off is
                  needed.
                </p>
              </div>
            </div>
          </Panel>

          {/* Decision history */}
          <Panel title="Decision history">
            <div className="divide-y divide-border">
              {decisions.map((j) => {
                const settled = j.state === "SETTLED";
                return (
                  <div key={j.jobId} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-fg">
                        Hire · Job #{j.jobId}
                      </span>
                      <span className="mono text-[13px] font-semibold text-fg">
                        {formatUsdc(j.amount)}
                        <span className="ml-1 font-sans text-[10px] font-medium text-muted">
                          USDC
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-[12px]">
                        {j.worker ? (
                          <EnsLink name={j.worker} className="text-[12px]" />
                        ) : (
                          <span className="text-muted">unassigned</span>
                        )}
                      </span>
                      <Chip tone={settled ? "accent" : "warn"}>
                        {settled ? "Settled" : "In flight"}
                      </Chip>
                    </div>
                    {(j.txCreate || j.txSettle) && (
                      <div className="mt-1.5 flex items-center gap-3">
                        {j.txCreate && <TxLink hash={j.txCreate} />}
                        {j.txSettle && <TxLink hash={j.txSettle} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Recent reasoning trace */}
          <Panel
            title="Recent reasoning"
            right={<span className="text-[12px] text-muted">last 12</span>}
          >
            <div
              className="overflow-auto ward-scroll px-5 py-3"
              style={{ maxHeight: 340 }}
            >
              <ol className="flex flex-col gap-2.5">
                {trace.map((ev) => {
                  const key = isKeyEvent(ev.type);
                  const Icon = EVENT_ICON[ev.type];
                  return (
                    <li key={ev.id} className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full ${
                          key
                            ? "bg-accent-soft text-accent-ink"
                            : "bg-subtle text-faint"
                        }`}
                      >
                        <Icon className="h-3 w-3" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={`text-[10.5px] font-semibold uppercase tracking-wide ${
                              key ? "text-accent-ink" : "text-faint"
                            }`}
                          >
                            {ev.type.toLowerCase()}
                          </span>
                          <span className="mono text-[10.5px] text-faint">
                            {mounted ? clock(ev.ts) : "--:--:--"}
                          </span>
                        </div>
                        <p
                          className={`text-[13px] leading-snug ${
                            key ? "text-fg" : "text-fg-soft"
                          }`}
                        >
                          {ev.message}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function PolicyRow({
  label,
  value,
  tone = "default",
  highlight = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "accent";
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${
        highlight ? "-mx-2 rounded-lg bg-accent-soft px-2" : ""
      }`}
    >
      <span className="text-[13px] text-muted">{label}</span>
      <span
        className={`mono text-[13px] font-semibold ${
          tone === "accent" || highlight ? "text-accent-ink" : "text-fg"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Contract({ label, addr }: { label: string; addr: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-1">
        <AddressLink address={addr} />
      </div>
    </div>
  );
}
