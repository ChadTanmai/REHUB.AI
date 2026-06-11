# Rehub Roadmap

## Now (MVP — shipped)
- Patient room screen (`/room/[roomId]`) with voice bubble + large buttons + typed fallback
- Shared therapist dashboard (`/therapist`) with live queue, urgent strip, room grid, AI summary panel
- Admin analytics (`/admin`) with charts + CSV export
- Facility setup & device pairing (`/setup`, `/setup/room`, `/setup/therapist`)
- Deterministic AI classifier + transparent priority algorithm + non-diagnostic summaries
- Local realtime via localStorage + BroadcastChannel (Supabase-ready seam)
- Fictional demo data only; visible safety notes throughout

## Next
1. Supabase database (facilities, rooms, therapists, requests, request_events, ai_classifications, device_sessions)
2. Supabase Realtime subscriptions per facility
3. Authentication (Supabase Auth)
4. Role-based access (room device, therapist, admin)
5. Facility admin accounts
6. Resident profiles
7. Staff assignments (per-room coverage)
8. Push notifications
9. SMS alerts
10. Family limited-view portal
11. Audit logs (built from request_events)
12. CSV / PDF reports
13. Facility pilot testing
14. Real notification system
15. Multilingual resident input
16. Improved AI classification (after an approved, de-identified dataset)
17. Facility-specific priority settings
18. Optional subtle alert sounds (settings-gated)
19. Security & compliance review (HIPAA-readiness)

## Guardrails carried forward
- The AI never diagnoses or gives medical advice.
- Rehub never positions itself as an emergency or medical device.
- No real patient data until authentication, encryption, RLS, and audit logging are in place and reviewed.
