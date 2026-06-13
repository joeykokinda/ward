-- WARD — canonical pre-staged demo state (INTERFACES.md + web/lib/data/fixtures.ts).
-- 3 properties, 5 workers (mike/sara/deon/lena/raj.ward-agent.eth), 3 historical
-- SETTLED jobs, sample agent_events. This is the state that must persist across
-- judge visits. Idempotent via upsert; re-running refreshes the demo cleanly.
--
-- USDC amounts are 6dp integer strings: 75 USDC = "75000000".
-- Timestamps are relative to now() so the feed always looks fresh.
-- Worker addresses are deterministic placeholders matching the mock fixtures'
-- fakeAddress(); the live demo overwrites them with real subname-owner wallets.

-- ── properties ──────────────────────────────────────────────────────────────
insert into public.properties (id, name, device_id, device_kind, region) values
  ('prop-1', 'The Brooklyn Loft', 'prop-1-router', 'router', 'Brooklyn, NY'),
  ('prop-2', 'Greenwich Cottage', 'prop-2-router', 'router', 'Greenwich, CT'),
  ('prop-3', 'Hudson Studio',     'prop-3-router', 'router', 'Hudson, NY')
on conflict (id) do update set
  name = excluded.name, device_id = excluded.device_id,
  device_kind = excluded.device_kind, region = excluded.region;

-- ── workers ─────────────────────────────────────────────────────────────────
-- reputation/skills/region match fixtures.ts exactly. mike = top rep in
-- Greenwich, so ENS discovery dispatches him in the scripted flow.
insert into public.workers
  (handle, ens_name, address, skills, region, reputation, staked, stake_usdc, completed_jobs) values
  ('mike', 'mike.ward-agent.eth', '0x1111111111111111111111111111111111111111',
     '{network,router,hardware}', 'Greenwich, CT', 98, true, '100000000', 41),
  ('sara', 'sara.ward-agent.eth', '0x2222222222222222222222222222222222222222',
     '{network,smart-lock}',      'Stamford, CT',  91, true, '100000000', 33),
  ('deon', 'deon.ward-agent.eth', '0x3333333333333333333333333333333333333333',
     '{hardware,hvac}',           'Brooklyn, NY',  87, true, '100000000', 28),
  ('lena', 'lena.ward-agent.eth', '0x4444444444444444444444444444444444444444',
     '{network,sensor}',          'Hudson, NY',    84, true, '100000000', 22),
  ('raj',  'raj.ward-agent.eth',  '0x5555555555555555555555555555555555555555',
     '{router,general}',          'Greenwich, CT', 79, true, '100000000', 17)
on conflict (handle) do update set
  ens_name = excluded.ens_name, address = excluded.address, skills = excluded.skills,
  region = excluded.region, reputation = excluded.reputation, staked = excluded.staked,
  stake_usdc = excluded.stake_usdc, completed_jobs = excluded.completed_jobs;

-- ── jobs (3 historical, all SETTLED) ────────────────────────────────────────
insert into public.jobs
  (job_id, property_id, device_id, worker, worker_address, amount, state,
   tx_create, tx_accept, tx_settle, created_at, settled_at, deadline) values
  (1041, 'prop-1', 'prop-1-router', 'deon.ward-agent.eth',
     '0x3333333333333333333333333333333333333333', '60000000', 'SETTLED',
     '0xcreate1041', '0xaccept1041', '0xsettle1041',
     now() - interval '52 hours', now() - interval '51 hours', now() - interval '48 hours'),
  (1042, 'prop-3', 'prop-3-router', 'lena.ward-agent.eth',
     '0x4444444444444444444444444444444444444444', '75000000', 'SETTLED',
     '0xcreate1042', '0xaccept1042', '0xsettle1042',
     now() - interval '28 hours', now() - interval '27 hours', now() - interval '24 hours'),
  (1043, 'prop-2', 'prop-2-router', 'mike.ward-agent.eth',
     '0x1111111111111111111111111111111111111111', '75000000', 'SETTLED',
     '0xcreate1043', '0xaccept1043', '0xsettle1043',
     now() - interval '6 hours', now() - interval '5 hours', now() - interval '2 hours')
on conflict (job_id) do update set
  property_id = excluded.property_id, device_id = excluded.device_id,
  worker = excluded.worker, worker_address = excluded.worker_address,
  amount = excluded.amount, state = excluded.state, tx_create = excluded.tx_create,
  tx_accept = excluded.tx_accept, tx_settle = excluded.tx_settle,
  created_at = excluded.created_at, settled_at = excluded.settled_at,
  deadline = excluded.deadline;

-- ── agent_events (sample reasoning feed) ────────────────────────────────────
-- Cleared + reinserted so re-seeding doesn't duplicate. job_id FKs are valid.
delete from public.agent_events;
insert into public.agent_events (ts, type, message, job_id, tx_hash, property_id) values
  (now() - interval '14 minutes', 'MONITOR',
     'Fleet sweep complete · 3/3 devices online · all telemetry nominal', null, null, null),
  (now() - interval '9 minutes', 'MONITOR',
     'prop-1-router uptime 4d 18h · signal -52dBm · within policy', null, null, 'prop-1'),
  (now() - interval '5 hours', 'RESOLVED',
     'Job #1043 settled · mike.ward-agent.eth paid 75.00 USDC · reputation 97 → 98',
     1043, '0xsettle1043', 'prop-2'),
  (now() - interval '5 hours', 'DISPATCH',
     'Discovered mike.ward-agent.eth via ENS · top reputation in Greenwich, CT', 1043, null, 'prop-2'),
  (now() - interval '2 minutes', 'MONITOR',
     'Heartbeat OK · next sweep in 30s · treasury 500.00 USDC', null, null, null);
