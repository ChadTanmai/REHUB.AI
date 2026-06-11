-- Rehub — initial schema
-- Run in the Supabase SQL editor, or via `supabase db push`.
--
-- Design notes:
--   * One facility owns many rooms, therapists, requests, and events.
--   * `facility_directory` is public, read-only reference data (CMS provider
--     list) used for onboarding auto-fill — it contains NO patient data.
--   * RLS is enabled on every table. Two policy sets are provided:
--       - DEMO policies (anon can read/write operational tables) so the app
--         works immediately with just the anon key.
--       - PRODUCTION policies (commented) scope every row to an authenticated
--         facility membership. Replace the demo policies before storing any
--         real data. See docs/supabase_setup.md and docs/privacy_notes.md.

-- ── Extensions ────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────────────────────
do $$ begin
  create type request_type as enum
    ('Help','Pain','Bathroom','Water','Food','Mobility','Medication Question','Custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type priority as enum ('Routine','Important','Urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('New','Acknowledged','In Progress','Resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_source as enum ('Button','Voice','Typed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type device_type as enum ('room','therapist','admin');
exception when duplicate_object then null; end $$;

-- ── Reference: national facility directory (public, read-only) ────────────
create table if not exists facility_directory (
  ccn         text primary key,
  name        text not null,
  address     text,
  city        text,
  state       text,
  zip         text,
  county      text,
  phone       text,
  ownership   text
);
create index if not exists idx_directory_name  on facility_directory using gin (to_tsvector('simple', name));
create index if not exists idx_directory_state on facility_directory (state);

-- ── Facilities ────────────────────────────────────────────────────────────
create table if not exists facilities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  facility_code text not null unique,
  team_name     text,
  room_count    int default 0,
  address       text,
  city          text,
  state         text,
  zip           text,
  phone         text,
  ccn           text references facility_directory(ccn),
  created_at    timestamptz not null default now()
);

-- ── Rooms ─────────────────────────────────────────────────────────────────
create table if not exists rooms (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references facilities(id) on delete cascade,
  room_number  text not null,
  display_name text,
  active       boolean not null default true,
  device_id    text,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (facility_id, room_number)
);
create index if not exists idx_rooms_facility on rooms (facility_id);

-- ── Therapists ────────────────────────────────────────────────────────────
create table if not exists therapists (
  id             uuid primary key default gen_random_uuid(),
  facility_id    uuid not null references facilities(id) on delete cascade,
  name           text not null,
  role           text,
  assigned_rooms jsonb not null default '"all"'::jsonb,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists idx_therapists_facility on therapists (facility_id);

-- ── Requests ──────────────────────────────────────────────────────────────
create table if not exists requests (
  id                   uuid primary key default gen_random_uuid(),
  facility_id          uuid not null references facilities(id) on delete cascade,
  room_id              uuid references rooms(id) on delete set null,
  room_number          text,
  resident_name        text,
  request_type         request_type not null,
  priority             priority not null,
  priority_score       int not null default 0,
  status               request_status not null default 'New',
  notes                text,
  ai_summary           text,
  source               request_source not null,
  transcript           text,
  ai_confidence        real default 0,
  detected_keywords    text[] default '{}',
  safety_flag          boolean not null default false,
  assigned_therapist   text,
  acknowledged_by      text,
  response_time_minutes real,
  created_at           timestamptz not null default now(),
  acknowledged_at      timestamptz,
  in_progress_at       timestamptz,
  resolved_at          timestamptz
);
create index if not exists idx_requests_facility on requests (facility_id);
create index if not exists idx_requests_status   on requests (facility_id, status);
create index if not exists idx_requests_created   on requests (facility_id, created_at desc);

-- ── Request events (audit trail) ──────────────────────────────────────────
create table if not exists request_events (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references requests(id) on delete cascade,
  facility_id uuid not null references facilities(id) on delete cascade,
  event_type  text not null,
  actor_type  text not null,
  actor_name  text,
  old_status  request_status,
  new_status  request_status,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_events_request  on request_events (request_id);
create index if not exists idx_events_facility on request_events (facility_id, created_at desc);

-- ── Device sessions ───────────────────────────────────────────────────────
create table if not exists device_sessions (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references facilities(id) on delete cascade,
  device_type  device_type not null,
  room_id      uuid references rooms(id) on delete cascade,
  therapist_id uuid references therapists(id) on delete cascade,
  device_name  text,
  last_seen_at timestamptz not null default now()
);

-- ── Leads (marketing / demo requests) ─────────────────────────────────────
create table if not exists leads (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  name       text,
  email      text,
  facility   text,
  role       text,
  rooms      text,
  message    text,
  created_at timestamptz not null default now()
);

-- ── Realtime ──────────────────────────────────────────────────────────────
-- Add the live tables to the realtime publication so dashboards get push updates.
do $$ begin
  alter publication supabase_realtime add table requests;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table request_events;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table rooms;
exception when duplicate_object then null; end $$;

-- ── Row Level Security ────────────────────────────────────────────────────
alter table facility_directory enable row level security;
alter table facilities         enable row level security;
alter table rooms              enable row level security;
alter table therapists         enable row level security;
alter table requests           enable row level security;
alter table request_events     enable row level security;
alter table device_sessions    enable row level security;
alter table leads              enable row level security;

-- Directory: public read only.
drop policy if exists directory_read on facility_directory;
create policy directory_read on facility_directory for select using (true);

-- ─────────────────────────────────────────────────────────────────────────
-- DEMO POLICIES (anon may read/write operational tables).
-- These let the app run with only the anon key. They are NOT safe for real
-- patient data. Drop them and apply the PRODUCTION policies below before
-- going live. See docs/privacy_notes.md.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['facilities','rooms','therapists','requests','request_events','device_sessions','leads']
  loop
    execute format('drop policy if exists demo_all on %I', t);
    execute format(
      'create policy demo_all on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- PRODUCTION POLICIES (scaffold — enable with Supabase Auth + a memberships
-- table that maps auth.uid() → facility_id). Example:
--
--   create table facility_members (
--     user_id uuid references auth.users(id),
--     facility_id uuid references facilities(id),
--     role text, primary key (user_id, facility_id));
--
--   create policy facility_scoped on requests for all to authenticated
--     using (facility_id in (select facility_id from facility_members
--                            where user_id = auth.uid()))
--     with check (facility_id in (select facility_id from facility_members
--                                 where user_id = auth.uid()));
--
-- Repeat per operational table. Room devices use a separate signed device JWT
-- scoped to a single facility_id / room_id.
-- ─────────────────────────────────────────────────────────────────────────
