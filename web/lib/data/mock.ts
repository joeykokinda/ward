// Mock adapter: fully self-contained demo state + scripted incident player.
// No backend, no credentials. The scripted player drives the entire
// "Simulate: WiFi outage" hero sequence (your home WiFi dies at 2am) as a
// timed series of agent reasoning events, activity-feed entries, and job-bar
// lifecycle changes.
//
// The same WardAdapter interface will later be implemented against the live
// agent SSE feed + Arc contracts; this player is just one implementation.

import { usdc } from "../format";
import {
  buildActivity,
  buildAgent,
  buildEvents,
  buildJobs,
  buildProperties,
  buildWorkers,
  fakeTxHash,
} from "./fixtures";
import type {
  Activity,
  AgentEvent,
  Job,
  LogType,
  ScenarioId,
  WardAdapter,
  WardSnapshot,
  Worker,
} from "./types";

const DEMO_JOB_ID = 1044;
const DEMO_PROPERTY = "home-wifi"; // the hero device: your home WiFi router
const DEMO_DEVICE = "home-wifi";
const DEMO_SKILL = "network"; // dispatch to the highest-rep networking tech
const DEMO_AMOUNT = usdc(75);

// One scripted beat. `at` is ms offset from scenario start.
type Beat = {
  at: number;
  run: (s: MutableState) => void;
};

type MutableState = {
  snapshot: WardSnapshot;
};

let eventSeq = 0;
function nextId(prefix: string): string {
  eventSeq += 1;
  return `${prefix}-${Date.now()}-${eventSeq}`;
}

function freshSnapshot(): WardSnapshot {
  return {
    agent: buildAgent(),
    properties: buildProperties(),
    workers: buildWorkers(),
    jobs: buildJobs(),
    events: buildEvents(),
    activity: buildActivity(),
    activeJob: null,
  };
}

function pushEvent(
  s: MutableState,
  type: LogType,
  message: string,
  extra?: Partial<AgentEvent>,
) {
  const ev: AgentEvent = {
    id: nextId("ev"),
    ts: new Date().toISOString(),
    type,
    message,
    ...extra,
  };
  s.snapshot = { ...s.snapshot, events: [...s.snapshot.events, ev] };
}

function pushActivity(s: MutableState, a: Omit<Activity, "id" | "ts">) {
  const item: Activity = { id: nextId("act"), ts: new Date().toISOString(), ...a };
  s.snapshot = { ...s.snapshot, activity: [item, ...s.snapshot.activity] };
}

function setProperty(
  s: MutableState,
  propertyId: string,
  patch: Partial<WardSnapshot["properties"][number]["device"]>,
) {
  s.snapshot = {
    ...s.snapshot,
    properties: s.snapshot.properties.map((p) =>
      p.id === propertyId
        ? {
            ...p,
            device: { ...p.device, ...patch, lastChangedIso: new Date().toISOString() },
          }
        : p,
    ),
  };
}

function upsertJob(s: MutableState, job: Job) {
  const exists = s.snapshot.jobs.some((j) => j.jobId === job.jobId);
  const jobs = exists
    ? s.snapshot.jobs.map((j) => (j.jobId === job.jobId ? job : j))
    : [job, ...s.snapshot.jobs];
  const active =
    job.state === "Completed" ||
    job.state === "Rejected" ||
    job.state === "Expired"
      ? null
      : job;
  s.snapshot = { ...s.snapshot, jobs, activeJob: active };
}

function findJob(s: MutableState, jobId: number): Job | undefined {
  return s.snapshot.jobs.find((j) => j.jobId === jobId);
}

function setTreasury(s: MutableState, treasuryUsdc: string, spentTodayUsdc?: string) {
  s.snapshot = {
    ...s.snapshot,
    agent: {
      ...s.snapshot.agent,
      treasuryUsdc,
      policy: {
        ...s.snapshot.agent.policy,
        spentTodayUsdc: spentTodayUsdc ?? s.snapshot.agent.policy.spentTodayUsdc,
      },
    },
  };
}

