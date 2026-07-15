-- ============================================================================
-- READ-ONLY diagnostic. Changes NOTHING. Run in the Supabase SQL editor and
-- send back all 4 result sets. Tells us exactly what state your DB is in so we
-- apply the right lockdown without breaking anything.
-- ============================================================================

-- 1) Which core tables exist?
select 'TABLES' as check, string_agg(table_name, ', ' order by table_name) as found
from information_schema.tables
where table_schema = 'public'
  and table_name in ('facilities','rooms','therapists','requests','request_events',
                     'device_sessions','leads','patient_messages','facility_members',
                     'profiles','facility_directory');

-- 2) Which security helper functions + patient RPCs exist?
select 'FUNCTIONS' as check, string_agg(routine_name, ', ' order by routine_name) as found
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('is_facility_owner','is_facility_member',
                       'submit_patient_request','get_request_status',
                       'public_facility_with_rooms');

-- 3) THE VULNERABILITY: any world-open policy for anon? (rows here = insecure)
select 'WORLD_OPEN_POLICIES' as check, tablename, policyname, roles::text, qual, with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true')
order by tablename;

-- 4) Full policy inventory on the patient-data tables.
select 'ALL_POLICIES' as check, tablename, policyname, cmd, roles::text
from pg_policies
where schemaname = 'public'
  and tablename in ('facilities','rooms','therapists','requests','request_events',
                    'device_sessions','leads','patient_messages','facility_members')
order by tablename, policyname;
