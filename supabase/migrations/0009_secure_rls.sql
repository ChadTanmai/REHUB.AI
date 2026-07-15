-- 0009_secure_rls.sql
-- ============================================================================
-- CRITICAL SECURITY FIX — remove every world-open (anon-accessible) policy.
--
-- Migration 0001 created, for local demo convenience, permissive policies
-- granting the anon role full read/write on facilities, rooms, therapists,
-- requests, request_events, device_sessions, leads. Postgres OR's permissive
-- policies, so as long as ANY such policy exists, anonymous clients can
-- read/write that table regardless of what other scoped policies exist.
--
-- IMPORTANT: on real deployments these policies are not reliably named
-- `demo_all` — a live check on this project found separate named policies per
-- table/command (e.g. "demo insert requests", "demo read requests"). This
-- migration is therefore NAME-AGNOSTIC: it finds and drops every policy that
-- grants the anon role access to these tables, whatever it's called.
--
-- Relies on, after this runs:
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

-- 1. Drop every policy that grants `anon` any access on the operational
--    tables, regardless of its name. This is the robust fix — it cannot be
--    defeated by a differently-named permissive policy.
do $$
declare pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'facilities','rooms','therapists','requests',
        'request_events','device_sessions','leads'
      )
      and 'anon' = any(roles)
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    raise notice 'Dropped anon policy % on %', pol.policyname, pol.tablename;
  end loop;
end $$;

-- 2. Ensure RLS stays enabled (idempotent — belt and suspenders).
--    Table-existence-safe: different installs of this schema may not have
--    every legacy table (e.g. some projects never created `therapists`,
--    managing staff through `facility_members` instead — 0006).
do $$
declare t text;
begin
  foreach t in array array[
    'facilities','rooms','therapists','requests',
    'request_events','device_sessions','leads'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table %I enable row level security', t);
    end if;
  end loop;
end $$;

-- 3. Owner-scoped policies for the remaining staff-managed tables — only for
--    tables that actually exist on this install.
do $$
begin
  if to_regclass('public.therapists') is not null then
    execute 'drop policy if exists therapists_owner on therapists';
    execute $p$
      create policy therapists_owner on therapists
        for all to authenticated
        using (is_facility_owner(facility_id))
        with check (is_facility_owner(facility_id))
    $p$;
  end if;

  if to_regclass('public.requests') is not null then
    execute 'drop policy if exists requests_owner on requests';
    execute $p$
      create policy requests_owner on requests
        for all to authenticated
        using (is_facility_owner(facility_id))
        with check (is_facility_owner(facility_id))
    $p$;
  end if;
end $$;

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
