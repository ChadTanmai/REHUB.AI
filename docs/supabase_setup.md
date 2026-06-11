# Supabase Setup Guide

Rehub works in demo mode with no backend. To enable cross-device realtime
and persistent storage, follow these steps.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Wait for provisioning (~60 seconds).

## 2. Apply the database schema

Open the Supabase dashboard → **SQL Editor** and run:

```
supabase/migrations/0001_init.sql
```

This creates all tables, indexes, RLS policies, enums, and adds the live tables
to the realtime publication.

## 3. Import the facility directory

The national directory (1,221 US inpatient rehabilitation facilities) is already
in `lib/data/facilityDirectory.json`. Import it once with:

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node scripts/import-directory.mjs
```

Get the service role key from **Settings → API → service_role** (keep it secret —
never put it in client-side env vars or `.env.local`).

## 4. Add environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in the values from **Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

On **Vercel**: add these under **Project → Settings → Environment Variables**.

## 5. Verify

```bash
npm run dev
```

Open the browser console — if Supabase is configured correctly you'll see
Realtime channel confirmations as you submit requests.

## Security notes

### Demo mode (current)
The schema ships with "demo" RLS policies that allow anon reads/writes. This is
intentional for the pilot phase, when no real patient data is stored. Data is
scoped per facility via `facility_id` but not cryptographically gated.

### Before going live with real data
1. **Replace demo RLS with production RLS** — the scaffold is at the bottom of
   `0001_init.sql`. Create a `facility_members` table mapping `auth.uid()` to
   `facility_id` and scope every policy to authenticated members.
2. **Enable Supabase Auth** — create admin accounts, therapist accounts, and
   signed device JWTs for room tablets.
3. **Enable encryption at rest** — available on Supabase Pro+.
4. **Add audit logging** — `request_events` already captures every transition;
   add triggers or a separate audit table for authentication events.
5. **Compliance review** — conduct a HIPAA readiness review before storing any
   real protected health information. Supabase can sign a BAA on Pro+.

See `docs/privacy_notes.md` for the full data handling posture.

## Tables

| Table | Purpose |
| --- | --- |
| `facility_directory` | Read-only national rehab facility list (CMS public data) |
| `facilities` | Created facilities (one per community) |
| `rooms` | Individual room registrations |
| `therapists` | Care team members |
| `requests` | Live and historical patient requests |
| `request_events` | Immutable audit trail of every status transition |
| `device_sessions` | Paired room tablets and therapist devices |
| `leads` | Demo/marketing enquiries |

## Realtime

The following tables are in the Supabase Realtime publication:
- `requests` — new and updated requests fan out to every subscribed dashboard
- `request_events` — event stream for audit views
- `rooms` — room status updates

Subscriptions are scoped to a single facility via a `filter` clause, so
therapist A's dashboard only receives events from their facility.
