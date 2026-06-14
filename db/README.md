# WARD — Supabase Persistence (`db/`)

Persistent demo state for WARD: properties, workers (with ENS subnames +
reputation), jobs, and the agent reasoning feed. This is the **pre-staged state
that must survive across judge visits** — by Sunday the dashboard shows real
historical activity, not a fresh boot.

```
db/
├── migrations/0001_init.sql   schema (tables, enums, indexes, RLS)
├── seed/0001_seed.sql         canonical demo data (SQL, recommended)
├── seed/run.ts                same data via supabase-js (service-role key)
├── package.json               `pnpm seed`, `pnpm typecheck`
└── README.md                  this file
```

## Schema (matches `web/lib/data/`)

| table | key columns |
|---|---|
| `properties` | `id`, `name`, `device_id`, `device_kind`, `region` |
| `workers` | `handle` (pk), `ens_name`, `address`, `skills text[]`, `region`, `reputation`, `staked`, `stake_usdc`, `completed_jobs` |
| `jobs` | `job_id` (pk), `property_id`, `device_id`, `worker`, `worker_address`, `amount`, `state` (enum), `tx_create`, `tx_accept`, `tx_settle`, `created_at`, `settled_at`, `deadline` |
| `agent_events` | `id` (pk), `ts`, `type` (enum), `message`, `job_id`, `tx_hash`, `property_id` |

- USDC amounts are **6-decimal integers stored as `text`** (`75 USDC = "75000000"`)
  so BigInt precision survives the JS round-trip. The frontend formats them.
- `job_state` enum = the canonical lifecycle (`OPEN → ACCEPTED → WORK_DONE →
  ATTESTING → SETTLED`, plus `EXPIRED`/`REFUNDED`).
- `agent_log_type` enum = the `LogType` set (`MONITOR | DIAGNOSE |
  ACTION | RESULT | ESCROW | DISPATCH | RESOLVED`).
- **RLS is enabled** on every table with a public `SELECT` policy (anon key can
  read). Writes use the **service-role key**, which bypasses RLS — only the
  agent/seed runner holds it.

## 1. Create a free Supabase project

1. Go to <https://supabase.com> → sign in → **New project**.
2. Pick the **Free** tier, choose a region near the venue, set a DB password.
3. After provisioning, grab the values from **Project Settings → API**:
   - **Project URL** → `https://<ref>.supabase.co` (this is `SUPABASE_URL` and
     `NEXT_PUBLIC_SUPABASE_URL`)
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe in the
     browser; read-only via RLS)
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (secret; **never** ship
     to the browser; used only by the seed runner / agent to write)
   - DB connection string (for `psql`) → **Project Settings → Database →
     Connection string** (URI). This is `DATABASE_URL`.

## 2. Run the migration

The Supabase CLI is installed at `~/.npm-global/bin/supabase` (v2.x).

**Option A — SQL editor (no CLI):** open **SQL Editor** in the dashboard, paste
`migrations/0001_init.sql`, run. Then paste `seed/0001_seed.sql`, run.

**Option B — Supabase CLI (linked project):**

```bash
export PATH="$HOME/.npm-global/bin:$PATH"

# one-time: link this folder to your project (uses the project ref from the URL)
supabase link --project-ref <ref>

# apply the migration. The CLI looks in supabase/migrations by convention; the
# simplest reliable path is to push the SQL directly via psql (Option C), or
# copy db/migrations/0001_init.sql into supabase/migrations/ first.
supabase db lint --linked          # static schema check, optional
```

**Option C — psql (most direct):**

```bash
# DATABASE_URL from Project Settings → Database → Connection string (URI form)
psql "$DATABASE_URL" -f db/migrations/0001_init.sql
psql "$DATABASE_URL" -f db/seed/0001_seed.sql
```

The migration and seed are **idempotent** — re-running refreshes the demo
cleanly (upserts everywhere; `agent_events` is cleared and reinserted). Both have
been validated end-to-end against Postgres 16 (see "Validation" below).

## 3. Apply the seed

Either run `db/seed/0001_seed.sql` (Option A/C above), **or** use the TS runner
when you only have API keys and no direct psql access:

```bash
cd db
pnpm install
export SUPABASE_URL="https://<ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role secret>"
pnpm seed
```

Seeds **3 properties**, **5 workers** (`mike/sara/deon/lena/raj.ward-agent.eth`
with skills/region/reputation), **3 SETTLED historical jobs** (#1041/#1042/#1043,
210 USDC total settled), and **5 sample `agent_events`** including a `DISPATCH`
event referencing ENS discovery. The data is identical to
`web/lib/data/fixtures.ts`, so the `mock` and `supabase` adapters agree.

## 4. Environment variables

| var | where | purpose |
|---|---|---|
| `SUPABASE_URL` | agent + seed runner | project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | agent + seed runner only (secret) | write access, bypasses RLS |
| `NEXT_PUBLIC_SUPABASE_URL` | frontend (`web/`) | project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | frontend (`web/`) | read-only anon key (public) |
| `NEXT_PUBLIC_DATA_ADAPTER` | frontend | set to `supabase` to read live; default `mock` |
| `DATABASE_URL` | local tooling | psql connection string |

The root `.env.example` already lists `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Add
`SUPABASE_SERVICE_ROLE_KEY` (server-side only) for the seed runner/agent.

## 5. Local fallback (no Supabase needed)

The frontend ships a **mock adapter** (`web/lib/data/mock.ts`) selected by
default (`NEXT_PUBLIC_DATA_ADAPTER` unset or `mock`). It serves the same
fixtures, so `web/` builds and runs with **zero credentials**. The
`supabase` adapter (`web/lib/data/supabase.ts`) also **falls back to fixtures**
if `NEXT_PUBLIC_SUPABASE_*` is missing or a query fails — it never hard-crashes.
Use Supabase only for the persistent, cross-visit live demo.

> Frontend note: `web/lib/data/supabase.ts` `rowToWorker` reads `skills` via
> `String(r.skills).split(",")`. Postgres `text[]` is returned by supabase-js as
> a JS array, and `String(["a","b"])` → `"a,b"`, so this works as-is. If the web
> owner prefers, store `skills` as a comma `text` column instead — the schema
> change is local to `workers.skills`.

## Validation performed

Migration + seed were applied to a real Postgres 16 instance (Docker), run
twice to confirm idempotency, and verified: 3 properties / 5 workers / 3 jobs /
5 events; worker reputation ranking correct (mike 98 → raj 79); 210 USDC settled
total; both enum types present; RLS enabled on all four tables.
