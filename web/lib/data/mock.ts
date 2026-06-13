// Mock adapter: fully self-contained demo state + scripted incident player.
// No backend, no credentials. The scripted player drives the entire cinematic
// hero sequence as a timed series of agent reasoning events, activity-feed
// entries, device-telemetry changes, and job-bar lifecycle changes.
//
// HERO incident = the LEAK. Story: 2am, the homeowner is asleep in Tokyo, a
// pipe lets go in their Brooklyn apartment. The leak sensor trips, WARD can't
// fix water remotely, so it hires a verified plumber (Mike) and funds a
// ~150 USDC ERC-8183 escrow autonomously. The floor plan, the reasoning stream,
// and the activity feed all read from THIS one state machine.
//
// The other three devices (WiFi / thermostat / lock) are independently
// kill-able through the same generalized incident, so the floor plan stays
// interactive during judging.
//
// The same WardAdapter interface is implemented against the live agent feed +
// Arc contracts; this player is just one implementation.

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
  DeviceKind,
  Job,
  LogType,
  ScenarioId,
  WardAdapter,
  WardSnapshot,
  Worker,
} from "./types";

// Per-device incident scripts. The leak is the hero (150 USDC, plumber); the
// rest are smaller jobs routed to the matching skill. Each entry drives the
// same Open -> Funded -> Submitted -> Completed lifecycle.
type IncidentSpec = {
  deviceId: string;
  kind: DeviceKind;
  jobId: number;
  skill: string; // skill the dispatcher matches on
  amountWhole: number;
  faultSignalDbm: number;
  recoverSignalDbm: number;
  // copy
  alert: string; // MONITOR alert line
  diagnose1: string;
  diagnose2: string;
  remoteAction: string; // ACTION: attempted remote fix
  remoteFail: string; // RESULT: remote fix failed
  escalate: string; // DIAGNOSE: escalate to human
  fixSubmitted: string; // RESULT: tech submitted fix
  recoverMonitor: string; // MONITOR: telemetry recovering
  evaluatorConfirm: string; // DIAGNOSE: evaluator read endpoint
};

