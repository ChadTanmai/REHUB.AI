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

-- ── TEST 2: `demo_all` is gone everywhere ──────────────────────────────────
-- Expected: ZERO rows.
select tablename, policyname from pg_policies
where schemaname = 'public' and policyname = 'demo_all';

-- ── TEST 3: RLS is enabled on every patient-data table ─────────────────────
-- Expected: rowsecurity = true for ALL rows.
select relname as table, relrowsecurity as rls_enabled
from   pg_class
where  relname in ('facilities','rooms','therapists','requests',
                   'request_events','device_sessions','leads','patient_messages')
order by relname;

-- ── TEST 4: anonymous role cannot read patient data directly ───────────────
-- Simulate the anon role a patient device uses. Expected: 0 rows each (RLS
-- denies — there is no anon policy). If any returns rows, isolation FAILED.
set local role anon;
select 'facilities'      as t, count(*) from facilities
union all select 'rooms',           count(*) from rooms
union all select 'therapists',      count(*) from therapists
union all select 'requests',        count(*) from requests
union all select 'patient_messages',count(*) from patient_messages;
reset role;
-- ↑ every count = 0 = PASS (anon is fully walled off from direct table reads).

-- ── TEST 5: the safe anon RPCs still work ──────────────────────────────────
-- These SECURITY DEFINER functions are the ONLY way anon reaches data, and they
-- validate input first. Replace 'YOUR-CODE' with a real facility join code.
--   select public_facility_with_rooms('YOUR-CODE');   -- returns facility + rooms
-- Expected: returns the facility for that code (proves patients can still join).

-- ── TEST 6 (manual): owner A cannot see owner B's rows ─────────────────────
-- In two separate authenticated sessions (two staff accounts in different
-- facilities), run:  select * from patient_messages;
-- Each must return ONLY their own facility's rows. Cross-facility rows = FAIL.
