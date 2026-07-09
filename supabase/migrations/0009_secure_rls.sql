-- 0009_secure_rls.sql
-- ============================================================================
-- CRITICAL SECURITY FIX — remove the world-open `demo_all` policies.
--
-- Migration 0001 created, for local demo convenience:
--     create policy demo_all on <table> for all to anon, authenticated
--       using (true) with check (true);
-- on facilities, rooms, therapists, requests, request_events, device_sessions,
-- leads. Postgres OR's permissive policies, so as long as demo_all exists, ANY
-- anonymous client can read/write ALL patient data in those tables — the
-- owner-scoped policies added in 0005/0006/0007 are shadowed and meaningless.
--
-- This migration drops demo_all everywhere and relies on:
--   • owner/member-scoped policies (0005 rooms, 0006 facilities/members,
--     0007 patient_messages) for authenticated staff, and
--   • SECURITY DEFINER RPCs for the anonymous patient paths, which bypass RLS
--     safely after validating input:
--        - public_facility_with_rooms(code)   → join-code lookup   (0004)
--        - submit_patient_request(...)         → patient submits    (0007)
--        - get_request_status(p_id)            → patient polls own  (0007)
--
-- After this runs, anonymous clients have NO direct table access — they can
-- only reach data through the three validated RPCs above. Staff see only their
-- own facility's rows.
--
-- ⚠️  APPLY + BREAK-TEST before putting real patient data in Supabase.
--     Run supabase/rls_break_test.sql to confirm isolation.
-- ============================================================================

-- 1. Drop the permissive demo policies on every operational table.
do $$
declare t text;
begin
  foreach t in array array[
    'facilities','rooms','therapists','requests',
    'request_events','device_sessions','leads'
  ]
  loop
    execute format('drop policy if exists demo_all on %I', t);
  end loop;
end $$;

-- 2. Ensure RLS stays enabled (idempotent — belt and suspenders).
alter table facilities      enable row level security;
alter table rooms           enable row level security;
alter table therapists      enable row level security;
alter table requests        enable row level security;
alter table request_events  enable row level security;
alter table device_sessions enable row level security;
alter table leads           enable row level security;

-- 3. Owner-scoped policies for the remaining staff-managed tables.
--    (facilities/facility_members → 0006, rooms → 0005, patient_messages → 0007
--     already have scoped policies; dropping demo_all leaves those in force.)
--
--    therapists and the legacy `requests`/`request_events` tables get explicit
--    owner-only access so authenticated staff still work while anon is denied.
drop policy if exists therapists_owner on therapists;
create policy therapists_owner on therapists
  for all to authenticated
  using (is_facility_owner(facility_id))
  with check (is_facility_owner(facility_id));

drop policy if exists requests_owner on requests;
create policy requests_owner on requests
  for all to authenticated
  using (is_facility_owner(facility_id))
  with check (is_facility_owner(facility_id));

-- request_events, device_sessions, leads:
--   • leads is written to localStorage only (lib/leads.ts) — the DB table is
--     unused by the app, so it stays default-DENY (no policy).
--   • request_events and device_sessions are legacy (superseded by
--     patient_messages / local pairing) and are left default-DENY.
--   Add owner-scoped policies here if/when a staff feature reads them.
--
--   Default-deny is the safe state: with RLS enabled and no permissive policy,
--   Postgres denies all access. The redundant fire-and-forget anon writes to
--   `requests`/`request_events` in lib/store.ts will simply no-op (they are
--   wrapped in .catch); the authoritative patient path is patient_messages.

-- Note: the anon patient RPCs (public_facility_with_rooms, submit_patient_request,
-- get_request_status) are SECURITY DEFINER and already have EXECUTE granted to
-- anon/authenticated (Supabase default). Dropping demo_all does NOT affect them.