function bumpReputation(s: MutableState, ensName: string): { from: number; to: number } {
  let from = 0;
  let to = 0;
  const workers: Worker[] = s.snapshot.workers.map((w) => {
    if (w.ensName === ensName) {
      from = w.reputation;
      to = w.reputation + 1;
      return { ...w, reputation: to, completedJobs: w.completedJobs + 1 };
    }
    return w;
  });
  s.snapshot = { ...s.snapshot, workers };
  return { from, to };
}

// The scripted WiFi-outage hero incident: your home WiFi dies at 2am.
// detect → reboot → fails → hire networking tech → open + fund ERC-8183 Job
// → dispatch. The field tech then submits the fix and the Evaluator confirms
// it (Open → Funded → Submitted → Completed).
function wifiOutageBeats(): Beat[] {
  const createTx = fakeTxHash(`job-${DEMO_JOB_ID}-create-${Date.now()}`);
  const acceptHintTx = fakeTxHash(`job-${DEMO_JOB_ID}-accepthint`);

  return [
    // 1. detect
    {
      at: 200,
      run: (s) => {
        setProperty(s, DEMO_PROPERTY, {
          online: false,
          faultMode: "hard",
          signalDbm: -120,
          uptimeSec: 0,
        });
        pushEvent(
          s,
          "MONITOR",
          "ALERT · home WiFi router (home-wifi) stopped responding · 3 missed heartbeats · 02:14 local",
          { propertyId: DEMO_PROPERTY },
        );
      },
    },
    // 2. diagnose
    {
      at: 1400,
      run: (s) =>
        pushEvent(
          s,
          "DIAGNOSE",
          "Telemetry: link down, no DHCP lease, last signal -120dBm · classifying fault",
          { propertyId: DEMO_PROPERTY },
        ),
    },
    {
      at: 2600,
      run: (s) =>
        pushEvent(
          s,
          "DIAGNOSE",
          "Fault profile matches power/firmware hang · L1 remote reboot is the cheapest fix",
          { propertyId: DEMO_PROPERTY },
        ),
    },
    // 2b. attempt remote reboot
    {
      at: 3800,
      run: (s) =>
        pushEvent(
          s,
          "ACTION",
          "Issuing remote reboot → POST /device/home-wifi/restart",
          { propertyId: DEMO_PROPERTY },
        ),
    },
    // 3. reboot FAILS (hard fault)
    {
      at: 5400,
      run: (s) =>
        pushEvent(
          s,
          "RESULT",
          "Remote reboot FAILED · WiFi still down after 3 attempts · fault is hardware/line",
          { propertyId: DEMO_PROPERTY },
        ),
    },
    // 4. query registry, select highest-rep worker by skill
    {
      at: 6600,
      run: (s) =>
        pushEvent(
          s,
          "DIAGNOSE",
          "Escalating to L3 (hire human) · querying WorkerRegistry via ENS for skill 'network'",
        ),
    },
    {
      at: 7800,
      run: (s) => {
        const candidates = dispatchCandidates(s);
        const top = candidates[0];
        pushEvent(
          s,
          "DISPATCH",
          `Ranked ${candidates.length} staked techs for 'network' · selected ${top.ensName} (rep ${top.reputation}, skills: ${top.skills.join("/")})`,
        );
      },
    },
    // 5. open + fund the ERC-8183 Job (75 USDC escrow on Arc)
    {
      at: 9200,
      run: (s) => {
        pushEvent(
          s,
          "ACTION",
          "75.00 USDC < 100.00 owner-approval threshold · opening + funding ERC-8183 Job autonomously",
        );
      },
    },
    {
      at: 10200,
      run: (s) => {
        const top = topWorker(s);
        const now = new Date();
        // ERC-8183: the agent opens the Job and funds the escrow in one
        // autonomous action -> the Job lands in the Funded state.
        const job: Job = {
          jobId: DEMO_JOB_ID,
          propertyId: DEMO_PROPERTY,
          deviceId: DEMO_DEVICE,
          worker: top.ensName,
          workerAddress: top.address,
          amount: DEMO_AMOUNT,
          state: "Funded",
          txCreate: createTx,
          txAccept: null,
          txSettle: null,
          createdAtIso: now.toISOString(),
          settledAtIso: null,
          deadlineIso: new Date(now.getTime() + 30 * 60_000).toISOString(),
        };
        upsertJob(s, job);
        setTreasury(s, usdc(425), usdc(75));
        pushEvent(
          s,
          "ESCROW",
          `Opened ERC-8183 Job #${DEMO_JOB_ID} and funded escrow · 75.00 USDC held on Arc · provider ${top.ensName}`,
          { jobId: DEMO_JOB_ID, txHash: createTx, propertyId: DEMO_PROPERTY },
        );
        pushActivity(s, {
          kind: "JOB_CREATED",
          label: `Job opened + funded · #${DEMO_JOB_ID}`,
          txHash: createTx,
          amountUsdc: DEMO_AMOUNT,
          jobId: DEMO_JOB_ID,
          ensName: top.ensName,
        });
      },
    },
    // 6. funded, waiting on the field tech — this is where the judge's phone takes over.
    {
      at: 11600,
      run: (s) => {
        const top = topWorker(s);
        pushEvent(
          s,
          "DISPATCH",
          `Job #${DEMO_JOB_ID} dispatched to ${top.ensName} · escrow funded · awaiting on-site fix + submission (Worker view)`,
          { jobId: DEMO_JOB_ID, txHash: acceptHintTx },
        );
      },
    },
  ];
}