const INCIDENTS: Record<string, IncidentSpec> = {
  // ── HERO: the 2am Brooklyn leak ──────────────────────────────────────────
  "home-leak": {
    deviceId: "home-leak",
    kind: "leak_sensor",
    jobId: 1051,
    skill: "plumber",
    amountWhole: 150,
    faultSignalDbm: 0,
    recoverSignalDbm: 0,
    alert:
      "ALERT · leak sensor (home-leak) tripped · water detected under the laundry/bathroom floor · 02:11 local",
    diagnose1:
      "Telemetry: continuous wet reading 11s+, rising · classifying as active water ingress, not a transient splash",
    diagnose2:
      "No remote actuator can stop a physical leak · risk of floor + downstairs damage · this needs hands on a valve",
    remoteAction:
      "Attempting remote mitigation → close smart shutoff valve on the wet line",
    remoteFail:
      "Remote shutoff did NOT clear the wet reading · supply is upstream of the valve · physical plumber required",
    escalate:
      "Escalating to L3 (hire human) · owner asleep (Tokyo, 16:11 local) · querying WorkerRegistry via ENS for skill 'plumber'",
    fixSubmitted:
      "SUBMITTED the fix · burst supply coupling replaced + line dried · sensor reads dry",
    recoverMonitor:
      "Device telemetry recovering · home-leak reads DRY · sensor re-armed",
    evaluatorConfirm:
      "Evaluator (Chainlink CRE) read the sensor endpoint · wet === false · faultMode === none · confirming submission",
  },
  // ── WiFi router ───────────────────────────────────────────────────────────
  "home-wifi": {
    deviceId: "home-wifi",
    kind: "router",
    jobId: 1052,
    skill: "network",
    amountWhole: 75,
    faultSignalDbm: -120,
    recoverSignalDbm: -57,
    alert:
      "ALERT · WiFi router (home-wifi) stopped responding · 3 missed heartbeats",
    diagnose1:
      "Telemetry: link down, no DHCP lease, last signal -120dBm · classifying fault",
    diagnose2:
      "Fault profile matches power/firmware hang · L1 remote reboot is the cheapest fix",
    remoteAction: "Issuing remote reboot → POST /device/home-wifi/restart",
    remoteFail:
      "Remote reboot FAILED · WiFi still down after 3 attempts · fault is hardware/line",
    escalate:
      "Escalating to L3 (hire human) · querying WorkerRegistry via ENS for skill 'network'",
    fixSubmitted: "SUBMITTED the fix · router line replaced + firmware reflashed",
    recoverMonitor: "Device telemetry recovering · home-wifi back online · signal -57dBm",
    evaluatorConfirm:
      "Evaluator (Chainlink CRE) read the device endpoint · online === true · faultMode === none · confirming submission",
  },
  // ── Smart thermostat ────────────────────────────────────────────────────
  "home-thermostat": {
    deviceId: "home-thermostat",
    kind: "thermostat",
    jobId: 1053,
    skill: "hvac",
    amountWhole: 90,
    faultSignalDbm: -58,
    recoverSignalDbm: -58,
    alert:
      "ALERT · thermostat (home-thermostat) off-target · room 11°C vs 21°C setpoint · heat call ignored",
    diagnose1:
      "Telemetry: setpoint 21°C, ambient falling 0.4°C/min · relay not engaging the boiler",
    diagnose2:
      "Remote reconfig + relay cycle is the cheapest fix before dispatching HVAC",
    remoteAction: "Issuing remote relay cycle → POST /device/home-thermostat/cycle",
    remoteFail:
      "Remote cycle FAILED · boiler still not firing · fault is the zone valve / wiring",
    escalate:
      "Escalating to L3 (hire human) · querying WorkerRegistry via ENS for skill 'hvac'",
    fixSubmitted: "SUBMITTED the fix · zone valve replaced + thermostat recalibrated",
    recoverMonitor:
      "Device telemetry recovering · home-thermostat holding 21°C · heat call satisfied",
    evaluatorConfirm:
      "Evaluator (Chainlink CRE) read the thermostat endpoint · ambient === setpoint · faultMode === none · confirming submission",
  },
  // ── Front-door smart lock ─────────────────────────────────────────────────
  "home-lock": {
    deviceId: "home-lock",
    kind: "lock",
    jobId: 1054,
    skill: "locksmith",
    amountWhole: 80,
    faultSignalDbm: -61,
    recoverSignalDbm: -60,
    alert:
      "ALERT · front-door lock (home-lock) state UNKNOWN · bolt sensor unresponsive · last command not acked",
    diagnose1:
      "Telemetry: lock heartbeat lost, bolt position unknown · cannot confirm the door is secured",
    diagnose2:
      "Remote re-pair is the cheapest fix before dispatching a locksmith",
    remoteAction: "Attempting remote re-pair → POST /device/home-lock/repair",
    remoteFail:
      "Remote re-pair FAILED · bolt still reports UNKNOWN · physical locksmith required",
    escalate:
      "Escalating to L3 (hire human) · querying WorkerRegistry via ENS for skill 'locksmith'",
    fixSubmitted: "SUBMITTED the fix · lock module reseated + bolt re-calibrated · door secured",
    recoverMonitor:
      "Device telemetry recovering · home-lock reports LOCKED · bolt position confirmed",
    evaluatorConfirm:
      "Evaluator (Chainlink CRE) read the lock endpoint · bolt === locked · faultMode === none · confirming submission",
  },
};

// Map a ScenarioId (incl. the legacy "wifi-outage" alias) to a deviceId.
function scenarioDeviceId(id: ScenarioId): string {
  if (id === "wifi-outage") return "home-wifi";
  return id; // the other ids already equal the deviceId
}

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

// Highest-reputation staked tech whose skills match the incident's skill.
function dispatchCandidates(s: MutableState, skill: string): Worker[] {
  return s.snapshot.workers
    .filter((w) => w.staked && w.skills.includes(skill))
    .sort((a, b) => b.reputation - a.reputation);
}

