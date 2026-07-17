-- 0010_login_events.sql
-- Sign-in history for the account security settings page.
--
-- Scope note: this is a client-logged sign-in history, not a live "active
-- sessions across devices" registry — Supabase's client SDK has no API for
-- listing/revoking individual sessions without a service-role backend. This
-- table answers "when and where did I recently sign in", which is what
-- /account/settings shows. "Sign out of all devices" is handled separately by
-- supabase.auth.signOut({ scope: "global" }) client-side — no schema needed.
--
-- Run after 0009_secure_rls.sql.

create table if not exists login_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  occurred_at  timestamptz not null default now(),
  user_agent   text
);

alter table login_events enable row level security;

-- Each user can read only their own sign-in history.
drop policy if exists "users_read_own_login_events" on login_events;
create policy "users_read_own_login_events" on login_events
  for select to authenticated
  using (user_id = auth.uid());

-- Each user can log their own sign-ins (called from AuthProvider on SIGNED_IN).
drop policy if exists "users_insert_own_login_events" on login_events;
create policy "users_insert_own_login_events" on login_events
  for insert to authenticated
  with check (user_id = auth.uid());

-- Keep the table small: an index for the "last 5, newest first" query.
create index if not exists login_events_user_id_occurred_at_idx
  on login_events (user_id, occurred_at desc);
