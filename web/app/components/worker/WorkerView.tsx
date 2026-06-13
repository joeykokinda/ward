"use client";

import { useMemo, useState } from "react";
import type { Job, WardSnapshot, Worker } from "@/lib/data/types";
import { JOB_STATE_LABEL } from "@/lib/config";
import { formatDuration, formatUsdc, secondsSince } from "@/lib/format";
import { EnsLink, TxLink } from "../links";
import { Dot, Panel, jobStateTone } from "../primitives";

// Mobile-first single column. Renders on a judge's phone via QR.
// The judge "becomes" the selected worker (default: the highest-rep one,
// which is who the agent dispatched to).
export function WorkerView({
  snapshot,
  now,
  mounted,
  onAccept,
  onComplete,
}: {
  snapshot: WardSnapshot;
  now: number;
  mounted: boolean;
  onAccept: (jobId: number, workerAddress: string) => void;
  onComplete: (jobId: number) => void;
}) {
  // pick the worker the demo dispatches to, else highest reputation overall
  const defaultWorker = useMemo(() => {
    const dispatched = snapshot.jobs.find(
      (j) => j.state !== "SETTLED" && j.worker,
    )?.worker;
    if (dispatched) {
      const w = snapshot.workers.find((x) => x.ensName === dispatched);
      if (w) return w;
    }
    return [...snapshot.workers].sort((a, b) => b.reputation - a.reputation)[0];
  }, [snapshot.jobs, snapshot.workers]);

  const [activeHandle, setActiveHandle] = useState(defaultWorker.ensName);
  const me: Worker =
    snapshot.workers.find((w) => w.ensName === activeHandle) ?? defaultWorker;

  // jobs visible to me: anything dispatched to me, or any open job.
  const myJobs = snapshot.jobs.filter(
    (j) =>
      (j.worker === me.ensName || j.state === "OPEN") &&
      j.state !== "SETTLED" &&
      j.state !== "EXPIRED" &&
      j.state !== "REFUNDED",
  );
  const settled = snapshot.jobs
    .filter((j) => j.worker === me.ensName && j.state === "SETTLED")
    .slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-md flex-1 px-3 py-3 ward-scroll overflow-auto">
      {/* identity / reputation header */}
      <Panel className="mb-3">
        <div className="px-4 py-3">
          <div className="label">Signed in as</div>
          <div className="mt-1 mono text-[16px] text-text">
            <EnsLink name={me.ensName} className="text-[16px]" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Reputation" value={me.reputation.toString()} tone="green" big />
            <Stat label="Jobs done" value={me.completedJobs.toString()} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Region" value={me.region} mono={false} />
            <Stat label="Staked" value={`${formatUsdc(me.stakeUsdc)} USDC`} />
          </div>
          <div className="mt-3">
            <div className="label">Skills</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {me.skills.map((s) => (
                <span
                  key={s}
                  className="border border-border bg-bg px-2 py-0.5 rounded-[4px] mono text-[11px] text-text"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {/* worker switcher (demo convenience; QR target usually picks one) */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {snapshot.workers.map((w) => (
          <button
            key={w.ensName}
            onClick={() => setActiveHandle(w.ensName)}
            className={`border px-2 py-1 rounded-[4px] mono text-[11px] ${
              w.ensName === me.ensName
                ? "border-amber/60 bg-amber/10 text-amber"
                : "border-border bg-bg text-muted hover:text-text"
            }`}
          >
            {w.handle}
          </button>
        ))}
      </div>

      {/* available / active jobs */}
      <div className="mb-2 label">Available jobs near you</div>
      <div className="flex flex-col gap-3">
        {myJobs.length === 0 && (
          <Panel>
            <div className="px-4 py-6 text-center mono text-[12px] text-muted">
              No open jobs. You are on standby.
            </div>
          </Panel>
        )}
        {myJobs.map((job) => (
          <WorkerJobCard
            key={job.jobId}
            job={job}
            me={me}
            property={snapshot.properties.find((p) => p.id === job.propertyId)?.name}
            now={now}
            mounted={mounted}
            onAccept={onAccept}
            onComplete={onComplete}
          />
        ))}
      </div>

      {/* my recent settled jobs */}
      {settled.length > 0 && (
        <>
          <div className="mt-5 mb-2 label">Recent payouts</div>
          <Panel>
            <div className="divide-y divide-border">
              {settled.map((j) => (
                <div
                  key={j.jobId}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <div>
                    <div className="mono text-[12px] text-text">Job #{j.jobId}</div>
                    {j.txSettle && <TxLink hash={j.txSettle} />}
                  </div>
                  <span className="mono text-[13px] text-amber">
                    +{formatUsdc(j.amount)}
                    <span className="ml-1 text-[10px] text-amber/70">USDC</span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function WorkerJobCard({
  job,
  me,
  property,
  now,
  mounted,
  onAccept,
  onComplete,
}: {
  job: Job;
  me: Worker;
  property?: string;
  now: number;
  mounted: boolean;
  onAccept: (jobId: number, workerAddress: string) => void;
  onComplete: (jobId: number) => void;
}) {
  const tone = jobStateTone(job.state);
  const elapsed = mounted ? formatDuration(secondsSince(job.createdAtIso, now)) : "0s";
  const canAccept = job.state === "OPEN";
  const canComplete = job.state === "ACCEPTED" && job.worker === me.ensName;
  const inProgress =
    job.state === "WORK_DONE" || job.state === "ATTESTING";

  return (
    <Panel>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="mono text-[14px] text-text">
            {property ?? job.propertyId}
          </span>
          <span className="flex items-center gap-1.5">
            <Dot tone={tone} />
            <span
              className={`mono text-[11px] font-semibold ${
                tone === "green"
                  ? "text-green"
                  : tone === "red"
                    ? "text-red"
                    : "text-amber"
              }`}
            >
              {JOB_STATE_LABEL[job.state]}
            </span>
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <span className="mono text-[26px] font-bold text-amber leading-none">
            {formatUsdc(job.amount)}
            <span className="ml-1.5 text-[12px] text-amber/70">USDC</span>
          </span>
          <span className="mono text-[11px] text-muted">~2.4 mi · {elapsed} ago</span>
        </div>

        <div className="mt-2 mono text-[12px] text-muted">
          Router offline · remote reboot failed · on-site repair required
        </div>

        {/* big touch targets */}
        <div className="mt-3">
          {canAccept && (
            <button
              onClick={() => onAccept(job.jobId, me.address)}
              className="w-full border border-green/60 bg-green/10 py-3 rounded-[4px] text-green mono text-[14px] font-bold tracking-wide hover:bg-green/20 active:scale-[0.99]"
            >
              ACCEPT JOB
            </button>
          )}
          {canComplete && (
            <button
              onClick={() => onComplete(job.jobId)}
              className="w-full border border-amber/60 bg-amber/10 py-3 rounded-[4px] text-amber mono text-[14px] font-bold tracking-wide hover:bg-amber/20 active:scale-[0.99]"
            >
              MARK COMPLETE
            </button>
          )}
          {inProgress && (
            <div className="w-full border border-blue/40 bg-blue/5 py-3 rounded-[4px] text-blue mono text-[12px] text-center">
              CRE verifying fix · escrow releases on attestation…
            </div>
          )}
        </div>

        {job.txCreate && (
          <div className="mt-2 flex items-center justify-between">
            <span className="label">Escrow tx</span>
            <TxLink hash={job.txCreate} />
          </div>
        )}
      </div>
    </Panel>
  );
}

function Stat({
  label,
  value,
  tone = "text",
  mono = true,
  big = false,
}: {
  label: string;
  value: string;
  tone?: "text" | "green" | "amber";
  mono?: boolean;
  big?: boolean;
}) {
  const color =
    tone === "green" ? "text-green" : tone === "amber" ? "text-amber" : "text-text";
  return (
    <div>
      <div className="label">{label}</div>
      <div
        className={`${mono ? "mono" : ""} mt-0.5 ${big ? "text-[22px] font-bold" : "text-[13px]"} ${color}`}
      >
        {value}
      </div>
    </div>
  );
}
