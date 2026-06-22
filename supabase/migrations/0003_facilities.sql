-- Facilities and membership tables.
-- Run after 0002_auth.sql.

-- ─── Facilities ────────────────────────────────────────────────────────────

create table if not exists facilities (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  facility_code   text not null unique,
  team_name       text,
  address         text,
  city            text,
  state           text,
  zip             text,
  phone           text,
  ccn             text,
  created_at      timestamptz not null default now(),
  owner_id        uuid not null references auth.users(id) on delete restrict
);

alter table facilities enable row level security;

-- ─── Facility Members ──────────────────────────────────────────────────────

create type if not exists facility_member_role as enum (
  'owner', 'admin', 'nurse', 'therapist', 'aide', 'patient'
);

create type if not exists facility_member_status as enum (
  'active', 'pending', 'suspended'
);

create table if not exists facility_members (
  id              uuid primary key default gen_random_uuid(),
  facility_id     uuid not null references facilities(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            facility_member_role not null default 'nurse',
  status          facility_member_status not null default 'pending',
  display_name    text,
  joined_at       timestamptz not null default now(),
  unique(facility_id, user_id)
);

alter table facility_members enable row level security;

-- ─── RLS Policies: Facilities ──────────────────────────────────────────────

-- Members of a facility can read it.
create policy "facility_members_can_read" on facilities
  for select to authenticated
  using (
    id in (
      select facility_id from facility_members
      where user_id = auth.uid() and status = 'active'
    )
    or owner_id = auth.uid()
  );

-- Only the owner can update their facility.
create policy "facility_owner_can_update" on facilities
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Authenticated users can insert a facility (they become owner via trigger).
create policy "authenticated_can_create_facility" on facilities
  for insert to authenticated
  with check (owner_id = auth.uid());

-- ─── RLS Policies: Members ────────────────────────────────────────────────

-- Members can see other members in the same facility.
create policy "members_can_read_same_facility" on facility_members
  for select to authenticated
  using (
    facility_id in (
      select facility_id from facility_members
      where user_id = auth.uid() and status = 'active'
    )
    or facility_id in (
      select id from facilities where owner_id = auth.uid()
    )
  );

-- Users can read their own membership.
create policy "members_can_read_own" on facility_members
  for select to authenticated
  using (user_id = auth.uid());

-- Facility owners and admins can manage members.
create policy "admins_can_manage_members" on facility_members
  for all to authenticated
  using (
    facility_id in (
      select id from facilities where owner_id = auth.uid()
    )
    or facility_id in (
      select facility_id from facility_members
      where user_id = auth.uid() and role in ('admin') and status = 'active'
    )
  )
  with check (
    facility_id in (
      select id from facilities where owner_id = auth.uid()
    )
    or facility_id in (
      select facility_id from facility_members
      where user_id = auth.uid() and role in ('admin') and status = 'active'
    )
  );

-- Users can insert their own pending membership (join flow).
create policy "users_can_join" on facility_members
  for insert to authenticated
  with check (user_id = auth.uid());

-- ─── Trigger: auto-create owner membership ────────────────────────────────

create or replace function handle_new_facility()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into facility_members (facility_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active');
  return new;
end;
$$;

drop trigger if exists on_facility_created on facilities;
create trigger on_facility_created
  after insert on facilities
  for each row execute procedure handle_new_facility();

-- ─── Helper: get user's active facility ───────────────────────────────────

create or replace function get_user_facility(uid uuid)
returns table(
  facility_id   uuid,
  facility_name text,
  facility_code text,
  member_role   facility_member_role,
  member_status facility_member_status
)
language sql security definer set search_path = public
as $$
  select
    f.id,
    f.name,
    f.facility_code,
    fm.role,
    fm.status
  from facility_members fm
  join facilities f on f.id = fm.facility_id
  where fm.user_id = uid
    and fm.status = 'active'
  order by fm.joined_at asc
  limit 1;
$$;
