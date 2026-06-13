// WARD shared interface contract — mirrors INTERFACES.md.
// Both the mock adapter and the supabase adapter conform to these shapes,
// and the live agent SSE feed + Arc contracts will produce the same data.

// One home, four instrumented device kinds.
export type DeviceKind = "router" | "thermostat" | "lock" | "leak_sensor";

export type FaultMode = "none" | "soft" | "hard";

export type DeviceStatus = {
  deviceId: string;
  propertyId: string; // == deviceId: each device is tracked independently
  kind: DeviceKind;
  online: boolean;
  uptimeSec: number;
  signalDbm: number; // not meaningful for the leak sensor (0)
  faultMode: FaultMode;
  lastChangedIso: string;
};

// A device in the home. `propertyId` (id) == deviceId so the agent's
// one-open-job-per-property guard works per-device. The `Property`/
// `PropertyStatus` names are kept so the shared snapshot shape is stable.
export type Property = {
  id: string;
  name: string; // friendly device name, e.g. "WiFi router"
  deviceId: string;
  deviceKind: DeviceKind;
  region: string; // the home's location (same for every device)
};

// status pairs a device with its current telemetry for the home grid
export type PropertyStatus = Property & {
  device: DeviceStatus;
};

export type Worker = {
  handle: string;
  ensName: string; // <handle>.ward-agent.eth
  address: string;
  skills: string[];
  region: string;
  reputation: number;
  staked: boolean;
  stakeUsdc: string; // 6dp string, e.g. "100000000"
  completedJobs: number;
};

// Canonical ERC-8183 job lifecycle. The escrow is an ERC-8183 Job: the agent
// opens + funds the escrow (Open → Funded), the field tech submits the fix
// (Submitted), and the Evaluator (the sensor/CRE) confirms it, releasing
// payment (Completed) or rejecting it (Rejected). Expired covers a job that
// passed its deadline with funds refunded.
export type JobState =
  | "Open"
  | "Funded"
  | "Submitted"
  | "Completed"
  | "Rejected"
  | "Expired";

export type Job = {
  jobId: number;
  propertyId: string;
  deviceId: string;
  worker: string | null; // ENS name once assigned (the ERC-8183 provider)
  workerAddress: string | null;
  amount: string; // USDC 6dp string, e.g. "75000000"
  state: JobState;
  txCreate: string | null;
  txAccept: string | null;
  txSettle: string | null;
  createdAtIso: string;
  settledAtIso: string | null;
  deadlineIso: string;
};

// DESIGN.md log types — one color each.
export type LogType =
  | "MONITOR"
  | "DIAGNOSE"
  | "ACTION"
  | "RESULT"
  | "ESCROW"
  | "DISPATCH"
  | "RESOLVED";

export type AgentEvent = {
  id: string;
  ts: string; // iso
  type: LogType;
  message: string;
  jobId?: number;
  txHash?: string;
  propertyId?: string;
};

// Onchain activity feed entry. Derived from contract events on Arc.
export type ActivityKind =
  | "JOB_CREATED"
  | "JOB_ACCEPTED"
  | "WORK_DONE"
  | "ATTESTED"
  | "JOB_SETTLED"
  | "REPUTATION_BUMP"
  | "TREASURY_FUNDED";

export type Activity = {
  id: string;
  ts: string; // iso
  kind: ActivityKind;
  label: string;
  txHash: string;
  amountUsdc?: string; // 6dp string when money moves
  ensName?: string; // worker / agent name when relevant
  jobId?: number;
};

export type SpendingPolicy = {
  perJobCapUsdc: string;
  dailyCapUsdc: string;
  ownerApprovalThresholdUsdc: string;
  spentTodayUsdc: string;
};

export type AgentIdentity = {
  ensName: string;
  address: string;
  treasuryUsdc: string; // 6dp string
  policy: SpendingPolicy;
};

// The five-act narrative the scripted cinematic walks through, so a first-time
// viewer can follow WHAT is happening and WHY. The mock player sets this as it
// runs; the live/supabase adapters leave it undefined (the UI then just shows
// the intro frame + their own event stream).
export type NarrativePhaseId =
  | "detect"
  | "diagnose"
  | "hire"
  | "repair"
  | "verify";

export type NarrativePhase = {
  id: NarrativePhaseId;
  index: number; // 1-based position
  total: number;
  title: string; // big phase title
  caption: string; // the plain-language "what + why" line
  onChain: boolean; // is this a blockchain moment (escrow / settle)?
  done: boolean; // the whole incident is resolved + paid
};

export type WardSnapshot = {
  agent: AgentIdentity;
  properties: PropertyStatus[];
  workers: Worker[];
  jobs: Job[];
  events: AgentEvent[];
  activity: Activity[];
  activeJob: Job | null;
  // Present while the scripted cinematic is running (mock adapter only).
  narrative?: NarrativePhase | null;
};

// A simulation/incident scenario the adapter can run. The HERO is the leak
// ("home-leak"); the other three devices are independently kill-able. The
// legacy "wifi-outage" alias is kept so older call sites keep working.
export type ScenarioId =
  | "home-leak"
  | "home-wifi"
  | "home-thermostat"
  | "home-lock"
  | "wifi-outage";

// Where the dispatched worker is in their walk-to-the-device sequence. Derived
// from the job state + telemetry so the floor-plan animation and the reasoning
// stream read from one source of truth.
export type WorkerPhase = "none" | "enroute" | "fixing" | "done";

export type WardAdapter = {
  // Snapshot of all demo state. Cheap to call; safe to poll.
  getSnapshot: () => WardSnapshot;
  // Subscribe to state changes. Returns an unsubscribe fn.
  subscribe: (listener: () => void) => () => void;
  // Drive the scripted incident. The primary trigger is the leak ("home-leak").
  runScenario: (id: ScenarioId) => void;
  // Kill a single device (the floor-plan "Kill device" button). Routes through
  // the same incident state machine as runScenario, keyed by deviceId.
  killDevice: (deviceId: string) => void;
  // Worker-side actions (judge's phone).
  acceptJob: (jobId: number, workerAddress: string) => void;
  markJobComplete: (jobId: number) => void;
  // Return to clean pre-staged state.
  reset: () => void;
  // Whether a scenario is currently mid-flight.
  isRunning: () => boolean;
  // Adapter label for the UI footer.
  readonly name: "mock" | "supabase" | "live";
};
