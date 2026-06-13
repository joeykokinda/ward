#!/usr/bin/env tsx
// WARD demo seed runner (TS/node).
//
// Two ways to seed:
//   1. SQL (recommended for the persistent demo):
//        supabase db push           # applies migrations/0001_init.sql
//        psql "$DATABASE_URL" -f seed/0001_seed.sql   # or via the SQL editor
//   2. This runner — upserts the same canonical rows through supabase-js using
//        the SERVICE-ROLE key (bypasses RLS). Useful when you only have the
//        project URL + service key and not a direct psql connection.
//
// Env required (service role; NEVER ship to the browser):
//   SUPABASE_URL                 https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    service_role secret from Project Settings → API
//
// The data here MUST match db/seed/0001_seed.sql and web/lib/data/fixtures.ts.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. " +
      "These are read from the environment; nothing is hardcoded.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}
const HOUR = 3_600_000;
const MIN = 60_000;

const properties = [
  { id: "prop-1", name: "The Brooklyn Loft", device_id: "prop-1-router", device_kind: "router", region: "Brooklyn, NY" },
  { id: "prop-2", name: "Greenwich Cottage", device_id: "prop-2-router", device_kind: "router", region: "Greenwich, CT" },
  { id: "prop-3", name: "Hudson Studio", device_id: "prop-3-router", device_kind: "router", region: "Hudson, NY" },
];

const workers = [
  { handle: "mike", ens_name: "mike.ward-agent.eth", address: "0x1111111111111111111111111111111111111111", skills: ["network", "router", "hardware"], region: "Greenwich, CT", reputation: 98, staked: true, stake_usdc: "100000000", completed_jobs: 41 },
  { handle: "sara", ens_name: "sara.ward-agent.eth", address: "0x2222222222222222222222222222222222222222", skills: ["network", "smart-lock"], region: "Stamford, CT", reputation: 91, staked: true, stake_usdc: "100000000", completed_jobs: 33 },
  { handle: "deon", ens_name: "deon.ward-agent.eth", address: "0x3333333333333333333333333333333333333333", skills: ["hardware", "hvac"], region: "Brooklyn, NY", reputation: 87, staked: true, stake_usdc: "100000000", completed_jobs: 28 },
  { handle: "lena", ens_name: "lena.ward-agent.eth", address: "0x4444444444444444444444444444444444444444", skills: ["network", "sensor"], region: "Hudson, NY", reputation: 84, staked: true, stake_usdc: "100000000", completed_jobs: 22 },
  { handle: "raj", ens_name: "raj.ward-agent.eth", address: "0x5555555555555555555555555555555555555555", skills: ["router", "general"], region: "Greenwich, CT", reputation: 79, staked: true, stake_usdc: "100000000", completed_jobs: 17 },
];

const jobs = [
  { job_id: 1041, property_id: "prop-1", device_id: "prop-1-router", worker: "deon.ward-agent.eth", worker_address: "0x3333333333333333333333333333333333333333", amount: "60000000", state: "SETTLED", tx_create: "0xcreate1041", tx_accept: "0xaccept1041", tx_settle: "0xsettle1041", created_at: isoAgo(52 * HOUR), settled_at: isoAgo(51 * HOUR), deadline: isoAgo(48 * HOUR) },
  { job_id: 1042, property_id: "prop-3", device_id: "prop-3-router", worker: "lena.ward-agent.eth", worker_address: "0x4444444444444444444444444444444444444444", amount: "75000000", state: "SETTLED", tx_create: "0xcreate1042", tx_accept: "0xaccept1042", tx_settle: "0xsettle1042", created_at: isoAgo(28 * HOUR), settled_at: isoAgo(27 * HOUR), deadline: isoAgo(24 * HOUR) },
  { job_id: 1043, property_id: "prop-2", device_id: "prop-2-router", worker: "mike.ward-agent.eth", worker_address: "0x1111111111111111111111111111111111111111", amount: "75000000", state: "SETTLED", tx_create: "0xcreate1043", tx_accept: "0xaccept1043", tx_settle: "0xsettle1043", created_at: isoAgo(6 * HOUR), settled_at: isoAgo(5 * HOUR), deadline: isoAgo(2 * HOUR) },
];

const events = [
  { ts: isoAgo(14 * MIN), type: "MONITOR", message: "Fleet sweep complete · 3/3 devices online · all telemetry nominal", job_id: null, tx_hash: null, property_id: null },
  { ts: isoAgo(9 * MIN), type: "MONITOR", message: "prop-1-router uptime 4d 18h · signal -52dBm · within policy", job_id: null, tx_hash: null, property_id: "prop-1" },
  { ts: isoAgo(5 * HOUR), type: "RESOLVED", message: "Job #1043 settled · mike.ward-agent.eth paid 75.00 USDC · reputation 97 → 98", job_id: 1043, tx_hash: "0xsettle1043", property_id: "prop-2" },
  { ts: isoAgo(5 * HOUR), type: "DISPATCH", message: "Discovered mike.ward-agent.eth via ENS · top reputation in Greenwich, CT", job_id: 1043, tx_hash: null, property_id: "prop-2" },
  { ts: isoAgo(2 * MIN), type: "MONITOR", message: "Heartbeat OK · next sweep in 30s · treasury 500.00 USDC", job_id: null, tx_hash: null, property_id: null },
];

async function main(): Promise<void> {
  console.log(`Seeding ${SUPABASE_URL} …`);

  const p = await supabase.from("properties").upsert(properties, { onConflict: "id" });
  if (p.error) throw p.error;
  console.log(`  properties: ${properties.length}`);

  const w = await supabase.from("workers").upsert(workers, { onConflict: "handle" });
  if (w.error) throw w.error;
  console.log(`  workers: ${workers.length}`);

  const j = await supabase.from("jobs").upsert(jobs, { onConflict: "job_id" });
  if (j.error) throw j.error;
  console.log(`  jobs: ${jobs.length}`);

  // agent_events has an identity PK — clear then insert so reseeding is clean.
  const del = await supabase.from("agent_events").delete().neq("id", -1);
  if (del.error) throw del.error;
  const e = await supabase.from("agent_events").insert(events);
  if (e.error) throw e.error;
  console.log(`  agent_events: ${events.length}`);

  console.log("Seed complete.");
}

main().catch((error) => {
  console.error("seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
