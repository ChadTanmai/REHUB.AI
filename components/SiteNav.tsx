import Link from "next/link";
import { RehubMark, RehubWordmark } from "./RehubLogo";

const LINKS = [
  { href: "/resident", label: "Resident" },
  { href: "/staff", label: "Staff" },
  { href: "/admin", label: "Admin" },
  { href: "/setup", label: "Set up" },
  { href: "/about", label: "About" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-muted bg-offwhite/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <RehubWordmark />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate transition-colors hover:bg-white hover:text-navy"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/therapist"
          className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a8d8d]"
        >
          Dashboard
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gray-muted bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <RehubWordmark />
        <p className="mt-3 max-w-2xl text-sm text-slate/70">
          Rehub is a communication and workflow tool. It does not replace
          emergency response systems or medical judgment.
        </p>
        <p className="mt-4 text-xs text-slate/50">
          © {new Date().getFullYear()} Rehub. Built for rehab centers, senior
          living, and care teams.
        </p>
      </div>
    </footer>
  );
}

/** @deprecated Use RehubMark or RehubWordmark instead. Kept for backward compat. */
export function Logo() {
  return <RehubMark size={28} />;
}
