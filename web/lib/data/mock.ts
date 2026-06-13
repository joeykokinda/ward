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
import { phaseIndex, phaseMeta, phasesForTrack } from "../narrative";
import {
  ARC_TX,
  buildActivity,
  buildAgent,
  buildEvents,
  buildJobs,
  buildProperties,
  buildWorkers,
} from "./fixtures";
import type {
  Activity,
  AgentEvent,
  DeviceKind,
  Job,
  LogType,
  NarrativePhaseId,
  NarrativeTrack,
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
  remoteFail: string; // RESULT: remote fix failed (L3 path)
  escalate: string; // DIAGNOSE: escalate to human
  fixSubmitted: string; // RESULT: tech submitted fix
  recoverMonitor: string; // MONITOR: telemetry recovering
  evaluatorConfirm: string; // DIAGNOSE: evaluator read endpoint
  // L1 self-fix path: when selfFix is true, the remote action SUCCEEDS and the
  // incident resolves with no human, no escrow, no spend.
  selfFix?: boolean;
  remoteSuccess?: string; // RESULT: remote fix worked
  selfFixResolved?: string; // RESOLVED: self-fixed at L1
  // Plain-language "what + why" caption shown big on the phase HUD, per act.
  // Hire track fills detect/diagnose/hire/repair/verify; self-fix track fills
  // detect/diagnose/selffixed.
  captions: Partial<Record<NarrativePhaseId, string>>;
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
    captions: {
      detect:
        "2:11 AM. A pipe lets go in the Brooklyn apartment while the owner sleeps in Tokyo. WARD's leak sensor trips and the agent wakes up.",
      diagnose:
        "Water is actively rising. WARD tries the free fix, closing the smart shutoff valve, but the burst is upstream. Software can't stop this one.",
      hire:
        "WARD looks up verified plumbers via ENS, picks the highest-rated one, and locks 150 USDC in escrow on Arc, autonomously, owner still asleep.",
      repair:
        "Mike accepts the job and arrives on site. He replaces the burst coupling and the sensor reads dry again.",
      verify:
        "A Chainlink oracle reads the sensor, confirms it's dry, and the escrow releases the 150 USDC to Mike. No invoice, no human approval.",
    },
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
    selfFix: true,
    remoteSuccess:
      "Remote reboot SUCCEEDED · link up · DHCP lease renewed · WiFi back online · signal -57dBm",
    selfFixResolved:
      "Resolved at L1 · home-wifi self-fixed by remote reboot · no human, no escrow, no spend",
    captions: {
      detect:
        "WARD's routine sweep finds the WiFi router dark, three missed heartbeats in a row.",
      diagnose:
        "Link down, no DHCP lease. WARD tries the free fix first: a remote reboot of the router.",
      selffixed:
        "The reboot worked. The router is back online. Fixed at L1 in software: no human, no escrow, no spend. This is the everyday case.",
    },
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
    captions: {
      detect:
        "WARD notices the apartment drifting cold, 11°C against a 21°C setpoint. The boiler isn't firing.",
      diagnose:
        "The relay won't engage the boiler. WARD cycles it remotely, the free fix, but it still won't fire. It's the zone valve.",
      hire:
        "WARD finds HVAC techs via ENS and locks 90 USDC in an Arc escrow for the best-rated one, on its own.",
      repair:
        "The tech accepts the job, arrives, and swaps the zone valve. The room climbs back toward setpoint.",
      verify:
        "A Chainlink oracle confirms the room is back to setpoint and the escrow releases the 90 USDC.",
    },
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
    captions: {
      detect:
        "WARD loses contact with the front-door lock, bolt position unknown. It can't confirm the door is secured.",
      diagnose:
        "The bolt state is unreadable. WARD tries a remote re-pair, the free fix, but it still reports unknown. A locksmith is needed.",
      hire:
        "WARD looks up locksmiths via ENS and locks 80 USDC in an Arc escrow for the top-rated tech, autonomously.",
      repair:
        "The locksmith accepts the job, arrives, and reseats the lock module. The bolt reports locked again.",
      verify:
        "A Chainlink oracle confirms the door is locked and the escrow releases the 80 USDC.",
    },
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
    narrative: null,
  };
}

