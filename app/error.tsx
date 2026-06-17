"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RehubWordmark } from "@/components/RehubLogo";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-offwhite px-4">
      <RehubWordmark />
      <h1 className="mt-8 text-2xl font-bold text-navy">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate/70">
        An unexpected error occurred. Your data is safe.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2030]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-gray-muted bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:bg-offwhite"
        >
          Go home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-4 font-mono text-xs text-slate/40">Error: {error.digest}</p>
      )}
    </main>
  );
}
