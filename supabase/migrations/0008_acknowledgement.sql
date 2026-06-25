-- Acknowledgement-back-to-patient.
--
-- Adds who-acknowledged tracking and a public (anon-safe) RPC so the patient's
-- un-authenticated device can poll the status of a request it submitted and be
-- told "Nurse Sarah is on the way" — without exposing patient_messages via RLS.
-- Safe to run more than once.

set check_function_bodies = off;

alter table patient_messages add column if not exists acknowledged_by text;

create or replace function get_request_status(p_id uuid)
returns json
language sql security definer set search_path = public stable as $$
  select json_build_object(
    'id',              id,
    'status',          status,
    'acknowledged_by', acknowledged_by,
    'acknowledged_at', acknowledged_at,
    'resolved_at',     resolved_at
  )
  from patient_messages
  where id = p_id;
$$;

grant execute on function get_request_status(uuid) to anon, authenticated;
