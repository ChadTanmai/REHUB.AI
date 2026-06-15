-- Auth extension: profiles table linked to Supabase Auth users.
-- Run this AFTER 0001_init.sql.

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  facility_name text,
  role         text not null default 'facility_director',
  created_at   timestamptz not null default now()
);

alter table profiles enable row level security;

-- Users can only read and update their own profile.
create policy "profiles_own" on profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a profile when a user signs up.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (id, full_name, facility_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'facility_name',
    coalesce(new.raw_user_meta_data->>'role', 'facility_director')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
