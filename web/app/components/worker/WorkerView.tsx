"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Star } from "lucide-react";
import type { DeviceKind, Job, WardSnapshot, Worker } from "@/lib/data/types";
import { JOB_STATE_LABEL } from "@/lib/config";
import { formatDuration, formatUsdc, secondsSince } from "@/lib/format";
import { EnsLink, TxLink } from "../links";
import { Chip, Panel, jobStateTone } from "../primitives";

// Mobile-first single column. Renders on a judge's phone via QR.
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
    <div className="min-h-0 flex-1 overflow-auto ward-scroll bg-bg">
      <div className="mx-auto w-full max-w-md px-4 py-5">
        {/* identity / reputation header */}
        <Panel className="overflow-hidden">
          <div className="px-5 py-4">
            <div className="text-[12px] text-muted">Signed in as</div>
            <div className="mt-0.5">
              <EnsLink name={me.ensName} className="text-[17px]" />
            </div>

            <div className="mt-4 flex items-stretch gap-3">
              <div className="flex-1 rounded-lg bg-accent-soft px-3.5 py-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-accent-ink">
                  <Star className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                  Reputation
                </div>
                <div className="mono mt-1 text-[26px] font-bold leading-none text-accent-ink">
                  {me.reputation}
                </div>
              </div>
              <div className="flex-1 rounded-lg bg-subtle px-3.5 py-3">
                <div className="text-[11px] font-medium text-muted">Jobs done</div>
                <div className="mono mt-1 text-[26px] font-bold leading-none text-fg">
                  {me.completedJobs}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Region
                </div>
                <div className="mt-0.5 text-fg-soft">{me.region}</div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Staked
                </div>
                <div className="mono mt-0.5 text-fg-soft">
                  {formatUsdc(me.stakeUsdc)} USDC
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
                Skills
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {me.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-subtle px-2.5 py-1 text-[12px] font-medium text-fg-soft"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* worker switcher (demo convenience) */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {snapshot.workers.map((w) => {
            const active = w.ensName === me.ensName;
            return (
              <button
                key={w.ensName}
                onClick={() => setActiveHandle(w.ensName)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  active
                    ? "bg-accent text-white"
                    : "bg-surface text-muted ring-1 ring-border hover:bg-subtle"
                }`}
              >
                {w.handle}
              </button>
            );
          })}
        </div>

        {/* available / active jobs */}
        <h2 className="mt-6 mb-2.5 text-[13px] font-semibold text-fg-soft">
          Jobs at homes near you
        </h2>
        <div className="flex flex-col gap-3">
          {myJobs.length === 0 && (
            <Panel>
              <div className="px-5 py-8 text-center text-[13px] text-muted">
                No open jobs. You are on standby.
              </div>
            </Panel>
          )}
          {myJobs.map((job) => (
            <WorkerJobCard
              key={job.jobId}
              job={job}
              me={me}
              deviceKind={
                snapshot.properties.find((p) => p.id === job.propertyId)?.deviceKind
              }
              now={now}
              mounted={mounted}
              onAccept={onAccept}
              onComplete={onComplete}
            />
          ))}
        </div>

        {/* recent payouts */}
        {settled.length > 0 && (
          <>
            <h2 className="mt-7 mb-2.5 text-[13px] font-semibold text-fg-soft">
              Recent payouts
            </h2>
            <Panel bodyClassName="divide-y divide-border">
              {settled.map((j) => (
                <div
                  key={j.jobId}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <div className="text-[13px] font-medium text-fg">
                      Job #{j.jobId}
                    </div>
                    {j.txSettle && <TxLink hash={j.txSettle} />}
                  </div>
                  <span className="mono text-[15px] font-semibold text-accent-ink">
                    +{formatUsdc(j.amount)}
                    <span className="ml-1 font-sans text-[10px] font-medium text-muted">
                      USDC
                    </span>
                  </span>
                </div>
              ))}
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}

// Human-readable framing for each device kind, from the worker's perspective.
const JOB_TITLE: Record<DeviceKind, string> = {
  router: "WiFi outage at a home nearby",
  thermostat: "Thermostat fault at a home nearby",
  lock: "Smart lock fault at a home nearby",
  leak_sensor: "Water leak at a home nearby",
};

const JOB_DESC: Record<DeviceKind, string> = {
  router: "WiFi offline · remote reboot failed · on-site repair required.",
  thermostat: "Thermostat unresponsive · remote reconfig failed · on-site HVAC fix needed.",
  lock: "Smart lock offline · remote restart failed · on-site locksmith needed.",
  leak_sensor: "Leak detected · physical fault · plumber needed on-site.",
};

function WorkerJobCard({
  job,
  me,
  deviceKind,
  now,
  mounted,
  onAccept,
  onComplete,
}: {
  job: Job;
  me: Worker;
  deviceKind?: DeviceKind;
  now: number;
  mounted: boolean;
  onAccept: (jobId: number, workerAddress: string) => void;
  onComplete: (jobId: number) => void;
}) {
  const tone = jobStateTone(job.state);
  const elapsed = mounted ? formatDuration(secondsSince(job.createdAtIso, now)) : "0s";
  const canAccept = job.state === "OPEN";
  const canComplete = job.state === "ACCEPTED" && job.worker === me.ensName;
  const inProgress = job.state === "WORK_DONE" || job.state === "ATTESTING";
  const title = deviceKind ? JOB_TITLE[deviceKind] : "Repair at a home nearby";
  const desc = deviceKind
    ? JOB_DESC[deviceKind]
    : "Remote fix failed · on-site repair required.";

  return (
    <Panel>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-fg">{title}</span>
          <Chip tone={tone}>{JOB_STATE_LABEL[job.state]}</Chip>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <span className="mono text-[32px] font-bold leading-none text-fg">
            {formatUsdc(job.amount)}
            <span className="ml-1.5 font-sans text-[13px] font-medium text-muted">
              USDC
            </span>
          </span>
          <span className="flex items-center gap-1 text-[12px] text-muted">
            <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
            2.4 mi · {elapsed} ago
          </span>
        </div>

        <p className="mt-2.5 text-[13px] text-muted">{desc}</p>

        {/* big touch targets */}
        <div className="mt-4">
          {canAccept && (
            <button
              onClick={() => onAccept(job.jobId, me.address)}
              className="w-full rounded-xl bg-accent py-3.5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover active:scale-[0.99]"
            >
              Accept job
            </button>
          )}
          {canComplete && (
            <button
              onClick={() => onComplete(job.jobId)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover active:scale-[0.99]"
            >
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} />
              Mark complete
            </button>
          )}
          {inProgress && (
            <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-subtle py-3.5 text-[13px] font-medium text-muted">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              CRE verifying fix · escrow releases on attestation
            </div>
          )}
        </div>

        {job.txCreate && (
          <div className="mt-3 flex items-center justify-between text-[12px] text-muted">
            <span>Escrow tx</span>
            <TxLink hash={job.txCreate} />
          </div>
        )}
      </div>
    </Panel>
  );
}
