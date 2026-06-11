# Rehub Product Spec

## System model
Rehub is a connected facility system with four roles:
1. **Patient Room Screen** — `/room/[roomId]`
2. **Therapist Dashboard** — `/therapist`
3. **Admin Dashboard** — `/admin`
4. **Facility Setup / Pairing** — `/setup`, `/setup/room`, `/setup/therapist`

One facility owns many rooms, many patient screens, and many therapists. All
share one live request stream.

## Wi-Fi / server model
Room screens and therapist dashboards never communicate directly. Both read and
write a shared **facility workspace** (the "server layer").

- Room screen: submits requests, listens for status updates.
- Backend: stores requests, computes priority, broadcasts to dashboards, logs events.
- Therapist dashboard: subscribes to the facility stream, sends status updates back.
- Admin dashboard: reads request/event data for analytics.

> Rehub connects patient room screens and therapist dashboards through a shared
> facility workspace. Each room device submits requests into the facility queue,
> and every authorized therapist dashboard subscribed to that facility receives
> updates in real time.

### MVP implementation of the shared layer
- `localStorage` keyed `rehub:facility:<facilityId>` = shared source of truth.
- `BroadcastChannel("rehub-sync")` = realtime fan-out across tabs/devices on the host.
- `lib/store.ts` exposes `subscribe()` / mutations shaped like a realtime channel.

### Production implementation
- Supabase Postgres for storage.
- Supabase Realtime channel `facility:<id>` subscribed to `requests` and
  `request_events` filtered by `facility_id`.
- Replace persistence + broadcast internals in `lib/store.ts`; **call sites
  unchanged**.

## Data model
See `lib/types.ts`. Core entities: `Facility`, `Room`, `Therapist`, `Request`,
`RequestEvent`, `DeviceSession` (plus legacy `Resident`, `StaffMember`).

### Planned Supabase tables
`facilities`, `rooms`, `therapists`, `requests`, `request_events`,
`ai_classifications`, `device_sessions`.

## Request lifecycle
States: **New → Acknowledged → In Progress → Resolved**

Allowed transitions:
- New → Acknowledged
- Acknowledged → In Progress
- In Progress → Resolved
- New → In Progress (therapist starts helping immediately)
- New → Resolved (accidental / duplicate only)

Every transition writes a `RequestEvent`. Response time is computed at resolve.

## Patient status messages
- Sent: "Your request has been sent to the care team."
- Acknowledged: "A staff member has seen your request."
- In Progress: "A staff member is helping now."
- Resolved: "Your request has been marked resolved."
- Safety flag: "Staff has been notified. If this is life-threatening, use the
  facility emergency call system."

## Alert system
- Routine → small toast
- Important → stronger toast/banner
- Urgent → persistent top strip until acknowledged
- Repeated unresolved urgent → escalates visually
- Low-confidence voice → flagged on the row
- No loud alarm sound in MVP (optional subtle sound later, settings-gated)

## AI summary rules
`lib/aiSummary.ts` produces a short staff summary + a patient confirmation.
Summaries restate what the resident said and why it was prioritized. They never
diagnose.

- Good: "Resident says they are dizzy and cannot stand. Classified urgent
  because of dizziness and mobility limitation."
- Bad: "Patient may have a neurological issue."

## Pairing / auth (MVP)
Mock authentication using `localStorage` device sessions, demo code `REHUB-DEMO`.
No passwords. Production replaces this with Supabase Auth, role-based access,
admin-created staff accounts, facility-scoped access, signed room-device
registration, and audit logs.