// Highest-reputation staked tech whose skills match the WiFi fault (network).
function dispatchCandidates(s: MutableState): Worker[] {
  return s.snapshot.workers
    .filter((w) => w.staked && w.skills.includes(DEMO_SKILL))
    .sort((a, b) => b.reputation - a.reputation);
}

function topWorker(s: MutableState): Worker {
  return dispatchCandidates(s)[0];
}

class MockAdapter implements WardAdapter {
  readonly name = "mock" as const;
  private state: MutableState = { snapshot: freshSnapshot() };
  private listeners = new Set<() => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private running = false;

  getSnapshot(): WardSnapshot {
    return this.state.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isRunning(): boolean {
    return this.running;
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  runScenario(id: ScenarioId): void {
    if (id !== "wifi-outage") return;
    if (this.running) return;
    this.running = true;
    const beats = wifiOutageBeats();
    for (const beat of beats) {
      const t = setTimeout(() => {
        beat.run(this.state);
        this.emit();
      }, beat.at);
      this.timers.push(t);
    }
    // After the last scripted beat, the flow waits for the field tech to submit
    // the fix (from the Worker persona). If nobody touches it, an auto-pilot
    // finishes the cycle so the unattended Vercel demo self-recovers.
    const lastAt = beats[beats.length - 1].at;
    const autopilot = setTimeout(() => {
      const job = findJob(this.state, DEMO_JOB_ID);
      if (job && job.state === "Funded") {
        this.acceptJob(DEMO_JOB_ID, job.workerAddress ?? "");
        const done = setTimeout(() => {
          const j = findJob(this.state, DEMO_JOB_ID);
          if (j && j.state === "Funded") this.markJobComplete(DEMO_JOB_ID);
        }, 4000);
        this.timers.push(done);
      }
    }, lastAt + 9000);
    this.timers.push(autopilot);
    this.emit();
  }

  // ERC-8183 has no separate accept gate; a funded Job is claimed by its
  // provider. This records the field tech engaging (en route) while the Job
  // stays Funded, awaiting their on-site submission.
  acceptJob(jobId: number, workerAddress: string): void {
    const job = findJob(this.state, jobId);
    if (!job || job.state !== "Funded" || job.txAccept) return;
    const worker =
      this.state.snapshot.workers.find((w) => w.address === workerAddress) ??
      this.state.snapshot.workers.find((w) => w.ensName === job.worker);
    const ensName = worker?.ensName ?? job.worker ?? "worker.ward-agent.eth";
    const acceptTx = fakeTxHash(`job-${jobId}-accept-${Date.now()}`);
    upsertJob(this.state, {
      ...job,
      worker: ensName,
      workerAddress: worker?.address ?? job.workerAddress,
      state: "Funded",
      txAccept: acceptTx,
    });
    pushEvent(
      this.state,
      "DISPATCH",
      `${ensName} claimed funded Job #${jobId} · en route to the home`,
      { jobId, txHash: acceptTx, propertyId: job.propertyId },
    );
    pushActivity(this.state, {
      kind: "JOB_ACCEPTED",
      label: `Provider en route · #${jobId}`,
      txHash: acceptTx,
      ensName,
      jobId,
    });
    this.emit();
  }

  markJobComplete(jobId: number): void {
    const job = findJob(this.state, jobId);
    if (!job || job.state !== "Funded") return;
    // ERC-8183: the field tech SUBMITS the fix (Funded -> Submitted). The device
    // recovers, then the Evaluator (the sensor/CRE) confirms it and the escrow
    // releases payment (Submitted -> Completed).
    const submitTx = fakeTxHash(`job-${jobId}-submit-${Date.now()}`);
    upsertJob(this.state, { ...job, state: "Submitted", txAccept: job.txAccept });
    pushEvent(
      this.state,
      "RESULT",
      `${job.worker} SUBMITTED the fix on Job #${jobId} · router line replaced + firmware reflashed`,
      { jobId, txHash: submitTx, propertyId: job.propertyId },
    );
    pushActivity(this.state, {
      kind: "WORK_DONE",
      label: `Fix submitted · #${jobId}`,
      txHash: submitTx,
      ensName: job.worker ?? undefined,
      jobId,
    });
    this.emit();

    // device comes back online (the human fix)
    const onlineTimer = setTimeout(() => {
      setProperty(this.state, job.propertyId, {
        online: true,
        faultMode: "none",
        signalDbm: -57,
        uptimeSec: 30,
      });
      pushEvent(
        this.state,
        "MONITOR",
        "Device telemetry recovering · home-wifi back online · signal -57dBm",
        { jobId, propertyId: job.propertyId },
      );
      this.emit();
    }, 1500);
    this.timers.push(onlineTimer);

    // the Evaluator (sensor/CRE) confirms the physical-world fact
    const attestTimer = setTimeout(() => {
      const attestTx = fakeTxHash(`job-${jobId}-attest-${Date.now()}`);
      pushEvent(
        this.state,
        "DIAGNOSE",
        "Evaluator (Chainlink CRE) read the device endpoint · online === true · faultMode === none · confirming submission",
        { jobId, txHash: attestTx, propertyId: job.propertyId },
      );
      pushActivity(this.state, {
        kind: "ATTESTED",
        label: `Evaluator confirmed · #${jobId}`,
        txHash: attestTx,
        jobId,
      });
      this.emit();
    }, 3500);
    this.timers.push(attestTimer);

    // Evaluator confirmation marks the Job Completed -> escrow releases payment.
    const settleTimer = setTimeout(() => {
      const cur = findJob(this.state, jobId);
      if (!cur) return;
      const settleTx = fakeTxHash(`job-${jobId}-settle-${Date.now()}`);
      const ensName = cur.worker ?? "worker.ward-agent.eth";
      const rep = bumpReputation(this.state, ensName);
      upsertJob(this.state, {
        ...cur,
        state: "Completed",
        txSettle: settleTx,
        settledAtIso: new Date().toISOString(),
      });
      pushEvent(
        this.state,
        "ESCROW",
        `Evaluator confirmed onchain · Job #${jobId} COMPLETED · escrow released · 75.00 USDC → ${ensName}`,
        { jobId, txHash: settleTx, propertyId: cur.propertyId },
      );
      pushActivity(this.state, {
        kind: "JOB_SETTLED",
        label: `Payment released · #${jobId}`,
        txHash: settleTx,
        amountUsdc: cur.amount,
        ensName,
        jobId,
      });
      pushActivity(this.state, {
        kind: "REPUTATION_BUMP",
        label: `Reputation ${rep.from} → ${rep.to} · ${ensName}`,
        txHash: fakeTxHash(`job-${jobId}-rep-${Date.now()}`),
        ensName,
        jobId,
      });
      pushEvent(
        this.state,
        "RESOLVED",
        `Job #${jobId} COMPLETED · ${ensName} paid 75.00 USDC · reputation ${rep.from} → ${rep.to} · home WiFi HEALTHY`,
        { jobId, txHash: settleTx, propertyId: cur.propertyId },
      );
      this.running = false;
      this.emit();
    }, 5500);
    this.timers.push(settleTimer);
  }

  reset(): void {
    this.clearTimers();
    this.running = false;
    this.state = { snapshot: freshSnapshot() };
    this.emit();
  }
}

export function createMockAdapter(): WardAdapter {
  return new MockAdapter();
}
