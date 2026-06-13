"use client";

import type { ReactNode } from "react";
import { ArrowUpRight, FileCheck2, Lock, ShieldCheck } from "lucide-react";
import type { Activity, Job, WardSnapshot } from "@/lib/data/types";
import { deployment, explorerAddressUrl, explorerTxUrl } from "@/lib/config";
import { formatUsdc, shortHash, timeAgo } from "@/lib/format";
import { SponsorBadge } from "./SponsorBadge";

// On-chain proof: the focal job's escrow-created + settled transactions, each a
// real verifiable Arc tx, next to a link to the source-verified WardEscrow
// contract. Below, the latest events as a human-readable ledger. This is the
// "it really happened on-chain" panel.
export function OnChainStrip({
  snapshot,
  now,
  mounted,
}: {
  snapshot: WardSnapshot;
  now: number;
  mounted: boolean;
}) {
  const job = focalJob(snapshot);
  const latest = snapshot.activity.slice(0, 3);

  return (
    <div className="rounded-sm border border-border bg-surface card-shadow">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          On-chain proof
        </span>
        <a
          href={explorerAddressUrl(deployment.JobEscrow)}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-1.5 text-[11px] font-medium text-success-ink transition-colors hover:text-success"
        >
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
          WardEscrow verified on Arc
          <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
        </a>
      </div>

      {/* the two money moments for the focal job */}
      {job && (
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
          <ProofRow
            Icon={Lock}
            tone="accent"
            label="Escrow created"
            sub={`${formatUsdc(job.amount)} USDC locked${job.worker ? ` for ${job.worker}` : ""}`}
            tx={job.txCreate}
            badge={
              <SponsorBadge
                sponsor="Arc"
                label="conditional USDC escrow · contract verified"
                href={explorerAddressUrl(deployment.JobEscrow)}
              />
            }
          />
          <ProofRow
            Icon={FileCheck2}
            tone={job.txSettle ? "success" : "muted"}
            label={job.txSettle ? "Settled on-chain" : "Awaiting settlement"}
            sub={
              job.txSettle
                ? `${formatUsdc(job.amount)} USDC released by the CRE attestation`
                : "Released automatically when the sensor attests the fix"
            }
            tx={job.txSettle}
          />
        </div>
      )}

      {/* live ledger: latest three, human-readable */}
      <div className="border-t border-border">
        <div className="px-4 pt-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-faint">
          Latest activity · Arc testnet
        </div>
        <div className="grid grid-cols-1 gap-px bg-border p-px sm:grid-cols-3">
          {latest.map((a) => (
            <a
              key={a.id}
              href={explorerTxUrl(a.txHash)}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col gap-1 bg-surface px-3.5 py-3 transition-colors hover:bg-subtle"
            >
              <span className="text-[12.5px] font-medium leading-snug text-fg-soft">
                {readableLabel(a)}
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className="mono text-[11px] text-faint group-hover:text-muted">
                  {shortHash(a.txHash)}
                  <ArrowUpRight className="ml-1 inline h-3 w-3 align-[-1px]" strokeWidth={2} />
                </span>
                <span className="text-[11px] text-faint">
                  {mounted ? timeAgo(a.ts, now) : ""}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProofRow({
  Icon,
  tone,
  label,
  sub,
  tx,
  chain = "Arc",
  badge,
}: {
  Icon: typeof Lock;
  tone: "accent" | "success" | "muted";
  label: string;
  sub: string;
  tx: string | null;
  chain?: string;
  badge?: ReactNode;
}) {
  const ink =
    tone === "accent" ? "text-accent-ink" : tone === "success" ? "text-success-ink" : "text-faint";
  return (
    <div className="flex items-start gap-3 bg-surface px-4 py-3.5">
      <span className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-sm bg-subtle ${ink}`}>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-[12px] font-semibold ${ink}`}>{label}</span>
          {tx && (
            <a
              href={explorerTxUrl(tx)}
              target="_blank"
              rel="noreferrer"
              title="Verified on arcscan · click to open"
              className="mono inline-flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-muted"
            >
              {shortHash(tx)}
              <span className="text-faint">· {chain}</span>
              <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
            </a>
          )}
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">{sub}</p>
        {badge && <div className="mt-2">{badge}</div>}
      </div>
    </div>
  );
}

// The job in focus: the active one, else the most recently settled.
function focalJob(s: WardSnapshot): Job | undefined {
  if (s.activeJob) return s.activeJob;
  return [...s.jobs]
    .filter((j) => j.txCreate)
    .sort(
      (a, b) =>
        new Date(b.settledAtIso ?? b.createdAtIso).getTime() -
        new Date(a.settledAtIso ?? a.createdAtIso).getTime(),
    )[0];
}

function readableLabel(a: Activity): string {
  const amt = a.amountUsdc ? `${formatUsdc(a.amountUsdc)} USDC` : "";
  const who = a.ensName ?? "the worker";
  switch (a.kind) {
    case "JOB_CREATED":
      return `Smart contract locked ${amt} in escrow`;
    case "JOB_ACCEPTED":
      return `Hired ${who}`;
    case "WORK_DONE":
      return `${who} submitted the fix`;
    case "ATTESTED":
      return "Chainlink CRE attested the fix";
    case "JOB_SETTLED":
      return `Released ${amt} to ${who}`;
    case "REPUTATION_BUMP":
      return `${who} reputation +1`;
    case "TREASURY_FUNDED":
      return `Treasury funded ${amt}`;
    default:
      return a.label;
  }
}
