# Rehub Privacy & Data Notes

## MVP posture (honest, not aspirational)
- **No real patient health information** is collected or stored. Demo data is
  fictional.
- **Nothing leaves the device:** no analytics, no external API calls, no voice
  data sent off-device. The Web Speech API runs in the browser.
- **All state lives in the browser's own `localStorage`,** scoped per facility
  (`rehub:facility:<id>`), plus per-device session keys.
- **Free-text input is sanitized** (`lib/security.ts`): control characters and
  angle brackets stripped, whitespace collapsed, length-capped (500 chars).
  React escapes output as a second layer.
- **Facility isolation:** each facility's data is stored and broadcast under its
  own key; a therapist dashboard only subscribes to its paired facility.

## What the MVP is NOT
- It is **not HIPAA compliant** and does not claim to be.
- It has **no real authentication** — device pairing is mock (`localStorage`).
- It is **not encrypted at rest** beyond what the browser/OS provides.

Do **not** enter real patient data into the demo.

## Production requirements (before any real PHI)
- **Authentication:** Supabase Auth; admin-created staff accounts.
- **Role-based access:** room device, therapist, admin — least privilege.
- **Row-level security:** every row scoped to `facility_id`; no cross-facility reads.
- **Encryption:** TLS in transit; encryption at rest for the database.
- **Audit logging:** immutable log built from `request_events` (who did what, when).
- **Signed device registration:** room/therapist devices registered and revocable.
- **Data retention & minimization:** store only what's needed; configurable retention.
- **Compliance review:** formal HIPAA-readiness review and BAAs with vendors
  before production use with real patients.

## Data model touchpoints
`Request` and `RequestEvent` carry only operational fields (room, type, priority,
status, timestamps, actor names). No clinical/medical record fields exist in the
schema. See `lib/types.ts`.
