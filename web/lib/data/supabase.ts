// Supabase adapter: reads persisted demo state from NEXT_PUBLIC_SUPABASE_*.
//
// This adapter conforms to the same WardAdapter interface as the mock. For the
// hackathon build it is intentionally thin: it loads an initial snapshot from
// Supabase tables (properties / workers / jobs / agent_events) and subscribes
// to realtime changes. Worker actions and scenario triggering are delegated to
// the live agent/contracts in production; here they are no-ops with a console
// note so the UI never hard-crashes when pointed at a read-only Supabase.
//
// The seam: swap NEXT_PUBLIC_DATA_ADAPTER=supabase and provide the env vars.
// Nothing in the UI components changes — they only see WardSnapshot.

import {
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
  Job,
  JobState,
  ScenarioId,
  WardAdapter,
  WardSnapshot,
  Worker,
} from "./types";
import { usdc } from "../format";

type SupabaseRow = Record<string, unknown>;

// Minimal structural type so we don't hard-depend on @supabase/supabase-js types
// at build time. The real client (created via dynamic import) satisfies this.
type MinimalSupabase = {
  from: (table: string) => {
    select: (cols: string) => Promise<{ data: SupabaseRow[] | null; error: unknown }>;
  };
  channel: (name: string) => {
    on: (...args: unknown[]) => { subscribe: () => unknown };
  };
  removeChannel: (channel: unknown) => void;
};

function envConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function rowToWorker(r: SupabaseRow): Worker {
  return {
    handle: String(r.handle ?? ""),
    ensName: String(r.ens_name ?? ""),
    address: String(r.address ?? ""),
    skills: String(r.skills ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    region: String(r.region ?? ""),
    reputation: Number(r.reputation ?? 0),
    staked: Boolean(r.staked ?? true),
    stakeUsdc: String(r.stake_usdc ?? usdc(100)),
    completedJobs: Number(r.completed_jobs ?? 0),
  };
}

function rowToJob(r: SupabaseRow): Job {
  return {
    jobId: Number(r.job_id),
    propertyId: String(r.property_id ?? ""),
    deviceId: String(r.device_id ?? ""),
    worker: (r.worker as string) ?? null,
    workerAddress: (r.worker_address as string) ?? null,
    amount: String(r.amount ?? "0"),
    state: String(r.state ?? "Open") as JobState,
    txCreate: (r.tx_create as string) ?? null,
    txAccept: (r.tx_accept as string) ?? null,
    txSettle: (r.tx_settle as string) ?? null,
    createdAtIso: String(r.created_at ?? new Date().toISOString()),
    settledAtIso: (r.settled_at as string) ?? null,
    deadlineIso: String(r.deadline ?? new Date().toISOString()),
  };
}

function rowToEvent(r: SupabaseRow): AgentEvent {
  return {
    id: String(r.id ?? crypto.randomUUID()),
    ts: String(r.ts ?? new Date().toISOString()),
    type: String(r.type ?? "MONITOR") as AgentEvent["type"],
    message: String(r.message ?? ""),
    jobId: r.job_id != null ? Number(r.job_id) : undefined,
    txHash: (r.tx_hash as string) ?? undefined,
    propertyId: (r.property_id as string) ?? undefined,
  };
}

class SupabaseAdapter implements WardAdapter {
  readonly name = "supabase" as const;
  private snapshot: WardSnapshot;
  private listeners = new Set<() => void>();
  private client: MinimalSupabase | null = null;
  private channel: unknown = null;

  constructor() {
    // Seed with fixtures so the UI renders immediately, then hydrate from
    // Supabase asynchronously if configured.
    this.snapshot = {
      agent: buildAgent(),
      properties: buildProperties(),
      workers: buildWorkers(),
      jobs: buildJobs(),
      events: buildEvents(),
      activity: buildActivity(),
      activeJob: null,
    };
    if (envConfigured()) {
      void this.hydrate();
    } else if (typeof window !== "undefined") {
      console.warn(
        "[ward] supabase adapter selected but NEXT_PUBLIC_SUPABASE_* not set — showing fixtures.",
      );
    }
  }

  private async hydrate() {
    try {
      const mod = await import("@supabase/supabase-js");
      const client = mod.createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ) as unknown as MinimalSupabase;
      this.client = client;

      const [workers, jobs, events] = await Promise.all([
        client.from("workers").select("*"),
        client.from("jobs").select("*"),
        client.from("agent_events").select("*"),
      ]);

      const nextWorkers = workers.data?.length
        ? workers.data.map(rowToWorker)
        : this.snapshot.workers;
      const nextJobs = jobs.data?.length ? jobs.data.map(rowToJob) : this.snapshot.jobs;
      const nextEvents = events.data?.length
        ? events.data.map(rowToEvent).sort((a, b) => +new Date(a.ts) - +new Date(b.ts))
        : this.snapshot.events;

      const activeJob =
        nextJobs.find(
          (j) =>
            j.state !== "Completed" && j.state !== "Rejected" && j.state !== "Expired",
        ) ?? null;

      this.snapshot = {
        ...this.snapshot,
        workers: nextWorkers,
        jobs: nextJobs,
        events: nextEvents,
        activeJob,
        activity: deriveActivity(nextJobs),
      };
      this.emit();
      this.subscribeRealtime();
    } catch (err) {
      console.warn("[ward] supabase hydrate failed, staying on fixtures:", err);
    }
  }

  private subscribeRealtime() {
    if (!this.client) return;
    try {
      this.channel = this.client
        .channel("ward-agent-events")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "agent_events" },
          (payload: unknown) => {
            const row = (payload as { new?: SupabaseRow }).new;
            if (!row) return;
            const ev = rowToEvent(row);
            this.snapshot = {
              ...this.snapshot,
              events: [...this.snapshot.events, ev],
            };
            this.emit();
          },
        )
        .subscribe();
    } catch (err) {
      console.warn("[ward] supabase realtime subscribe failed:", err);
    }
  }

  getSnapshot(): WardSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isRunning(): boolean {
    return false;
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  // In production these are driven by the live agent + contracts; the frontend
  // is read-only against Supabase. Kept as logged no-ops so the UI is safe.
  runScenario(_id: ScenarioId): void {
    console.info("[ward] runScenario is a no-op on the supabase adapter (live agent drives it).");
  }
  acceptJob(_jobId: number, _workerAddress: string): void {
    console.info("[ward] acceptJob would POST to the agent API in production.");
  }
  markJobComplete(_jobId: number): void {
    console.info("[ward] markJobComplete would POST to the agent API in production.");
  }

  reset(): void {
    if (this.channel && this.client) this.client.removeChannel(this.channel);
    void this.hydrate();
  }
}

function deriveActivity(jobs: Job[]): Activity[] {
  const items: Activity[] = [];
  for (const job of jobs) {
    if (job.txCreate) {
      items.push({
        id: `act-${job.jobId}-create`,
        ts: job.createdAtIso,
        kind: "JOB_CREATED",
        label: `Escrow opened · #${job.jobId}`,
        txHash: job.txCreate,
        amountUsdc: job.amount,
        jobId: job.jobId,
      });
    }
    if (job.txSettle && job.settledAtIso) {
      items.push({
        id: `act-${job.jobId}-settle`,
        ts: job.settledAtIso,
        kind: "JOB_SETTLED",
        label: `Settled to worker · #${job.jobId}`,
        txHash: job.txSettle,
        amountUsdc: job.amount,
        ensName: job.worker ?? undefined,
        jobId: job.jobId,
      });
    }
  }
  return items.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
}

export function createSupabaseAdapter(): WardAdapter {
  return new SupabaseAdapter();
}
