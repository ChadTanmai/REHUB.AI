"use client";

import { useState } from "react";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import { getAuthClient } from "@/lib/auth/supabase-browser";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: err } = await getAuthClient().auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      },
    );

    setLoading(false);
    if (err) setError(err.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <div className="py-4 text-center">
          <p className="text-sm text-slate/70">
            We sent a password reset link to{" "}
            <span className="font-medium text-navy">{email}</span>.
          </p>
          <Link
            href="/auth/signin"
            className="mt-6 inline-block text-sm font-medium text-teal hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your work email and we'll send a reset link."
    >
      <form onSubmit={handleReset} className="space-y-4">
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
            className="input"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full rounded-lg bg-navy py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0c2030] disabled:opacity-40"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>

        <p className="text-center text-sm text-slate/70">
          <Link href="/auth/signin" className="font-medium text-teal hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
