import Link from "next/link";
import { RehubWordmark } from "@/components/RehubLogo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-offwhite px-4">
      <RehubWordmark />
      <h1 className="mt-8 text-2xl font-bold text-navy">Page not found</h1>
      <p className="mt-2 text-sm text-slate/70">
        That page doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2030]"
        >
          Go home
        </Link>
        <Link
          href="/auth/signin"
          className="rounded-lg border border-gray-muted bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:bg-offwhite"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
