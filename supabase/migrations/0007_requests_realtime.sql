-- Patient requests/messages + realtime delivery to the nurse command center.
-- Patients are unauthenticated, so they insert via a SECURITY DEFINER RPC.
-- Nurses (facility owners) read/update via RLS and receive live updates via
-- Supabase Realtime. Safe to run more than once.
--
-- Note: only depends on facilities.owner_id (always present). It does NOT touch
-- facility_members, avoiding schema-mismatch errors there.

set check_function_bodies = off;

-- Owner check (relies only on facilities.owner_id).
create or replace function is_facility_owner(fid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from facilities where id = fid and owner_id = auth.uid());
$$;
grant execute on function is_facility_owner(uuid) to authenticated;

create table if not exists requests (
  id                uuid primary key default gen_random_uuid(),
  facility_id       uuid not null references facilities(id) on delete cascade,
  room_id           uuid,
  room_number       text,
  resident_name     text,
  text              text,
  source            text,
  request_type      text,
  priority          text,
  urgency_level     text,
  triage_reason     text,
  suggested_action  text,
  status            text not null default 'New',
  created_at        timestamptz not null default now(),
  acknowledged_at   timestamptz,
  resolved_at       timestamptz
);
create index if not exists idx_requests_facility on requests (facility_id, created_at desc);

alter table requests enable row level security;

do $$ begin
  create policy "requests_owner_select" on requests
    for select to authenticated using (is_facility_owner(facility_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "requests_owner_update" on requests
    for update to authenticated
    using (is_facility_owner(facility_id))
    with check (is_facility_owner(facility_id));
exception when duplicate_object then null; end $$;

-- Public submit (patients have no account).
create or replace function submit_patient_request(
  p_facility_code   text,
  p_room_id         uuid,
  p_room_number     text,
  p_resident_name   text,
  p_text            text,
  p_source          text,
  p_request_type    text,
  p_priority        text,
  p_urgency_level   text,
  p_triage_reason   text,
  p_suggested_action text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid; rid uuid;
begin
  select id into fid from facilities
   where regexp_replace(upper(facility_code), '[^A-Z0-9]', '', 'g')
       = regexp_replace(upper(p_facility_code), '[^A-Z0-9]', '', 'g')
   limit 1;
  if fid is null then return null; end if;

  insert into requests(
    facility_id, room_id, room_number, resident_name, text, source,
    request_type, priority, urgency_level, triage_reason, suggested_action, status
  ) values (
    fid, p_room_id, p_room_number, left(coalesce(p_resident_name,''),80),
    left(coalesce(p_text,''),500), p_source,
    p_request_type, p_priority, p_urgency_level, p_triage_reason, p_suggested_action, 'New'
  ) returning id into rid;
  return rid;
end $$;

grant execute on function submit_patient_request(text,uuid,text,text,text,text,text,text,text,text,text)
  to anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table requests;
exception when duplicate_object then null; when others then null; end $$;
