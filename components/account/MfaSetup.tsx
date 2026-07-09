"use client";

/**
 * Two-factor authentication (TOTP) enrollment for staff accounts.
 *
 * Uses Supabase's built-in MFA (available by default — no dashboard change
 * required). Flow: enroll → show QR + secret → user scans in an authenticator
 * app → verify a 6-digit code → factor becomes active. A verified factor can be
 * removed again from here.
 *
 * Degrades gracefully: if Supabase isn't configured or MFA isn't available, the
 * component shows a short unavailable note instead of erroring.
 */

import { useCallback, useEffect, useState } from "react";
import { getAuthClient } from "@/lib/auth/supabase-browser";

type Factor = { id: string; status: string; friendly_name?: string | null };

export default function MfaSetup() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  // Enrollment-in-progress state
  const [enrolling, setEnrolling] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await getAuthClient().auth.mfa.listFactors();
      if (error) { setUnavailable(true); return; }
      const totp = (data?.totp ?? []) as Factor[];
      setFactors(totp);
    } catch {
      setUnavailable(true);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const verified = factors.find((f) => f.status === "verified");

  async function startEnroll() {
    setMsg("");
    setBusy(true);
    try {
      const { data, error } = await getAuthClient().auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator (${new Date().toLocaleDateString()})`,
      });
      if (error) { setMsg(error.message); return; }
      // data.totp.qr_code is an SVG data URI; secret is the manual-entry key.
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not start enrollment.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll() {
    if (!enrolling || code.trim().length < 6) return;
    setBusy(true);
    setMsg("");
    try {
      const supabase = getAuthClient();
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
      if (chErr) { setMsg(chErr.message); return; }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: ch.id,
        code: code.trim(),
      });
      if (vErr) { setMsg(vErr.message); return; }
      setEnrolling(null);
      setCode("");
      setMsg("Two-factor authentication is now on.");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    if (enrolling) {
      // Remove the half-finished (unverified) factor so it doesn't linger.
      try { await getAuthClient().auth.mfa.unenroll({ factorId: enrolling.factorId }); } catch { /* ignore */ }
    }
    setEnrolling(null);
    setCode("");
    setMsg("");
  }

  async function disableMfa(factorId: string) {
    setBusy(true);
    setMsg("");
    try {
      const { error } = await getAuthClient().auth.mfa.unenroll({ factorId });
      if (error) { setMsg(error.message); return; }
      setMsg("Two-factor authentication turned off.");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not disable.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (unavailable) {
    return <p className="text-sm text-slate/60">Two-factor authentication isn&apos;t available on this account yet.</p>;
  }

  return (
    <div>
      {verified ? (
        <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2f855a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" />
            </svg>
            <span className="text-sm font-semibold text-success">Two-factor authentication is on</span>
          </div>
          <button onClick={() => disableMfa(verified.id)} disabled={busy}
            className="text-sm font-medium text-coral hover:underline disabled:opacity-50">
            Turn off
          </button>
        </div>
      ) : enrolling ? (
        <div className="rounded-lg border border-gray-muted bg-white p-4">
          <p className="text-sm font-medium text-navy">Scan this with your authenticator app</p>
          <p className="mt-1 text-xs text-slate/60">(Google Authenticator, 1Password, Authy, etc.)</p>
          {/* qr is an SVG data URI */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qr} alt="Two-factor QR code" className="my-3 h-40 w-40" />
          <p className="text-xs text-slate/60">Can&apos;t scan? Enter this key manually:</p>
          <code className="mt-1 block break-all rounded bg-offwhite px-2 py-1 text-xs text-navy">{enrolling.secret}</code>
          <label className="mt-3 mb-1 block text-sm font-medium text-slate">Enter the 6-digit code</label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              className="input flex-1 tracking-widest"
            />
            <button onClick={confirmEnroll} disabled={busy || code.length < 6}
              className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2030] disabled:opacity-50">
              {busy ? "Verifying…" : "Verify"}
            </button>
          </div>
          <button onClick={cancelEnroll} disabled={busy} className="mt-2 text-sm font-medium text-slate/70 hover:underline">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate/70">Add a second step at sign-in with an authenticator app.</p>
          <button onClick={startEnroll} disabled={busy}
            className="rounded-lg border border-navy/20 bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-offwhite disabled:opacity-50">
            {busy ? "Starting…" : "Enable 2FA"}
          </button>
        </div>
      )}
      {msg && (
        <p className={`mt-2 text-sm ${msg.includes("on") || msg.includes("off") ? "text-success" : "text-coral"}`}>{msg}</p>
      )}
    </div>
  );
}
