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
  const next = params.get("next") ?? "/facility";
  const errorParam = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(
    errorParam === "auth_failed" ? "Verification failed. Please try again." : "",
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

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-gray-muted" />
        <span className="text-xs text-slate/40">or with email</span>
        <div className="flex-1 border-t border-gray-muted" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate">
          Work email
        </label>
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
          <Link
            href="/auth/reset-password"
            className="text-xs font-medium text-teal hover:underline"
          >
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
        <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">
          {error}
        </p>
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
          Create facility account
        </Link>
      </p>
    </form>
  );
}

export default function SignInPage() {
  return (
    <AuthCard
      title="Sign in to Rehub"
      subtitle="Facility directors and administrators"
    >
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-offwhite" />}>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
