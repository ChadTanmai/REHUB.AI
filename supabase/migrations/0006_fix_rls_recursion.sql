-- Fix 42P17: infinite recursion in facility_members / facilities RLS.
--
-- The original policies referenced facility_members from inside a policy ON
-- facility_members (and facilities' policy referenced facility_members, whose
-- policy referenced facility_members again) → infinite recursion on any insert.
--
-- Fix: do membership/ownership checks in SECURITY DEFINER functions, which run
-- as the function owner and BYPASS RLS, so the policies never re-enter
-- themselves. Safe to run more than once.

-- ── Helper functions (RLS-bypassing) ───────────────────────────────────────
create or replace function is_facility_owner(fid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from facilities where id = fid and owner_id = auth.uid());
$$;

create or replace function is_facility_member(fid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from facility_members
    where facility_id = fid and user_id = auth.uid() and status = 'active'
  );
$$;

revoke all on function is_facility_owner(uuid)  from public;
revoke all on function is_facility_member(uuid) from public;
grant execute on function is_facility_owner(uuid)  to authenticated;
grant execute on function is_facility_member(uuid) to authenticated;

-- ── Drop the old recursive policies ─────────────────────────────────────────
drop policy if exists "facility_members_can_read"        on facilities;
drop policy if exists "facility_owner_can_update"         on facilities;
drop policy if exists "authenticated_can_create_facility" on facilities;
drop policy if exists "facilities_select"                 on facilities;
drop policy if exists "facilities_insert"                 on facilities;
drop policy if exists "facilities_update"                 on facilities;
drop policy if exists "facilities_delete"                 on facilities;

drop policy if exists "members_can_read_same_facility" on facility_members;
drop policy if exists "members_can_read_own"           on facility_members;
drop policy if exists "admins_can_manage_members"      on facility_members;
drop policy if exists "users_can_join"                 on facility_members;
drop policy if exists "members_select"                 on facility_members;
drop policy if exists "members_insert"                 on facility_members;
drop policy if exists "members_update"                 on facility_members;
drop policy if exists "members_delete"                 on facility_members;

-- ── Facilities: non-recursive policies ──────────────────────────────────────
create policy "facilities_select" on facilities
  for select to authenticated
  using (owner_id = auth.uid() or is_facility_member(id));

create policy "facilities_insert" on facilities
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "facilities_update" on facilities
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "facilities_delete" on facilities
  for delete to authenticated
  using (owner_id = auth.uid());

-- ── Facility members: non-recursive policies ────────────────────────────────
create policy "members_select" on facility_members
  for select to authenticated
  using (user_id = auth.uid() or is_facility_owner(facility_id));

create policy "members_insert" on facility_members
  for insert to authenticated
  with check (user_id = auth.uid() or is_facility_owner(facility_id));

create policy "members_update" on facility_members
  for update to authenticated
  using (is_facility_owner(facility_id))
  with check (is_facility_owner(facility_id));

create policy "members_delete" on facility_members
  for delete to authenticated
  using (is_facility_owner(facility_id));
