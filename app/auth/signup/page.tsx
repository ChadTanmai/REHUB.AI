"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AuthCard from "@/components/auth/AuthCard";
import GoogleButton from "@/components/auth/GoogleButton";
import Turnstile, { turnstileEnabled } from "@/components/auth/Turnstile";
import { getAuthClient } from "@/lib/auth/supabase-browser";

function SignUpForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/onboarding";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const supabase = getAuthClient();

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !name) return;
    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        data: {
          full_name: name.trim(),
          facility_name: facilityName.trim(),
          role: "facility_director",
        },
        ...(captchaToken ? { captchaToken } : {}),
      },
    });

    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (err) {
      setError(err.message);
      setGoogleLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success text-white">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-navy">Check your email</h2>
        <p className="mt-2 text-sm text-slate/70">
          We sent a verification link to{" "}
          <span className="font-medium text-navy">{email}</span>.
          Click it to verify your account and set up your facility.
        </p>
        <p className="mt-4 text-xs text-slate/50">
          Can&apos;t find it? Check your spam folder.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleEmailSignUp} className="space-y-4">
      <GoogleButton onClick={handleGoogle} loading={googleLoading} label="Sign up with Google" />

      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-gray-muted" />
        <span className="text-xs text-slate/40">or with email</span>
        <div className="flex-1 border-t border-gray-muted" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate">
            Your full name *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jordan Ellis"
            required
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate">
            Facility name
          </label>
          <input
            value={facilityName}
            onChange={(e) => setFacilityName(e.target.value)}
            placeholder="Maplewood Rehabilitation"
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate">
          Work email *
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourfacility.org"
          required
          className="input"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate">
          Password *
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          minLength={8}
          required
          className="input"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">
          {error}
        </p>
      )}

      <Turnstile onToken={setCaptchaToken} />

      <button
        type="submit"
        disabled={loading || !email || !password || !name || (turnstileEnabled && !captchaToken)}
        className="w-full rounded-lg bg-teal py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2a8d8d] disabled:opacity-40"
      >
        {loading ? "Creating account…" : "Create account & verify email"}
      </button>

      <p className="text-center text-xs text-slate/60">
        By signing up you agree that this is a demo platform. No real patient
        data should be entered.
      </p>

      <p className="text-center text-sm text-slate/70">
        Already have an account?{" "}
        <Link href="/auth/signin" className="font-medium text-teal hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your facility account"
      subtitle="For facility directors and administrators. Free 30-day pilot."
    >
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-offwhite" />}>
        <SignUpForm />
      </Suspense>
    </AuthCard>
  );
}
