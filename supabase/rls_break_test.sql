-- ============================================================================
-- RLS Break-Test — run in the Supabase SQL editor AFTER applying 0009_secure_rls.
-- Proves that anonymous clients cannot read/write patient data directly and that
-- no permissive USING(true) policy remains. (Phase 3.2 / 3.3 of the audit.)
-- ============================================================================

-- ── TEST 1: no permissive `USING (true)` policy remains on sensitive tables ──
-- Expected result: ZERO rows. Any row printed is a world-open policy = FAIL.
select schemaname, tablename, policyname, roles, qual
from   pg_policies
where  schemaname = 'public'
  and  tablename in ('facilities','rooms','therapists','requests',
                     'request_events','device_sessions','leads','patient_messages')
  and  (qual = 'true' or with_check = 'true')
  and  ('anon' = any(roles) or '{public}'::name[] && roles);
-- ↑ 0 rows = PASS.  demo_all (or any USING(true) for anon) would appear here.

-- ── TEST 2: no policy of ANY name grants `anon` access to these tables ─────
-- Expected: ZERO rows. (Name-agnostic — do not rely on a specific policy name
-- like "demo_all"; on this project the open policies had different names.)
select tablename, policyname, roles::text from pg_policies
where schemaname = 'public'
  and tablename in ('facilities','rooms','therapists','requests',
                    'request_events','device_sessions','leads')
  and 'anon' = any(roles);

-- ── TEST 3: RLS is enabled on every patient-data table ─────────────────────
-- Expected: rowsecurity = true for ALL rows.
select relname as table, relrowsecurity as rls_enabled
from   pg_class
where  relname in ('facilities','rooms','therapists','requests',
                   'request_events','device_sessions','leads','patient_messages')
order by relname;

-- ── TEST 4: anonymous role cannot read patient data directly ───────────────
-- Actually switches to the anon role and counts visible rows per table.
-- Expected: every line reads "0 row(s) visible". Table-existence-safe — only
-- queries tables that exist on this install; catches permission-denied too
-- (an even more locked-down result, also a PASS).
do $$
declare t text;
declare n int;
begin
  set local role anon;
  foreach t in array array['facilities','rooms','therapists','requests','patient_messages']
  loop
    if to_regclass('public.' || t) is not null then
      begin
        execute format('select count(*) from %I', t) into n;
        raise notice '%: % row(s) visible to anon', t, n;
      exception when insufficient_privilege then
        raise notice '%: permission denied to anon (even more locked down — fine)', t;
      end;
    end if;
  end loop;
  reset role;
end $$;
-- ↑ every line should read "0 row(s) visible" (or "permission denied"). Any
-- other number = anon can still see rows = FAIL, investigate immediately.

-- ── TEST 5: the safe anon RPCs still work ──────────────────────────────────
-- These SECURITY DEFINER functions are the ONLY way anon reaches data, and they
-- validate input first. Replace 'YOUR-CODE' with a real facility join code.
--   select public_facility_with_rooms('YOUR-CODE');   -- returns facility + rooms
-- Expected: returns the facility for that code (proves patients can still join).

-- ── TEST 6 (manual): owner A cannot see owner B's rows ─────────────────────
-- In two separate authenticated sessions (two staff accounts in different
-- facilities), run:  select * from patient_messages;
-- Each must return ONLY their own facility's rows. Cross-facility rows = FAIL.
