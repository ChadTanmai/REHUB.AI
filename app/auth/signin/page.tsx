"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AuthCard from "@/components/auth/AuthCard";
import GoogleButton from "@/components/auth/GoogleButton";
import { getAuthClient } from "@/lib/auth/supabase-browser";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const errorParam = params.get("error");
  const mode = params.get("mode"); // "patient" for patient flow

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(
    errorParam === "auth_failed" ? "Verification failed. Please try again." : "",
  );
  const [view, setView] = useState<"choose" | "staff" | "patient">(
    mode === "patient" ? "patient" : "choose",
  );

  const supabase = getAuthClient();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);
    if (err) {
      setError(
        err.message === "Email not confirmed"
          ? "Please verify your email first. Check your inbox for the verification link."
          : err.message,
      );
    } else {
      router.push(next);
      router.refresh();
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

  if (view === "choose") {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setView("staff")}
          className="group flex w-full items-center gap-4 rounded-xl border border-gray-muted bg-white p-4 text-left transition-all hover:border-navy/30 hover:shadow-soft"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-navy">I&apos;m a staff member or administrator</p>
            <p className="text-sm text-slate/60">Directors, nurses, therapists, and care team</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate/30 group-hover:text-navy">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          onClick={() => setView("patient")}
          className="group flex w-full items-center gap-4 rounded-xl border border-gray-muted bg-white p-4 text-left transition-all hover:border-teal/40 hover:shadow-soft"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-navy">I&apos;m a patient</p>
            <p className="text-sm text-slate/60">Residents and rehabilitation patients</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate/30 group-hover:text-teal">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    );
  }

  if (view === "patient") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView("choose")}
          className="flex items-center gap-1.5 text-sm text-slate/60 hover:text-navy"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <div className="rounded-xl border border-teal/30 bg-teal/5 p-4">
          <p className="text-sm font-semibold text-navy">Patient room access</p>
          <p className="mt-1 text-sm text-slate/70">
            Patient rooms are set up by your facility administrator. You don&apos;t need an account.
          </p>
        </div>

        <p className="text-sm text-slate">
          To access a patient room, your nurse or administrator should have given you a room link or QR code.
        </p>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate">Have a facility join code?</p>
          <Link
            href="/join"
            className="block w-full rounded-lg border border-gray-muted bg-white px-4 py-3 text-center text-sm font-semibold text-navy hover:bg-offwhite"
          >
            Join with facility code
          </Link>
        </div>

        <div className="border-t border-gray-muted pt-4">
          <p className="text-sm text-slate/60">
            Looking for the care request screen? Ask your nurse for the room tablet or the room link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      <button
        type="button"
        onClick={() => setView("choose")}
        className="flex items-center gap-1.5 text-sm text-slate/60 hover:text-navy"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>

      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-gray-muted" />
        <span className="text-xs text-slate/40">or with email</span>
        <div className="flex-1 border-t border-gray-muted" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate">Work email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourfacility.org"
          required
          autoComplete="email"
          className="input"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-slate">Password</label>
          <Link href="/auth/reset-password" className="text-xs font-medium text-teal hover:underline">
            Forgot password?
          </Link>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          required
          autoComplete="current-password"
          className="input"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full rounded-lg bg-navy py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0c2030] disabled:opacity-40"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-slate/70">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="font-medium text-teal hover:underline">
          Create account
        </Link>
      </p>
    </form>
  );
}

export default function SignInPage() {
  return (
    <AuthCard
      title="Welcome to Rehub"
      subtitle="Sign in to your facility account"
    >
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-offwhite" />}>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
