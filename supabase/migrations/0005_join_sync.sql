-- Cross-device join: public lookup that returns a facility AND its rooms.
-- Replaces 0004's facility-only lookup. Security definer so unauthenticated
-- patients/staff can resolve a code from any device on any network.
--
-- Matching is DASH- and CASE-insensitive: TEST01, test-01, "TEST 01" all match
-- a facility whose code is TEST-01.

create or replace function public_facility_with_rooms(code text)
returns json
language sql security definer set search_path = public
as $$
  with norm as (
    select regexp_replace(upper(trim(code)), '[^A-Z0-9]', '', 'g') as needle
  ),
  fac as (
    select f.*
    from facilities f, norm
    where regexp_replace(upper(f.facility_code), '[^A-Z0-9]', '', 'g') = norm.needle
    limit 1
  )
  select case when fac.id is null then null else
    json_build_object(
      'id',            fac.id,
      'name',          fac.name,
      'facility_code', fac.facility_code,
      'team_name',     fac.team_name,
      'rooms', coalesce((
        select json_agg(json_build_object(
          'id',           r.id,
          'room_number',  r.room_number,
          'display_name', r.display_name,
          'active',       r.active
        ) order by r.room_number)
        from rooms r
        where r.facility_id = fac.id and r.active = true
      ), '[]'::json)
    )
  end
  from fac;
$$;

grant execute on function public_facility_with_rooms(text) to anon, authenticated;

-- Keep the old single-facility function working too (back-compat).
grant execute on function public_lookup_facility(text) to anon, authenticated;

-- Allow facility owners to upsert their own rooms from the client (RLS).
-- (rooms table comes from 0001_init.sql.)
alter table rooms enable row level security;

do $$ begin
  create policy "owner_can_manage_rooms" on rooms
    for all to authenticated
    using (facility_id in (select id from facilities where owner_id = auth.uid()))
    with check (facility_id in (select id from facilities where owner_id = auth.uid()));
exception when duplicate_object then null;
end $$;