// Set the current narrative act, with the human-readable caption from the
// incident spec. `done` marks the whole incident resolved + paid.
function setNarrative(
  s: MutableState,
  spec: IncidentSpec,
  id: NarrativePhaseId,
  done = false,
) {
  const track: NarrativeTrack = spec.selfFix ? "selffix" : "hire";
  const meta = phaseMeta(track, id);
  s.snapshot = {
    ...s.snapshot,
    narrative: {
      id,
      track,
      index: phaseIndex(track, id),
      total: phasesForTrack(track).length,
      title: meta.title,
      caption: spec.captions[id] ?? "",
      onChain: meta.onChain,
      done,
    },
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

// The scripted hero incident, parameterized per device. Grouped into the five
// narrative acts the stepper shows, with a deliberate hold between acts so a
// first-time viewer can read each caption: detect -> diagnose -> try the free
// remote fix -> (it fails) -> hire a human + fund the ERC-8183 escrow on Arc ->
// dispatch. The field tech then submits the fix and the Evaluator confirms it
// (Open -> Funded -> Submitted -> Completed), driven from markJobComplete.
//
// Timings are spaced ~1.2s within an act and ~2.5s between acts (a hold on the
// caption). The last beat lands at ~16.2s; the worker's walk + fix + settle
// follow from the autopilot in startIncident.
function incidentBeats(spec: IncidentSpec): Beat[] {
  // Real Arc testnet hashes from the canonical ERC-8183 WardEscrow lifecycle
  // (fixtures ARC_TX / DEMO-EVIDENCE.md) so every clickable tx in the cinematic
  // opens a REAL on-chain WardEscrow txn on arcscan instead of a dead link. The
  // narrated amount is the story; the link proves the flow is real on Arc.
  const createTx = ARC_TX.fund; // escrow funded (the "lock")
  const acceptHintTx = ARC_TX.createJob; // job opened on-chain
  const amount = usdc(spec.amountWhole);

  return [
    // ── ACT 1 · DETECT (narrative set synchronously in startIncident) ────────
    // device goes hard-down on the floor plan
    {
      at: 250,
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
    // ── ACT 2 · DIAGNOSE ─────────────────────────────────────────────────────
    {
      at: 2800,
      run: (s) => {
        setNarrative(s, spec, "diagnose");
        pushEvent(s, "DIAGNOSE", spec.diagnose1, { propertyId: spec.deviceId });
      },
    },
    {
      at: 4000,
      run: (s) =>
        pushEvent(s, "DIAGNOSE", spec.diagnose2, { propertyId: spec.deviceId }),
    },
    // ── still ACT 2 · DIAGNOSE: try the free remote fix (then it fails) ───────
    {
      at: 6600,
      run: (s) =>
        pushEvent(s, "ACTION", spec.remoteAction, { propertyId: spec.deviceId }),
    },
    {
      at: 8100,
      run: (s) =>
        pushEvent(s, "RESULT", spec.remoteFail, { propertyId: spec.deviceId }),
    },
    // ── ACT 4 · HIRE A HUMAN, ON-CHAIN ───────────────────────────────────────
    // query the ENS-backed registry, rank + select the highest-rep worker
    {
      at: 10700,
      run: (s) => {
        setNarrative(s, spec, "hire");
        pushEvent(s, "DIAGNOSE", spec.escalate);
      },
    },
    {
      at: 11900,
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
    // open + fund the ERC-8183 Job
    {
      at: 13100,
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
      at: 14400,
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
    // funded, waiting on the field tech — the judge's phone can take over.
    {
      at: 16200,
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
    // Set ACT 1 up front so the phase stepper appears immediately (no flicker
    // back to the intro frame), then the first beat takes the device down.
    setNarrative(this.state, spec, "detect");

    // L1 self-fix track (e.g. WiFi): the agent reboots remotely and it works.
    // No job, no escrow, no worker. detect -> diagnose -> selffixed.
    if (spec.selfFix) {
      const beat = (at: number, fn: () => void) => {
        const t = setTimeout(() => {
          fn();
          this.emit();
        }, at);
        this.timers.push(t);
      };
      beat(250, () => {
        setProperty(this.state, spec.deviceId, {
          online: false,
          faultMode: "hard",
          signalDbm: spec.faultSignalDbm,
          uptimeSec: 0,
        });
        pushEvent(this.state, "MONITOR", spec.alert, { propertyId: spec.deviceId });
      });
      beat(2800, () => {
        setNarrative(this.state, spec, "diagnose");
        pushEvent(this.state, "DIAGNOSE", spec.diagnose1, { propertyId: spec.deviceId });
      });
      beat(4000, () =>
        pushEvent(this.state, "DIAGNOSE", spec.diagnose2, { propertyId: spec.deviceId }),
      );
      beat(5200, () =>
        pushEvent(this.state, "ACTION", spec.remoteAction, { propertyId: spec.deviceId }),
      );
      beat(7000, () => {
        setProperty(this.state, spec.deviceId, {
          online: true,
          faultMode: "none",
          signalDbm: spec.recoverSignalDbm,
          uptimeSec: 30,
        });
        pushEvent(
          this.state,
          "RESULT",
          spec.remoteSuccess ?? "Remote fix succeeded · device back online",
          { propertyId: spec.deviceId },
        );
      });
      beat(8500, () => {
        setNarrative(this.state, spec, "selffixed", true);
        pushEvent(
          this.state,
          "RESOLVED",
          spec.selfFixResolved ?? "Self-fixed at L1 · no human, no spend",
          { propertyId: spec.deviceId },
        );
        this.running = false;
      });
      this.emit();
      return;
    }

    const beats = incidentBeats(spec);
    for (const beat of beats) {
      const t = setTimeout(() => {
        beat.run(this.state);
        this.emit();
      }, beat.at);
      this.timers.push(t);
    }
    // After the last scripted beat, the field tech walks in and submits the fix.
    // The judge can drive this from the Worker persona; if nobody touches it, an
    // auto-pilot finishes the cycle so the unattended Vercel demo self-recovers.
    // The accept (en route) fires ~1s after dispatch so the avatar's ~3.4s walk
    // lands just before the fix submission.
    const lastAt = beats[beats.length - 1].at;
    const enroute = setTimeout(() => {
      const job = findJob(this.state, spec.jobId);
      if (job && job.state === "Funded" && !job.txAccept) {
        this.acceptJob(spec.jobId, job.workerAddress ?? "");
      }
    }, lastAt + 1000);
    this.timers.push(enroute);
    const finish = setTimeout(() => {
      const job = findJob(this.state, spec.jobId);
      if (job && job.state === "Funded") this.markJobComplete(spec.jobId);
    }, lastAt + 5000);
    this.timers.push(finish);
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
    const acceptTx = ARC_TX.createJob; // provider engaged the opened job
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
    // ACT 4 · REPAIR begins: the worker is dispatched and walking in.
    const spec = INCIDENTS[job.deviceId];
    if (spec) setNarrative(this.state, spec, "repair");
    this.emit();
  }

  markJobComplete(jobId: number): void {
    const job = findJob(this.state, jobId);
    if (!job || job.state !== "Funded") return;
    const spec = INCIDENTS[job.deviceId];
    // ACT 4 · REPAIR completing: the field tech SUBMITS the fix (Funded ->
    // Submitted) and the device recovers. The Evaluator (sensor/CRE) then
    // confirms it (ACT 5 · VERIFY) and the escrow releases (Submitted ->
    // Completed). Set repair here too so the manual Worker-persona path (which
    // may skip accept) still advances the phase correctly.
    if (spec) setNarrative(this.state, spec, "repair");
    const submitTx = ARC_TX.submit; // field tech submitted the fix on-chain
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
      // ACT 5 · VERIFY: the Evaluator (Chainlink CRE) reads the device + confirms.
      if (spec) setNarrative(this.state, spec, "verify");
      const attestTx = ARC_TX.complete; // evaluator attestation drives complete()
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
      const settleTx = ARC_TX.complete; // escrow released on complete()
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
        txHash: ARC_TX.complete,
        ensName,
        jobId,
      });
      pushEvent(
        this.state,
        "RESOLVED",
        `Job #${jobId} COMPLETED · ${ensName} paid ${amountWhole}.00 USDC · reputation ${rep.from} → ${rep.to} · device HEALTHY`,
        { jobId, txHash: settleTx, propertyId: cur.propertyId },
      );
      // Hold ACT 5 on screen, now marked resolved + paid, until the operator
      // resets. The stepper shows all five acts complete.
      if (spec) setNarrative(this.state, spec, "verify", true);
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
