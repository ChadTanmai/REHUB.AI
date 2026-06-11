import Link from "next/link";

const LINKS = [
  { href: "/resident", label: "Resident" },
  { href: "/staff", label: "Staff" },
  { href: "/admin", label: "Admin" },
  { href: "/demo", label: "Demo" },
  { href: "/setup", label: "Set up" },
  { href: "/about", label: "About" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-muted bg-offwhite/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-bold tracking-tight text-navy">Rehub</span>
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
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-bold text-navy">Rehub</span>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-slate/70">
          Rehub is a communication and workflow tool. It does not replace
          emergency response systems or medical judgment. Demo mode uses
          fictional data only — no real patient information.
        </p>
        <p className="mt-4 text-xs text-slate/50">
          © {new Date().getFullYear()} Rehub. Built for rehab centers, senior
          living, and care teams.
        </p>
      </div>
    </footer>
  );
}

export function Logo() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy text-sm font-bold text-white">
      R
    </span>
  );
}
