"use client";

import type { WardSnapshot } from "@/lib/data/types";
import { deployment } from "@/lib/config";
import { formatUsdc, subUsdc } from "@/lib/format";
import { AddressLink, EnsLink, TxLink } from "../links";
import { LOG_COLOR, Panel } from "../primitives";
import { clock } from "@/lib/format";

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

  // decision history: settled/active jobs as policy decisions
  const decisions = [...snapshot.jobs]
    .sort((a, b) => +new Date(b.createdAtIso) - +new Date(a.createdAtIso))
    .slice(0, 6);

  // recent reasoning trace: last N events
  const trace = snapshot.events.slice(-12).reverse();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 overflow-auto ward-scroll p-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Identity card */}
        <Panel title="Agent identity">
          <div className="px-4 py-3">
            <div className="label">ENS name (ENSIP-25 verified)</div>
            <div className="mt-1 mono text-[18px] text-text">
              <EnsLink name={agent.ensName} className="text-[18px]" />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="label">Wallet address</div>
                <div className="mt-1">
                  <AddressLink address={agent.address} />
                </div>
              </div>
              <div>
                <div className="label">Chain</div>
                <div className="mt-1 mono text-[12px] text-text">
                  Arc testnet · {deployment.chainId}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <div className="label">Live USDC balance</div>
              <div className="mt-1 mono text-[30px] font-bold leading-none text-amber">
                {formatUsdc(agent.treasuryUsdc)}
                <span className="ml-2 text-[13px] text-amber/70">USDC</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
              <Mini label="Worker registry" value="WorkerRegistry" addr={deployment.WorkerRegistry} />
              <Mini label="Escrow" value="JobEscrow" addr={deployment.JobEscrow} />
            </div>
          </div>
        </Panel>

        {/* Spending policy */}
        <Panel title="Spending policy">
          <div className="px-4 py-3">
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
              tone="green"
            />

            {/* threshold rule, in plain terms */}
            <div className="mt-3 border border-border bg-bg px-3 py-2 rounded-[4px]">
              <div className="mono text-[11.5px] leading-relaxed text-muted">
                Jobs{" "}
                <span className="text-text">
                  ≤ {formatUsdc(policy.ownerApprovalThresholdUsdc)} USDC
                </span>{" "}
                settle autonomously. Above the threshold, the contract requires{" "}
                <span className="text-amber">ownerApproved</span> before{" "}
                <span className="text-text">createJob</span> succeeds. The demo job
                (75.00 USDC) is below the line, so no human sign-off is needed.
              </div>
            </div>
          </div>
        </Panel>

        {/* Decision history */}
        <Panel title="Decision history">
          <div className="divide-y divide-border">
            {decisions.map((j) => (
              <div key={j.jobId} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="mono text-[12px] text-text">
                    HIRE · Job #{j.jobId}
                  </span>
                  <span className="mono text-[12px] text-amber">
                    {formatUsdc(j.amount)}
                    <span className="ml-1 text-[10px] text-amber/70">USDC</span>
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="mono text-[11px] text-muted">
                    {j.worker ? (
                      <EnsLink name={j.worker} className="text-[11px]" />
                    ) : (
                      "unassigned"
                    )}
                  </span>
                  <span
                    className={`mono text-[11px] font-semibold ${
                      j.state === "SETTLED" ? "text-green" : "text-amber"
                    }`}
                  >
                    {j.state === "SETTLED" ? "SETTLED" : "IN FLIGHT"}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  {j.txCreate && <TxLink hash={j.txCreate} />}
                  {j.txSettle && <TxLink hash={j.txSettle} />}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Recent reasoning trace */}
        <Panel
          title="Recent reasoning trace"
          right={<span className="mono text-[11px] text-muted">last 12</span>}
        >
          <div className="px-3 py-2 ward-scroll overflow-auto" style={{ maxHeight: 320 }}>
            <div className="flex flex-col gap-[3px]">
              {trace.map((ev) => (
                <div key={ev.id} className="mono text-[11.5px] leading-snug">
                  <span className="text-muted">
                    [{mounted ? clock(ev.ts) : "--:--:--"}]
                  </span>{" "}
                  <span className={`${LOG_COLOR[ev.type]} font-semibold`}>
                    [{ev.type}]
                  </span>{" "}
                  <span className={LOG_COLOR[ev.type]}>{ev.message}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function PolicyRow({
  label,
  value,
  tone = "text",
  highlight = false,
}: {
  label: string;
  value: string;
  tone?: "text" | "green";
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${
        highlight ? "border-l-2 border-amber pl-2 -ml-2" : ""
      }`}
    >
      <span className="label">{label}</span>
      <span
        className={`mono text-[13px] ${
          tone === "green" ? "text-green" : highlight ? "text-amber" : "text-text"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Mini({
  label,
  value,
  addr,
}: {
  label: string;
  value: string;
  addr: string;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-0.5 mono text-[12px] text-text">{value}</div>
      <AddressLink address={addr} />
    </div>
  );
}
