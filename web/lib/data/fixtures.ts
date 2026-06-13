// Canonical pre-staged demo state (DEMO.md + INTERFACES.md).
// 3 properties healthy, 5 workers with ENS subnames + reputation,
// agent = ward-agent.eth with 500 USDC, 3+ completed historical jobs.

import { AGENT_ENS } from "../config";
import { usdc } from "../format";
import type {
  Activity,
  AgentEvent,
  AgentIdentity,
  Job,
  PropertyStatus,
  Worker,
} from "./types";

// Deterministic but realistic-looking fake tx hashes (0x + 64 hex).
export function fakeTxHash(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let out = "";
  let x = h >>> 0;
  for (let i = 0; i < 64; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out += (x & 0xf).toString(16);
  }
  return `0x${out}`;
}

export function fakeAddress(seed: string): string {
  const full = fakeTxHash(seed);
  return `0x${full.slice(2, 42)}`;
}

const AGENT_ADDRESS = "0xWa2d10A9e7f3b1c4D58e96Fa0bB7cC83d4E2f1A6";

function isoMinutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

function isoHoursAgo(hr: number): string {
  return new Date(Date.now() - hr * 3_600_000).toISOString();
}

export function buildAgent(): AgentIdentity {
  return {
    ensName: AGENT_ENS,
    address: AGENT_ADDRESS,
    treasuryUsdc: usdc(500),
    policy: {
      perJobCapUsdc: usdc(150),
      dailyCapUsdc: usdc(400),
      ownerApprovalThresholdUsdc: usdc(100),
      spentTodayUsdc: usdc(0),
    },
  };
}

export function buildProperties(): PropertyStatus[] {
  const base = isoHoursAgo(0);
  const mk = (
    id: string,
    name: string,
    region: string,
    uptimeSec: number,
    signalDbm: number,
  ): PropertyStatus => ({
    id,
    name,
    deviceId: `${id}-router`,
    deviceKind: "router",
    region,
    device: {
      deviceId: `${id}-router`,
      propertyId: id,
      kind: "router",
      online: true,
      uptimeSec,
      signalDbm,
      faultMode: "none",
      lastChangedIso: base,
    },
  });
  return [
    mk("prop-1", "The Brooklyn Loft", "Brooklyn, NY", 412_880, -52),
    mk("prop-2", "Greenwich Cottage", "Greenwich, CT", 268_140, -58),
    mk("prop-3", "Hudson Studio", "Hudson, NY", 99_360, -61),
  ];
}

export function buildWorkers(): Worker[] {
  const mk = (
    handle: string,
    skills: string[],
    region: string,
    reputation: number,
    completedJobs: number,
  ): Worker => ({
    handle,
    ensName: `${handle}.${AGENT_ENS}`,
    address: fakeAddress(`worker-${handle}`),
    skills,
    region,
    reputation,
    staked: true,
    stakeUsdc: usdc(100),
    completedJobs,
  });
  // mike highest reputation in Greenwich region -> picked in the scripted flow.
  return [
    mk("mike", ["network", "router", "hardware"], "Greenwich, CT", 98, 41),
    mk("sara", ["network", "smart-lock"], "Stamford, CT", 91, 33),
    mk("deon", ["hardware", "hvac"], "Brooklyn, NY", 87, 28),
    mk("lena", ["network", "sensor"], "Hudson, NY", 84, 22),
    mk("raj", ["router", "general"], "Greenwich, CT", 79, 17),
  ];
}

// 3+ completed historical jobs so the feed is never empty.
export function buildJobs(): Job[] {
  return [
    {
      jobId: 1041,
      propertyId: "prop-1",
      deviceId: "prop-1-router",
      worker: `deon.${AGENT_ENS}`,
      workerAddress: fakeAddress("worker-deon"),
      amount: usdc(60),
      state: "SETTLED",
      txCreate: fakeTxHash("job-1041-create"),
      txAccept: fakeTxHash("job-1041-accept"),
      txSettle: fakeTxHash("job-1041-settle"),
      createdAtIso: isoHoursAgo(52),
      settledAtIso: isoHoursAgo(51),
      deadlineIso: isoHoursAgo(48),
    },
    {
      jobId: 1042,
      propertyId: "prop-3",
      deviceId: "prop-3-router",
      worker: `lena.${AGENT_ENS}`,
      workerAddress: fakeAddress("worker-lena"),
      amount: usdc(75),
      state: "SETTLED",
      txCreate: fakeTxHash("job-1042-create"),
      txAccept: fakeTxHash("job-1042-accept"),
      txSettle: fakeTxHash("job-1042-settle"),
      createdAtIso: isoHoursAgo(28),
      settledAtIso: isoHoursAgo(27),
      deadlineIso: isoHoursAgo(24),
    },
    {
      jobId: 1043,
      propertyId: "prop-2",
      deviceId: "prop-2-router",
      worker: `mike.${AGENT_ENS}`,
      workerAddress: fakeAddress("worker-mike"),
      amount: usdc(75),
      state: "SETTLED",
      txCreate: fakeTxHash("job-1043-create"),
      txAccept: fakeTxHash("job-1043-accept"),
      txSettle: fakeTxHash("job-1043-settle"),
      createdAtIso: isoHoursAgo(6),
      settledAtIso: isoHoursAgo(5),
      deadlineIso: isoHoursAgo(2),
    },
  ];
}

// Seed activity feed derived from the historical jobs + treasury top-up.
export function buildActivity(): Activity[] {
  const items: Activity[] = [
    {
      id: "act-fund",
      ts: isoHoursAgo(72),
      kind: "TREASURY_FUNDED",
      label: "Treasury funded",
      txHash: fakeTxHash("treasury-fund"),
      amountUsdc: usdc(500),
      ensName: AGENT_ENS,
    },
  ];
  const jobs = buildJobs();
  for (const job of jobs) {
    items.push({
      id: `act-${job.jobId}-create`,
      ts: job.createdAtIso,
      kind: "JOB_CREATED",
      label: `Escrow opened · #${job.jobId}`,
      txHash: job.txCreate!,
      amountUsdc: job.amount,
      jobId: job.jobId,
    });
    items.push({
      id: `act-${job.jobId}-settle`,
      ts: job.settledAtIso!,
      kind: "JOB_SETTLED",
      label: `Settled to worker · #${job.jobId}`,
      txHash: job.txSettle!,
      amountUsdc: job.amount,
      ensName: job.worker!,
      jobId: job.jobId,
    });
  }
  // newest first
  return items.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
}

// A few historical reasoning events so the stream is not blank pre-incident.
export function buildEvents(): AgentEvent[] {
  const events: AgentEvent[] = [
    {
      id: "ev-seed-1",
      ts: isoMinutesAgo(14),
      type: "MONITOR",
      message: "Fleet sweep complete · 3/3 devices online · all telemetry nominal",
    },
    {
      id: "ev-seed-2",
      ts: isoMinutesAgo(9),
      type: "MONITOR",
      message: "prop-1-router uptime 4d 18h · signal -52dBm · within policy",
      propertyId: "prop-1",
    },
    {
      id: "ev-seed-3",
      ts: isoHoursAgo(5),
      type: "RESOLVED",
      message: "Job #1043 settled · mike.ward-agent.eth paid 75.00 USDC · reputation 97 → 98",
      jobId: 1043,
      propertyId: "prop-2",
    },
    {
      id: "ev-seed-4",
      ts: isoMinutesAgo(2),
      type: "MONITOR",
      message: "Heartbeat OK · next sweep in 30s · treasury 500.00 USDC",
    },
  ];
  return events.sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
}
