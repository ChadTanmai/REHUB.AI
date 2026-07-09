# ReHub — Security Hardening Audit

_Senior application-security review. Every item was verified against actual code/config; nothing is assumed. File:line references are provided as proof._

**Audited:** `rehub-app` (Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase optional, Vercel).
**Scope:** static analysis of the repository + configuration. Live penetration testing (RLS break-tests, `npm audit`, deployed-CORS probing) requires a running Supabase instance and an unfiltered network — flagged as `NEEDS HUMAN` where applicable.

---

## Phase 0 — Recon & threat-surface map

**Stack**

| Layer | Finding |
|---|---|
| Framework | Next.js `16.2.7` (App Router), React `19.2.4`, TypeScript |
| Styling | Tailwind v4 (`@tailwindcss/postcss`) |
| Data / auth | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) — **optional**; app falls back to localStorage/in-memory "demo mode" when env vars are absent |
| External APIs | Anthropic (`@anthropic-ai/sdk`), ElevenLabs (via REST) — server-side only |
| Hosting | Vercel (serverless functions, edge) |
| Package manager | npm (`package-lock.json`) |
| Secrets | `.env.local` (gitignored); Vercel env vars in prod |

**Untrusted-input entry points**

| Entry point | Location |
|---|---|
| Patient voice/typed request | `app/patient/page.tsx` → `store.submitRequest` |
| Facility join code | `app/join/page.tsx`, `lib/security.ts#normalizeFacilityCode` |
| Onboarding / room / staff forms | `app/onboarding`, `app/rooms`, `app/setup/*` |
| Contact / demo lead form | `app/contact/page.tsx` |
| Auth forms | `app/auth/*` (Supabase Auth) |
| API routes | `/api/ai`, `/api/voice`, `/api/sync`, `/api/health` |
| Realtime channels | `lib/supabase/liveChannel.ts` (patient live broadcast) |

**Routes — access classification**

| Public (no auth) | Authenticated (staff) |
|---|---|
| `/`, `/join`, `/demo`, `/patient`, `/room/*`, `/get-started`, `/privacy`, `/terms`, `/auth/*` | `/dashboard`, `/therapist`, `/admin`, `/facility`, `/onboarding`, `/account`, `/rooms` |
| `/api/health`, `/api/ai`, `/api/voice`, `/api/sync` (**all unauthenticated**) | — |

Page-route auth is enforced in `middleware.ts:23,66-71`. **API routes are excluded from the middleware matcher** (`middleware.ts:78` — `api/` is in the negative lookahead), so no API route is auth-gated at the edge.

---

## Checklist — status of every item

