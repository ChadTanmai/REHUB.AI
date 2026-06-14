"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RehubWordmark } from "@/components/RehubLogo";

/**
 * The operational app nav — used by therapist, admin, facility, room, and
 * setup pages. Distinct from the marketing nav: no hero CTAs, just clear
 * wayfinding for logged-in care team members.
 */

const NAV_ITEMS = [
  { href: "/therapist", label: "Dashboard" },
  { href: "/facility", label: "Facility" },
  { href: "/admin", label: "Analytics" },
  { href: "/setup", label: "Setup" },
];

export default function AppNav({
  facilityName,
  userName,
}: {
  facilityName?: string;
  userName?: string;
}) {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-muted bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5 sm:px-6">
        <Link href="/" className="shrink-0">
          <RehubWordmark size="sm" />
        </Link>

        {facilityName && (
          <>
            <span className="text-gray-muted">/</span>
            <span className="hidden truncate text-sm font-medium text-slate sm:block max-w-[180px]">
              {facilityName}
            </span>
          </>
        )}

        <nav className="ml-4 hidden items-center gap-0.5 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = path === item.href || path.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-navy/8 text-navy"
                    : "text-slate hover:bg-offwhite hover:text-navy"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {userName && (
            <span className="hidden text-sm text-slate/60 sm:block">{userName}</span>
          )}
          <Link
            href="/demo"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate/70 transition-colors hover:text-navy"
          >
            Demo
          </Link>
          <Link
            href="/"
            className="rounded-md border border-gray-muted bg-white px-3 py-1.5 text-sm font-medium text-slate transition-colors hover:border-navy/30 hover:text-navy"
          >
            ← Marketing site
          </Link>
        </div>
      </div>
    </header>
  );
}
