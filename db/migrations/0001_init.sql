-- WARD — Supabase schema.
-- Tables: properties, workers, jobs, agent_events.
-- USDC amounts are 6-decimal integers stored as TEXT (e.g. "75000000") so
-- BigInt precision survives the JS round-trip; the frontend formats them.
--
-- Idempotent: safe to run repeatedly. RLS is enabled with read-only anon
-- access (the demo is public; writes happen via the agent's service-role key).

-- ── properties ──────────────────────────────────────────────────────────────
create table if not exists public.properties (
  id          text primary key,             -- "prop-1"
  name        text not null,                 -- "The Brooklyn Loft"
  device_id   text not null,                 -- "prop-1-router"
  device_kind text not null default 'router',
  region      text not null default '',
  created_at  timestamptz not null default now()
);

-- ── workers ─────────────────────────────────────────────────────────────────
-- handle, ens_name, address, skills, region, reputation.
create table if not exists public.workers (
  handle        text primary key,            -- "mike"
  ens_name      text not null unique,         -- "mike.ward-agent.eth"
  address       text not null,                -- 0x… worker wallet (subname owner)
  skills        text[] not null default '{}', -- {router,network,hardware}
  region        text not null default '',
  reputation    integer not null default 0,
  staked        boolean not null default false,
  stake_usdc    text not null default '0',    -- 6dp integer as text
  completed_jobs integer not null default 0,
  created_at    timestamptz not null default now()
);

-- ── jobs ────────────────────────────────────────────────────────────────────
-- job_id, property_id, device_id, worker, amount, state, tx_create, tx_settle,
-- created_at + the extra lifecycle fields the frontend renders.
do $$ begin
  create type job_state as enum (
    'OPEN','ACCEPTED','WORK_DONE','ATTESTING','SETTLED','EXPIRED','REFUNDED'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.jobs (
  job_id         bigint primary key,          -- onchain jobId
  property_id    text not null references public.properties(id),
  device_id      text not null,
  worker         text,                         -- ens_name once assigned (nullable)
  worker_address text,
  amount         text not null,                -- USDC 6dp as text, "75000000"
  state          job_state not null default 'OPEN',
  tx_create      text,
  tx_accept      text,
  tx_settle      text,
  created_at     timestamptz not null default now(),
  settled_at     timestamptz,
  deadline       timestamptz not null
);

create index if not exists jobs_property_idx on public.jobs(property_id);
create index if not exists jobs_worker_idx   on public.jobs(worker);
create index if not exists jobs_state_idx    on public.jobs(state);

-- ── agent_events ────────────────────────────────────────────────────────────
-- ts, type, message, job_id, tx_hash, property_id.
-- type matches the LogType set.
do $$ begin
  create type agent_log_type as enum (
    'MONITOR','DIAGNOSE','ACTION','RESULT','ESCROW','DISPATCH','RESOLVED'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.agent_events (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  type        agent_log_type not null,
  message     text not null,
  job_id      bigint references public.jobs(job_id),
  tx_hash     text,
  property_id text references public.properties(id)
);

create index if not exists agent_events_ts_idx  on public.agent_events(ts desc);
create index if not exists agent_events_job_idx on public.agent_events(job_id);

-- ── Row-level security: public read, service-role write ─────────────────────
-- The demo dashboard is public (anon key, SELECT only). The agent writes with
-- the service-role key, which bypasses RLS.
alter table public.properties   enable row level security;
alter table public.workers      enable row level security;
alter table public.jobs         enable row level security;
alter table public.agent_events enable row level security;

do $$ begin
  create policy "anon read properties"   on public.properties   for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anon read workers"      on public.workers      for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anon read jobs"         on public.jobs         for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anon read agent_events" on public.agent_events for select using (true);
exception when duplicate_object then null; end $$;
