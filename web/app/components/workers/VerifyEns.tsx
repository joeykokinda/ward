"use client";

import { useState } from "react";
import { ArrowUpRight, Check, RefreshCw, ShieldCheck } from "lucide-react";
import { ARC } from "@/lib/arc";

// Live ENS proof: a judge clicks a name and we resolve it server-side against
// Sepolia ENS (viem, /api/ens) right now — showing a fresh timestamp every
// click. That timestamp is the whole point: nothing on this page is hardcoded.

type EnsResult = {
  live: boolean;
  name?: string;
  address?: string | null;
  records?: {
    skills?: string[];
    region?: string;
    reputationPointer?: string;
    role?: string;
  };
  ensip25Verified?: boolean;
  resolvedAtIso?: string;
};

const NAMES = ["mike.ward-agent.eth", "ward-agent.eth"];

function fmtTime(iso?: string): string {
  if (!iso) return "";
  try {
    return `${new Date(iso).toLocaleTimeString("en-GB", { hour12: false })} UTC`;
  } catch {
    return iso;
  }
}

export function VerifyEns() {
  const [name, setName] = useState(NAMES[0]);
  const [result, setResult] = useState<EnsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);

  const verify = async (n: string) => {
    setName(n);
    setLoading(true);
    setErr(false);
    try {
      const r = (await fetch(`/api/ens/${encodeURIComponent(n)}`, { cache: "no-store" }).then((res) =>
        res.json(),
      )) as EnsResult;
      setResult(r);
      setErr(!r.live);
    } catch {
      setResult(null);
      setErr(true);
    }
    setLoading(false);
  };

  return (
    <div className="rounded-sm border border-accent/40 bg-surface card-shadow">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-accent-ink">
          <ShieldCheck className="h-4 w-4" strokeWidth={2} />
          Verify it&apos;s live, not hardcoded
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {NAMES.map((n) => (
            <button
              key={n}
              onClick={() => verify(n)}
              disabled={loading}
              className="mono inline-flex items-center gap-1.5 rounded-sm border border-border bg-subtle px-2.5 py-1.5 text-[11px] font-medium text-fg-soft transition-colors hover:border-border-strong disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading && name === n ? "animate-spin" : ""}`} strokeWidth={2} />
              Resolve {n}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3.5">
        {!result && !err && (
          <p className="text-[13px] leading-relaxed text-muted">
            Click a name to resolve it{" "}
            <span className="font-semibold text-fg-soft">live from Sepolia ENS, right now</span>. The
            timestamp updates on every click — proof nothing on this page is hardcoded.
          </p>
        )}

        {err && (
          <p className="text-[13px] leading-relaxed text-danger">
            Live resolution didn&apos;t return just now (public RPC can be slow). Click again, or verify
            yourself on the ENS app below — the records are real.
          </p>
        )}

        {result && result.live && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              <span className="inline-flex items-center gap-1 font-semibold text-success-ink">
                <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                Resolved live
              </span>
              <span className="text-faint">·</span>
              <span className="text-muted">Sepolia ENS via viem</span>
              <span className="text-faint">·</span>
              <span className="mono text-accent-ink">{fmtTime(result.resolvedAtIso)}</span>
              {result.ensip25Verified && (
                <>
                  <span className="text-faint">·</span>
                  <span className="font-semibold text-accent-ink">ENSIP-25 verified ✓</span>
                </>
              )}
            </div>

            <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-[160px_1fr] sm:gap-x-3">
              <Row label="Name" value={result.name} mono />
              <Row label="Address (resolved)" value={result.address ?? "—"} mono />
              {result.records?.role && <Row label="Role" value={result.records.role} />}
              {result.records?.skills?.length ? (
                <Row label="Skills" value={result.records.skills.join(", ")} />
              ) : null}
              {result.records?.region && <Row label="Region" value={result.records.region} />}
              {result.records?.reputationPointer && (
                <Row label="Reputation pointer" value={result.records.reputationPointer} mono />
              )}
            </dl>

            <p className="text-[11px] leading-relaxed text-faint">
              Fetched server-side with viem from the live Sepolia ENS contracts. Click a name again —
              the timestamp changes, because it&apos;s resolved fresh each time.
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`https://sepolia.app.ens.domains/${name}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-subtle px-2.5 py-1.5 text-[11px] font-medium text-fg-soft transition-colors hover:border-border-strong"
          >
            Verify on the ENS app
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
          <a
            href={`${ARC.explorer}/address/${ARC.registry}?tab=read_write_contract`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-subtle px-2.5 py-1.5 text-[11px] font-medium text-fg-soft transition-colors hover:border-border-strong"
          >
            Read reputationOf on Arc
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-faint sm:pt-0.5">{label}</dt>
      <dd className={`break-all text-[12.5px] text-fg-soft ${mono ? "mono" : ""}`}>{value}</dd>
    </>
  );
}
