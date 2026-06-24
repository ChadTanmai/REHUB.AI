-- Public facility lookup function.
-- Called by unauthenticated users during the join flow (patients, staff on new devices).
-- security definer = runs as the function owner (bypasses RLS), returning only safe fields.

create or replace function public_lookup_facility(code text)
returns json
language sql security definer set search_path = public
as $$
  select json_build_object(
    'id',            id,
    'name',          name,
    'facility_code', facility_code,
    'team_name',     team_name
  )
  from facilities
  where facility_code = upper(trim(code))
  limit 1;
$$;

-- Grant execute to anon and authenticated roles so it works without login.
grant execute on function public_lookup_facility(text) to anon, authenticated;
