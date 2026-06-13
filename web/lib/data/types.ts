// WARD shared interface contract — mirrors INTERFACES.md.
// Both the mock adapter and the supabase adapter conform to these shapes,
// and the live agent SSE feed + Arc contracts will produce the same data.

export type DeviceKind = "router";

export type FaultMode = "none" | "soft" | "hard";

export type DeviceStatus = {
  deviceId: string;
  propertyId: string;
  kind: DeviceKind;
  online: boolean;
  uptimeSec: number;
  signalDbm: number;
  faultMode: FaultMode;
  lastChangedIso: string;
};

export type Property = {
  id: string;
  name: string;
  deviceId: string;
  deviceKind: DeviceKind;
  region: string;
};

// status pairs a property with its current device state for the fleet grid
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

// Canonical job lifecycle from INTERFACES.md.
export type JobState =
  | "OPEN"
  | "ACCEPTED"
  | "WORK_DONE"
  | "ATTESTING"
  | "SETTLED"
  | "EXPIRED"
  | "REFUNDED";

export type Job = {
  jobId: number;
  propertyId: string;
  deviceId: string;
  worker: string | null; // ENS name once assigned
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

export type WardSnapshot = {
  agent: AgentIdentity;
  properties: PropertyStatus[];
  workers: Worker[];
  jobs: Job[];
  events: AgentEvent[];
  activity: Activity[];
  activeJob: Job | null;
};

// A simulation/incident scenario the adapter can run.
export type ScenarioId = "router-failure";

export type WardAdapter = {
  // Snapshot of all demo state. Cheap to call; safe to poll.
  getSnapshot: () => WardSnapshot;
  // Subscribe to state changes. Returns an unsubscribe fn.
  subscribe: (listener: () => void) => () => void;
  // Drive the scripted incident (Host: "Simulate Router Failure").
  runScenario: (id: ScenarioId) => void;
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
