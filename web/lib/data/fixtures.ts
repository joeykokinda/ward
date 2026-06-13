// Canonical pre-staged demo state — ONE homeowner's smart home.
// 4 instrumented devices healthy, 5 ENS techs (subnames + reputation) as the
// worker registry, agent = ward-agent.eth with 500 USDC, 3 completed jobs.

import { AGENT_ENS } from "../config";
import { usdc } from "../format";
import type {
  Activity,
  AgentEvent,
  AgentIdentity,
  DeviceKind,
  Job,
  PropertyStatus,
  Worker,
} from "./types";

// The single home everything lives in (apartment dweller).
export const HOME_REGION = "Brooklyn, NY";

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

// REAL Arc testnet tx hashes from the canonical ERC-8183 WardEscrow lifecycle
// (DEMO-EVIDENCE.md). Wired into the historical settled jobs so every tx link in
// the activity feed opens a real https://testnet.arcscan.app/tx/<hash> txn —
// not a synthetic hash. chainId 5042002, full Open→Funded→Submitted→Completed.
export const ARC_TX = {
  createJob: "0xe65a7352007bf269874f4bf83e138c67d29d24d9009facd083af296cbcebf217",
  setBudget: "0xb4875473ae81ba87b4a9424bf9c8ac743a02a69efea8d4601ab0e0cd44542bd4",
  fund: "0x1afb161733819d2004d24d10bf13312ba941e91394e9f3463a90df2240e01ea0",
  submit: "0x48d22cd077f7e32670a2589e977991a6917b511f3cc6c515449f72065360827a",
  complete: "0x0cf9c5a691225575de86937491fb6ae577c1f3e2b7a49959104a6c3a6084cb8d",
} as const;

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

// The four devices in the home. id == deviceId == propertyId so each device is
// tracked independently and the agent's one-open-job-per-property guard is
// effectively one-open-job-per-device.
export function buildProperties(): PropertyStatus[] {
  const base = isoHoursAgo(0);
  const mk = (
    deviceId: string,
    name: string,
    kind: DeviceKind,
    uptimeSec: number,
    signalDbm: number,
  ): PropertyStatus => ({
    id: deviceId,
    name,
    deviceId,
    deviceKind: kind,
    region: HOME_REGION,
    device: {
      deviceId,
      propertyId: deviceId,
      kind,
      online: true,
      uptimeSec,
      signalDbm,
      faultMode: "none",
      lastChangedIso: base,
    },
  });
  return [
    mk("home-wifi", "WiFi router", "router", 412_880, -52),
    mk("home-thermostat", "Thermostat", "thermostat", 268_140, -58),
    mk("home-lock", "Front-door lock", "lock", 99_360, -61),
    mk("home-leak", "Leak sensor", "leak_sensor", 540_120, 0),
  ];
}

// The five local techs registered with WARD. Skills cover the home's device
// kinds (plumber / network / hvac / locksmith) so dispatch-by-skill reads
// sensibly. mike is the highest-reputation PLUMBER -> picked for the HERO leak
// incident (the avatar shows "M").
export function buildWorkers(): Worker[] {
  const mk = (
    handle: string,
    skills: string[],
    reputation: number,
    completedJobs: number,
  ): Worker => ({
    handle,
    ensName: `${handle}.${AGENT_ENS}`,
    address: fakeAddress(`worker-${handle}`),
    skills,
    region: HOME_REGION,
    reputation,
    staked: true,
    stakeUsdc: usdc(100),
    completedJobs,
  });
  return [
    mk("mike", ["plumber", "leak", "pipefitting"], 98, 41),
    mk("sara", ["network", "router", "isp"], 91, 33),
    mk("deon", ["hvac", "thermostat"], 87, 28),
    mk("lena", ["plumber", "leak", "sensor"], 84, 22),
    mk("raj", ["network", "general", "locksmith"], 79, 17),
  ];
}

// 3 completed historical jobs so the feed is never empty — one per non-hero
// device, each settled to the matching-skill tech.
export function buildJobs(): Job[] {
  return [
    {
      jobId: 1041,
      propertyId: "home-thermostat",
      deviceId: "home-thermostat",
      worker: `deon.${AGENT_ENS}`,
      workerAddress: fakeAddress("worker-deon"),
      amount: usdc(60),
      state: "Completed",
      txCreate: ARC_TX.createJob,
      txAccept: ARC_TX.fund,
      txSettle: ARC_TX.complete,
      createdAtIso: isoHoursAgo(52),
      settledAtIso: isoHoursAgo(51),
      deadlineIso: isoHoursAgo(48),
    },
    {
      jobId: 1042,
      propertyId: "home-leak",
      deviceId: "home-leak",
      worker: `lena.${AGENT_ENS}`,
      workerAddress: fakeAddress("worker-lena"),
      amount: usdc(75),
      state: "Completed",
      txCreate: ARC_TX.setBudget,
      txAccept: ARC_TX.fund,
      txSettle: ARC_TX.submit,
      createdAtIso: isoHoursAgo(28),
      settledAtIso: isoHoursAgo(27),
      deadlineIso: isoHoursAgo(24),
    },
    {
      jobId: 1043,
      propertyId: "home-wifi",
      deviceId: "home-wifi",
      worker: `sara.${AGENT_ENS}`,
      workerAddress: fakeAddress("worker-sara"),
      amount: usdc(75),
      state: "Completed",
      // The full canonical lifecycle (most recent job): real create → fund → complete.
      txCreate: ARC_TX.createJob,
      txAccept: ARC_TX.fund,
      txSettle: ARC_TX.complete,
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
      txHash: ARC_TX.fund,
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
      message: "Home sweep complete · 4/4 devices online · all telemetry nominal",
    },
    {
      id: "ev-seed-2",
      ts: isoMinutesAgo(9),
      type: "MONITOR",
      message: "home-wifi uptime 4d 18h · signal -52dBm · within policy",
      propertyId: "home-wifi",
    },
    {
      id: "ev-seed-3",
      ts: isoHoursAgo(5),
      type: "RESOLVED",
      message: "Job #1043 settled · sara.ward-agent.eth paid 75.00 USDC · reputation 90 → 91",
      jobId: 1043,
      propertyId: "home-wifi",
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
