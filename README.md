# Rehub

**Care requests, visible instantly.**

Rehub is a communication and workflow platform for rehab centers, senior living
facilities, and care teams. It helps residents and recovering patients submit
simple requests, helps staff see and respond to those requests in a live
dashboard, and helps administrators understand response times and care workflow
patterns.

> **Mission:** Rehub exists to close the communication gap between residents and
> care teams by making every request visible, trackable, and easier to respond to.

---

## ⚠️ Safety positioning

Rehub is **not** a diagnosis app, a medical device, or an emergency response
system. It is a communication and workflow tool.

> **Rehub does not replace emergency response systems or medical judgment.**

The AI classifier may estimate urgency and request type, but it **never
diagnoses, never gives medical advice, and never tells a patient what condition
they have.** It only converts a resident's spoken or typed need into a
structured request for staff.

---

## What Rehub is

Rehub works as a **connected facility system**, not a set of separate pages:

- Each patient/resident has a **room screen / tablet / kiosk** in their room.
- Therapists/caregivers share a **dashboard** that shows requests from all
  assigned rooms.
- A **shared backend/server layer** connects them over Wi-Fi.
- Requests flow from room screens into the therapist dashboard **in real time**.
- Therapists can **acknowledge, assign, mark in progress, and resolve** requests.
- Admins can view **analytics** across rooms, therapists, request types, and
  response times.

### The four roles

| Role | Route | Purpose |
| --- | --- | --- |
| Patient Room Screen | `/room/[roomId]` | Always-available kiosk in a resident's room |
| Therapist Dashboard | `/therapist` | Shared live queue of all assigned rooms |
| Admin Dashboard | `/admin` | Analytics across the facility |
| Facility Setup / Pairing | `/setup`, `/setup/room`, `/setup/therapist` | Create facilities, pair devices |

Legacy single-screen demo pages (`/resident`, `/staff`) are kept for quick
walkthroughs, plus `/demo` (3-tab tour), `/about`, and `/facility` (overview).

---

## Core product loop

1. Resident opens a room screen (or the resident portal).
2. They **tap a large request button** or **speak to the AI bubble**.
3. If speaking, the bubble listens, transcribes, detects the request type,
   estimates urgency, and asks for confirmation.
4. Resident confirms.
5. The request appears in the therapist dashboard, **sorted by urgency and time
   waiting**.
6. A therapist **acknowledges → marks in progress → resolves**.
7. The room screen updates the resident's status at each step.
8. Admin analytics update automatically.

---

## Voice AI bubble

On the room/resident screen, a large circular bubble lets residents speak
naturally:

- Tap to start (the mic is **never** always-on).
- The bubble **grows and shrinks with live voice amplitude** (Web Audio API,
  scale 1.0 → 1.18) for a calm, breathing feel — no glow, no gradient.
- Speech-to-text uses the **Web Speech API** when available; otherwise it falls
  back to a typed input with the identical classification flow.
- Voice requests are **never auto-submitted** — the resident always confirms.

---

## Prioritization algorithm (transparent scoring)

Every number is auditable. See [`docs/prioritization_algorithm.md`](docs/prioritization_algorithm.md).

- **Base score by request type** (Pain 70, Help 60, Mobility 55, Medication 50,
  Bathroom 40, Custom 30, Food 20, Water 15).
- **Keyword modifiers**: urgent (+30–50), important (+10–25), routine (+0–10).
- **Repeated request**: 2+ unresolved from the same resident within 30 min → +15.
- **Time waiting**: +5 per 10 minutes to the *display* score (does not change the
  originally detected label).
- **Score → priority**: 0–39 Routine, 40–69 Important, 70+ Urgent.
- **Safety flag**: emergency-like phrases force Urgent and surface a message to
  use the facility emergency call system (never "call 911" — facilities have
  their own protocols).

---

## Tech stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** with a custom flat healthcare palette
- **Recharts** for analytics
- **Web Speech API** (demo speech-to-text) + **Web Audio API** (amplitude)
- **Local/mock realtime** via `localStorage` + `BroadcastChannel`
- **Supabase** documented for production (not required for the MVP)

---

## Architecture: Wi-Fi / server model

Patient room screens and therapist dashboards **never talk to each other
directly.** They both read and write a shared **facility workspace**:

```
Room screen ─┐                          ┌─ Therapist dashboard
             ├─►  Rehub facility queue  ◄─┤
Room screen ─┘     (shared backend)     └─ Therapist dashboard
                          │
                          └─► Admin analytics
```

In this MVP the shared layer is:

- **`localStorage`** — the shared source of truth (survives reloads), scoped per
  facility.
- **`BroadcastChannel`** — real-time fan-out across every tab/device on the host.

This is intentionally shaped like **Supabase Realtime**: `store.subscribe()`
mirrors a channel subscription, and each mutation is an atomic write that fans
out to all subscribers. Swapping in Supabase means replacing the persistence +
broadcast internals in `lib/store.ts` — **call sites do not change.** See
`lib/supabase.ts` and [`docs/product_spec.md`](docs/product_spec.md).

> **Try it live:** open `/room/<id>` in one tab and `/therapist` in another.
> Submit a request on the room screen and watch it appear instantly on the
> dashboard.

---

## Setup

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

No environment variables or backend are required for the MVP.

### Demo pairing

- Facility code: **`REHUB-DEMO`**
- Pair a room at `/setup/room`, a therapist at `/setup/therapist`, or jump
  straight into `/demo`.

---

## Project structure

```
app/        # routes (home, resident, staff, admin, demo, about,
            #         room/[roomId], therapist, setup*, facility)
components/  # UI: voice bubble, request panels, dashboard, charts, badges
lib/        # types, classifier, priority algorithm, summaries, store,
            # session/pairing, analytics, voice + security utils, mock data
docs/       # roadmap, product spec, safety, prioritization, privacy
```

---

## Limitations

- MVP uses **fictional demo data only** — no real patient health information.
- Realtime is **per-browser** (localStorage + BroadcastChannel). True
  cross-device sync needs the documented Supabase backend.
- Speech-to-text depends on browser support (Chrome/Edge/Safari); a typed
  fallback always works.
- **No authentication** beyond mock device pairing.
- **Not HIPAA compliant.** Do not enter real patient data.

---

## Roadmap

See [`docs/roadmap.md`](docs/roadmap.md). Highlights: Supabase database +
Realtime, authentication & role-based access, audit logs, push/SMS alerts, a
family limited-view portal, multilingual input, and a security/compliance review.

---

## Safety & privacy notes

- [`docs/safety_notes.md`](docs/safety_notes.md)
- [`docs/privacy_notes.md`](docs/privacy_notes.md)

Rehub is a communication and workflow tool. It does not replace emergency
response systems or medical judgment.
