# ReHub — Enterprise Launch Checklist

Everything required to take ReHub from "builds and runs" to a real, multi-tenant,
patient-data-handling production deployment. Work top to bottom.

Legend: **[YOU]** = needs your accounts/keys (cannot be done in code) · **[DONE]** = already implemented in the codebase.

---

## 0. Hard requirement — connect the database

Without Supabase, the app runs on per-device localStorage: **patient requests are
not persisted and do not sync between devices.** A red banner now warns on every
data screen until this is fixed (`components/BackendBanner.tsx`). **[DONE]**

**[YOU]**
1. Create a Supabase project (supabase.com).
2. In the SQL editor, run the migrations **in order**: `supabase/migrations/0001` → `0009`. (0009 is the security-critical RLS lockdown.)
3. Copy **Project URL** and **anon public key** from Settings → API.
4. Set them as env vars (local `.env.local` and Vercel → Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Redeploy. The red banner disappears → backend is live.

---

## 1. Prove tenant isolation (RLS)  **[YOU]**

Before real patient data goes in, paste `supabase/rls_break_test.sql` into the
Supabase SQL editor and confirm **every test passes** (TEST 4 counts must all be 0).
This proves anonymous clients can't read/write patient data and one facility can't
see another's rows. Do not skip this — it is the core multi-tenant guarantee.

---

## 2. API keys  **[YOU]**

| Key | Where | Purpose | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel env | Hubi AI (triage, summaries, search) | **Rotate** — the dev key was exposed in chat |
| `ELEVENLABS_API_KEY` | Vercel env | Natural patient voice | **Rotate** — exposed in dev. Optional; browser voice is the fallback |
| `ELEVENLABS_ENABLED` | Vercel env | Kill switch | Set `true` only when you want the paid voice on |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel env | Bot protection on auth forms | + paste the **secret** into Supabase → Auth → Bot protection → Turnstile |

After setting keys, **redeploy** (env vars only take effect on a fresh build).

---

## 3. Security posture — already shipped  **[DONE]**

- **RLS** locked to facility owner; anon reaches data only via validated
  `SECURITY DEFINER` RPCs (`0009_secure_rls.sql`).
- **Paid API routes** (`/api/ai`, `/api/voice`) guarded with same-origin check +
  per-IP rate limiting (`lib/apiGuard.ts`).
- **Security headers**: HSTS, CSP (+ `frame-ancestors`), nosniff, `X-Frame-Options`,
  Referrer-Policy, Permissions-Policy, COOP/CORP (`next.config.ts`).
- **Auth**: Supabase sessions (HttpOnly/Secure/SameSite cookies); staff routes +
  `/diagnostics` + `/rooms` gated in `middleware.ts`.
- **MFA** (TOTP) enrollment UI at `/account/settings`.
- **Bot protection** wired into sign-in / sign-up / reset (activates with the key).
- **CI**: build + lint + `npm audit` on every push (`.github/workflows/ci.yml`);
  **Dependabot** weekly updates.

Full detail + per-item status: `SECURITY_AUDIT.md`.

---

## 4. Pre-launch verification  **[YOU]**

- [ ] Two devices, different networks: patient submits a request → nurse sees it
      on the command center in real time → acknowledges → patient sees confirmation.
- [ ] Create a second facility on a second account → confirm it **cannot** see the
      first facility's rooms/requests (tenant isolation, end to end).
- [ ] `/diagnostics` (as signed-in staff) shows all pipeline stages green.
- [ ] First CI run is green; review the `npm audit` output; merge Dependabot PRs.
- [ ] MFA enroll + sign-in with a code works.
- [ ] Turnstile appears on the auth forms and blocks a bot submission.

---

## 5. Operational (recommended, not blocking)  **[YOU]**

- [ ] Custom domain in Vercel (TLS auto-provisions).
- [ ] Monitoring/alerting: Vercel Log Drains + a free Sentry / Better Stack tier —
      alert on 5xx spikes and auth-failure bursts.
- [ ] Distributed rate limiting: swap the in-memory limiter in `lib/apiGuard.ts`
      for Upstash Ratelimit (needed if you run at scale across many instances).
- [ ] Backups: enable Supabase point-in-time recovery on a paid plan.
- [ ] Sign a Supabase BAA if you need HIPAA (Team/Enterprise plan).

---

## What "enterprise-ready" means here

The application code is production-grade: multi-tenant, RLS-enforced, rate-limited,
MFA + bot-protected, security-headered, CI-audited, and free of demo/mock data.
The remaining launch gates are **configuration** (steps 0–2) and **verification**
(step 4) — the things that require your Supabase project and keys, which by design
live outside the codebase.