| # | Item | Status | Proof / reason |
|---|---|---|---|
| **P1.1** | Server-side input validation | `PARTIAL` | Free text is sanitized + length-capped at the store layer (`lib/security.ts:26-38`, applied in `lib/store.ts` `addRoom`/`createFacility`). `/api/sync` validates `facilityId` via regex + 2 MB cap (`app/api/sync/route.ts:21,96-108`). **Gap:** `/api/ai` & `/api/voice` bodies are not schema-validated (only `.slice()` length caps). No Zod/Yup schema layer. |
| **P1.2** | Parameterized queries | `PASS` | No SQL is hand-built. All DB access goes through the Supabase client's query builder (`lib/db.ts`, `lib/supabase/*.ts` — `.from().select()/.upsert()`), which parameterizes. No string-concatenated SQL exists in app code. |
| **P1.3** | Output escaping / XSS | `PASS` | React escapes by default. Only two raw-HTML sinks: `app/layout.tsx:28` is a **static, developer-authored** theme script (no user input); `lib/shiftReport.ts:268` `document.write` escapes every user value via `esc()` (`lib/shiftReport.ts:33-35`) and the markdown renderer's `inline()` (`:45-49`). CSP present. |
| **P1.4** | File uploads | `N/A` | The app has no file-upload feature. No `multipart/form-data` handlers, no `formData()` file reads. |
| **P1.5** | SSRF / server-side fetch | `PASS` | The only server-side outbound fetches are to fixed, hardcoded hosts (`api.anthropic.com`, `api.elevenlabs.io`, `openrouter.ai`) — never a user-supplied URL. No link-preview/image-proxy. |
| **P2.1** | No hand-rolled crypto | `PASS` | Auth is 100% Supabase Auth (`lib/auth/*`, `middleware.ts`). No password hashing/storage in app code; no custom crypto. |
| **P2.2** | MFA available | `NEEDS HUMAN` | Supabase supports MFA (TOTP) but it is not enabled/wired in the UI. Clean hook exists (Supabase Auth). Enable in the Supabase dashboard + add an enrollment screen. |
| **P2.3** | Authorization on every route (IDOR) | `PARTIAL` | Page routes gated by `middleware.ts`. Server-to-Supabase writes set `owner_id`/facility scoping (`lib/supabase/facilities.ts`). **But** the real access control is RLS, which is currently permissive (see P3). API routes have no per-resource ownership check. |
| **P2.4** | Secure session cookies | `PASS` | Sessions are Supabase SSR cookies, which are `HttpOnly` + `Secure` + `SameSite=Lax` by default via `@supabase/ssr` `createServerClient` (`middleware.ts:36`, `lib/auth/supabase-server.ts`). App sets no custom auth cookies. |
| **P2.5** | CSRF protection | `PASS (by design)` | No cookie-authenticated **state-changing form POSTs to our own server** — mutations go through the Supabase JS client (bearer token in header, not ambient cookie) or same-origin `fetch`. `form-action 'self'` + `SameSite` cookies. No traditional CSRF surface. |
| **P3.1** | RLS enabled + user-scoped | `FIXED (apply on live DB)` | **Root cause:** `demo_all ... USING (true) WITH CHECK (true)` for anon on the patient-data tables (`0001_init.sql:199-208`), never dropped, shadowing the scoped policies. **Fix:** new migration `supabase/migrations/0009_secure_rls.sql` drops every `demo_all` and locks each table to the facility owner; anonymous patients reach data only through the validated SECURITY DEFINER RPCs (`public_facility_with_rooms`, `submit_patient_request`, `get_request_status`), which the join/submit/status flows already use. `SETUP_RUN_THIS.sql` got a prominent security banner. **Must be applied + break-tested on the live DB (currently Supabase is not connected).** |
| **P3.2** | Break-test RLS (user A vs B) | `NEEDS HUMAN (script provided)` | Cannot run here (no live Supabase). Wrote `supabase/rls_break_test.sql` — paste into the Supabase SQL editor after applying 0009 to prove: no `USING(true)` remains, `demo_all` gone, anon reads return 0 rows, RPCs still work, owner A ≠ owner B rows. |
| **P3.3** | No `USING (true)` on user data | `FIXED (apply on live DB)` | `0009_secure_rls.sql` drops the `demo_all` `USING(true)` policies; `rls_break_test.sql` TEST 1/2 assert none remain. |
| **P4.1** | Scan repo for hardcoded secrets | `PASS` | Grep for `sk-ant`, `sk_`, inline `apiKey=`, `password=`, bearer literals found **none** in `app/`, `components/`, `lib/`, `scripts/`. All secrets read from `process.env`. `service_role` appears only in `scripts/import-directory.mjs:25` (server-side, from env) and docs. |
| **P4.2** | Secrets in env + gitignored | `PASS` (1 caveat) | `.env*` and `.env.local` are gitignored (`.gitignore:34,42`); `git ls-files` shows **no** `.env` tracked. **Caveat → NEEDS HUMAN:** the live Anthropic + ElevenLabs keys were pasted in chat during development, so they are compromised and must be rotated (they are *not* in git, but are exposed). |
| **P4.3** | Secret rotation cadence | `NEEDS HUMAN` | No rotation automation. Recommend 90-day rotation of Anthropic/ElevenLabs/Supabase keys + calendar reminder or a secrets manager. |
| **P5.1** | Force HTTPS | `PASS` | HSTS in prod (`next.config.ts:19`), `upgrade-insecure-requests` in CSP (`:48`). Vercel terminates TLS and auto-renews certs + redirects HTTP→HTTPS at the platform. |
| **P5.2** | API auth on every endpoint | `HARDENED` | The paid routes now enforce a same-origin guard + per-IP rate limit (`lib/apiGuard.ts`, wired into `app/api/ai/route.ts` & `app/api/voice/route.ts`). Cross-site browser calls → **403** (verified); scripted abuse is rate-capped; patient triage degrades gracefully (never blocked). Full per-user auth remains architecturally impossible for the patient path (patients have no accounts) — origin+rate-limit is the correct control here. `/api/health` is a harmless liveness probe. |
| **P5.3** | CORS not wildcard | `PASS` | No CORS headers are set anywhere → Next.js default is same-origin only. No `Access-Control-Allow-Origin: *`. |
| **P5.4** | Security headers | `PASS (hardened)` | `next.config.ts:10-55`: HSTS, CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` + `frame-ancestors 'none'` (added this pass), `Referrer-Policy`, `Permissions-Policy`, COOP, CORP, `poweredByHeader:false`. **Residual:** CSP `script-src` keeps `'unsafe-inline'` + `'unsafe-eval'` (Next.js/inline-theme requirement) — weakens XSS defense. |
| **P6.1** | Rate limiting | `PARTIAL (fixed on paid routes)` | Added per-IP sliding-window limits on `/api/ai` (120/min) and `/api/voice` (30/min) via `lib/apiGuard.ts`. Auth/signup/reset endpoints still rely on Supabase's built-in throttling only — add app-level limits there (NEEDS HUMAN). In-memory limiter is per-instance on Vercel; use Upstash Ratelimit for distributed guarantees. |
| **P6.2** | Bot protection | `FAIL` | No CAPTCHA/Turnstile on signup, signin, reset, or the public contact form (`app/contact/page.tsx`). |
| **P6.3** | Brute-force defense | `PARTIAL` | Supabase Auth applies its own server-side login throttling, but there is no app-level lockout/backoff and no bot protection layered on top. |
| **P7.1** | Generic user-facing errors | `PASS` | API routes return generic strings (`app/api/sync/route.ts:117` "Bad request"; `/api/ai` returns `{available:false}`/short error). No stack traces or file paths sent to clients. |
| **P7.2** | Logs free of secrets/PII | `PASS` | The audit log stores metadata only, never keys/transcripts (`lib/ai/audit.ts`). The triage server log is explicitly PII-free (`app/api/ai/route.ts` `[hubi.triage]` line logs levels/latency, no text/keys). No `console.log` of request bodies or tokens found. |
| **P7.3** | Anomaly monitoring | `NEEDS HUMAN` | None configured. Recommend Vercel Log Drains + a free alerting tier (e.g. Better Stack / Sentry) on 5xx spikes and auth failures. |
| **P8.1** | Dependency audit | `NEEDS HUMAN` | `npm audit` cannot run here — the network's TLS filter (Securly) rejects `registry.npmjs.org`. Deps are few and current (Next 16.2.7, React 19.2, Supabase latest, Anthropic 0.106). Run `npm audit` on an unfiltered network. |
| **P8.2** | Update/remove vulnerable pkgs | `NEEDS HUMAN` | Pending P8.1 results. No obviously abandoned/duplicate deps in `package.json`. |
| **P8.3** | Automated dep updates | `FIXED` | Added `.github/dependabot.yml` (weekly npm + GitHub-Actions updates, grouped minor/patch, labeled `dependencies`). Activates automatically once pushed to GitHub. |

---

## Prioritized `NEEDS HUMAN` actions

1. **[CRITICAL] Fix RLS before connecting Supabase to real data.** Drop the `demo_all` policies and replace with scoped ones. This is architectural: **patient room devices have no account** (residents don't log in), so `requests`/patient writes come from the `anon` key and cannot be scoped by `auth.uid()`. The correct pattern:
   - **Reads** (staff): keep owner/member-scoped policies (like `patient_messages` in `0007`).
   - **Patient writes**: route them through a **server-side API using the `service_role` key** (or a Supabase `SECURITY DEFINER` RPC) that validates the facility join-code before inserting — so `anon` never gets a blanket `INSERT` grant. Then remove `demo_all` entirely.
   Until this is done, **do not put real PHI in Supabase.** (It is currently latent: Supabase isn't connected in the live deployment.)
2. **[CRITICAL] Rotate the exposed API keys.** The Anthropic + ElevenLabs keys were shared in chat. Rotate both (console.anthropic.com / ElevenLabs → API keys), update `.env.local` + Vercel. Also rotate the Supabase `service_role` if it was ever shared.
3. **Add authentication + rate limiting to `/api/ai` and `/api/voice`.** They spend real money per call. At minimum: verify a Supabase session (or a signed room token) before proxying, and add per-IP rate limiting (e.g. Upstash Ratelimit / Vercel Edge Middleware). Keep `/api/ai` triage generous so patient safety is never throttled — prefer auth over aggressive throttling on that route.
4. **Run `npm audit`** on an unfiltered network; patch anything High/Critical; enable Dependabot.
5. **Enable Supabase MFA** for staff/admin accounts and add bot protection (Cloudflare Turnstile) to signup/signin/reset/contact.
6. **Add monitoring/alerting** (5xx + auth-failure spikes).

---

## Residual risks not fully closed

- **CSP `'unsafe-inline'`/`'unsafe-eval'`** in `script-src` — required by the inline theme script and Next.js runtime; weakens XSS mitigation. Closing it requires a nonce-based CSP (larger change).
- **`/api/sync`** broadcasts workspace snapshots (which can contain patient names/room/transcripts) to any unauthenticated subscriber who knows the `facilityId`. It's in-memory per-serverless-instance (a local-network fallback, largely inert on Vercel), but it is unauthenticated by design. Treat `facilityId` as a bearer secret or gate this route if it's used with real data.
- **RLS break-testing (P3.2)** and **CORS-in-prod verification** are unverified here — require the live deployment.

---

## Fixes applied

| Fix | Files | Verified |
|---|---|---|
| CSP `frame-ancestors 'none'` (clickjacking) | `next.config.ts` | build |
| Paid-route hardening: same-origin guard + per-IP rate limit | `lib/apiGuard.ts`, `app/api/ai/route.ts`, `app/api/voice/route.ts` | ✅ cross-origin→403, same-origin→200, no-origin→allowed, live-tested |
| Secure RLS migration (drops `demo_all`, owner-scoped) | `supabase/migrations/0009_secure_rls.sql` | SQL review; **apply + break-test on live DB** |
| RLS break-test script | `supabase/rls_break_test.sql` | run in Supabase SQL editor after 0009 |
| Security banner on the demo setup file | `supabase/SETUP_RUN_THIS.sql` | — |
| Automated dependency updates | `.github/dependabot.yml` | activates on push |

_Session/CORS/cookie posture was already correct and left unchanged. RLS was fixed via migration (not applied live) because Supabase is not connected — this avoids any chance of locking out the anonymous patient-submission path before you can break-test it._

---

## Hand-off — exact steps for the remaining human items

1. **Rotate the exposed keys** (highest priority — they were shared in chat):
   - Anthropic: console.anthropic.com → API keys → revoke old, create new.
   - ElevenLabs: profile → API keys → regenerate.
   - Update both in `.env.local` **and** Vercel → Settings → Environment Variables → redeploy.
2. **Before any real patient data touches Supabase:** run migrations `0001`→`0009` in order (or apply `0009_secure_rls.sql` on top of your current DB), then paste `supabase/rls_break_test.sql` into the Supabase SQL editor and confirm every test passes (TEST 4 counts must all be 0).
3. **Run `npm audit`** from a normal network (your dev network's TLS filter blocks the npm registry): `npm audit --omit=dev`; patch anything High/Critical.
4. **Enable Supabase MFA** for staff: Supabase dashboard → Authentication → Providers → enable MFA (TOTP), then add an enrollment prompt in `/account`.
5. **Add bot protection** (Cloudflare Turnstile — free): put a widget on signup/signin/reset/contact and verify the token server-side. Needs a Turnstile site+secret key.
6. **App-level rate limiting on auth endpoints** + distributed limiter: adopt Upstash Ratelimit (swap the in-memory `lib/apiGuard.ts` limiter) and apply to signup/signin/reset.
7. **Monitoring/alerting:** enable Vercel Log Drains + a free Sentry/Better Stack tier; alert on 5xx spikes and auth-failure bursts.