// The scripted hero incident, parameterized per device. detect -> diagnose ->
// attempt remote fix -> remote fix fails -> query registry -> select tech ->
// open + fund the ERC-8183 escrow -> dispatch. The field tech then submits the
// fix and the Evaluator confirms it (Open -> Funded -> Submitted -> Completed).
function incidentBeats(spec: IncidentSpec): Beat[] {
  const createTx = fakeTxHash(`job-${spec.jobId}-create-${Date.now()}`);
  const acceptHintTx = fakeTxHash(`job-${spec.jobId}-accepthint`);
  const amount = usdc(spec.amountWhole);

  return [
    // 1. detect — device goes hard-down on the floor plan
    {
      at: 200,
      run: (s) => {
        setProperty(s, spec.deviceId, {
          online: false,
          faultMode: "hard",
          signalDbm: spec.faultSignalDbm,
          uptimeSec: 0,
        });
        pushEvent(s, "MONITOR", spec.alert, { propertyId: spec.deviceId });
      },
    },
    // 2. diagnose
    {
      at: 1400,
      run: (s) =>
        pushEvent(s, "DIAGNOSE", spec.diagnose1, { propertyId: spec.deviceId }),
    },
    {
      at: 2600,
      run: (s) =>
        pushEvent(s, "DIAGNOSE", spec.diagnose2, { propertyId: spec.deviceId }),
    },
    // 2b. attempt the cheap remote fix
    {
      at: 3800,
      run: (s) =>
        pushEvent(s, "ACTION", spec.remoteAction, { propertyId: spec.deviceId }),
    },
    // 3. remote fix FAILS (hard fault)
    {
      at: 5400,
      run: (s) =>
        pushEvent(s, "RESULT", spec.remoteFail, { propertyId: spec.deviceId }),
    },
    // 4. query registry, select highest-rep worker by skill
    {
      at: 6600,
      run: (s) => pushEvent(s, "DIAGNOSE", spec.escalate),
    },
    {
      at: 7800,
      run: (s) => {
        const candidates = dispatchCandidates(s, spec.skill);
        const top = candidates[0];
        pushEvent(
          s,
          "DISPATCH",
          `Ranked ${candidates.length} staked techs for '${spec.skill}' · selected ${top.ensName} (rep ${top.reputation}, skills: ${top.skills.join("/")})`,
        );
      },
    },
    // 5. open + fund the ERC-8183 Job
    {
      at: 9200,
      run: (s) => {
        const threshold = s.snapshot.agent.policy.ownerApprovalThresholdUsdc;
        const within = BigInt(amount) <= BigInt(threshold);
        const note = within
          ? `${spec.amountWhole}.00 USDC ≤ 100.00 owner-approval threshold · opening + funding ERC-8183 Job autonomously`
          : `${spec.amountWhole}.00 USDC ≤ 150.00 per-job cap · opening + funding ERC-8183 Job (within policy, owner asleep)`;
        pushEvent(s, "ACTION", note);
      },
    },
    {
      at: 10200,
      run: (s) => {
        const top = dispatchCandidates(s, spec.skill)[0];
        const now = new Date();
        // ERC-8183: the agent opens the Job and funds the escrow in one
        // autonomous action -> the Job lands in the Funded state.
        const job: Job = {
          jobId: spec.jobId,
          propertyId: spec.deviceId,
          deviceId: spec.deviceId,
          worker: top.ensName,
          workerAddress: top.address,
          amount,
          state: "Funded",
          txCreate: createTx,
          txAccept: null,
          txSettle: null,
          createdAtIso: now.toISOString(),
          settledAtIso: null,
          deadlineIso: new Date(now.getTime() + 30 * 60_000).toISOString(),
        };
        upsertJob(s, job);
        const spent = usdc(spec.amountWhole);
        const remaining = usdc(500 - spec.amountWhole);
        setTreasury(s, remaining, spent);
        pushEvent(
          s,
          "ESCROW",
          `Opened ERC-8183 Job #${spec.jobId} and funded escrow · ${spec.amountWhole}.00 USDC held on Arc · provider ${top.ensName}`,
          { jobId: spec.jobId, txHash: createTx, propertyId: spec.deviceId },
        );
        pushActivity(s, {
          kind: "JOB_CREATED",
          label: `Job opened + funded · #${spec.jobId}`,
          txHash: createTx,
          amountUsdc: amount,
          jobId: spec.jobId,
          ensName: top.ensName,
        });
      },
    },
    // 6. funded, waiting on the field tech — the judge's phone can take over.
    {
      at: 11600,
      run: (s) => {
        const top = dispatchCandidates(s, spec.skill)[0];
        pushEvent(
          s,
          "DISPATCH",
          `Job #${spec.jobId} dispatched to ${top.ensName} · escrow funded · awaiting on-site fix + submission (Worker view)`,
          { jobId: spec.jobId, txHash: acceptHintTx },
        );
      },
    },
  ];
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

  // Primary "Simulate" trigger. The hero scenario is the leak.
  runScenario(id: ScenarioId): void {
    this.startIncident(scenarioDeviceId(id));
  }

  // Floor-plan "Kill device" button — same state machine, keyed by deviceId.
  killDevice(deviceId: string): void {
    this.startIncident(deviceId);
  }

  private startIncident(deviceId: string): void {
    const spec = INCIDENTS[deviceId];
    if (!spec) return;
    if (this.running) return;
    // Don't re-fire on an already-faulted device.
    const prop = this.state.snapshot.properties.find((p) => p.id === deviceId);
    if (prop && prop.device.faultMode !== "none") return;

    this.running = true;
    const beats = incidentBeats(spec);
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
      const job = findJob(this.state, spec.jobId);
      if (job && job.state === "Funded") {
        this.acceptJob(spec.jobId, job.workerAddress ?? "");
        const done = setTimeout(() => {
          const j = findJob(this.state, spec.jobId);
          if (j && j.state === "Funded") this.markJobComplete(spec.jobId);
        }, 4000);
        this.timers.push(done);
      }
    }, lastAt + 9000);
    this.timers.push(autopilot);
    this.emit();
  }

  // ERC-8183 has no separate accept gate; a funded Job is claimed by its
  // provider. This records the field tech engaging (en route) while the Job
  // stays Funded, awaiting their on-site submission. On the floor plan this is
  // the cue for the worker avatar to start walking toward the device.
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
    const spec = INCIDENTS[job.deviceId];
    // ERC-8183: the field tech SUBMITS the fix (Funded -> Submitted). The device
    // recovers, then the Evaluator (the sensor/CRE) confirms it and the escrow
    // releases payment (Submitted -> Completed).
    const submitTx = fakeTxHash(`job-${jobId}-submit-${Date.now()}`);
    upsertJob(this.state, { ...job, state: "Submitted", txAccept: job.txAccept });
    pushEvent(
      this.state,
      "RESULT",
      `${job.worker} ${spec?.fixSubmitted ?? `SUBMITTED the fix on Job #${jobId}`} (#${jobId})`,
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

    // device telemetry recovers (the human fix). This flips the floor-plan
    // room back to healthy.
    const onlineTimer = setTimeout(() => {
      setProperty(this.state, job.propertyId, {
        online: true,
        faultMode: "none",
        signalDbm: spec?.recoverSignalDbm ?? -57,
        uptimeSec: 30,
      });
      pushEvent(
        this.state,
        "MONITOR",
        spec?.recoverMonitor ?? "Device telemetry recovering · back online",
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
        spec?.evaluatorConfirm ??
          "Evaluator (Chainlink CRE) read the device endpoint · faultMode === none · confirming submission",
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
      const amountWhole = Number(BigInt(cur.amount) / 1_000_000n);
      upsertJob(this.state, {
        ...cur,
        state: "Completed",
        txSettle: settleTx,
        settledAtIso: new Date().toISOString(),
      });
      // Funding drew the treasury DOWN (escrow hold). On settlement the demo
      // surfaces the hold being lifted: the displayed balance ticks back UP to
      // 500. (The real payout is the worker's; the dashboard models the agent's
      // available treasury, which is no longer encumbered once the job closes.)
      setTreasury(this.state, usdc(500), usdc(amountWhole));
      pushEvent(
        this.state,
        "ESCROW",
        `Evaluator confirmed onchain · Job #${jobId} COMPLETED · escrow released · ${amountWhole}.00 USDC → ${ensName}`,
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
        `Job #${jobId} COMPLETED · ${ensName} paid ${amountWhole}.00 USDC · reputation ${rep.from} → ${rep.to} · device HEALTHY`,
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
