"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RehubWordmark } from "@/components/RehubLogo";
import UserMenu from "@/components/UserMenu";
import FacilityCodeBadge from "@/components/FacilityCodeBadge";
import GlobalCommandCenter from "@/components/GlobalCommandCenter";
import SyncStatus from "@/components/SyncStatus";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * The operational app nav — used by therapist, admin, facility, room, and
 * setup pages. Distinct from the marketing nav: no hero CTAs, just clear
 * wayfinding for logged-in care team members.
 */

// Consolidated, focused areas. Facility + Analytics live together under one
// "Operations" workspace (/facility) so navigation isn't fragmented.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/command", label: "Command center" },
  { href: "/rooms", label: "Patients" },
  { href: "/facility", label: "Operations" },
];

export default function AppNav({
  facilityName,
}: {
  facilityName?: string;
}) {
  const path = usePathname();
  const { signedIn } = useAuth();

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

        {signedIn && (
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
        )}

        <div className="ml-auto flex items-center gap-3">
          {signedIn && <SyncStatus />}
          <FacilityCodeBadge />
          {signedIn && <GlobalCommandCenter />}
          {signedIn ? (
            <UserMenu />
          ) : (
            <Link
              href="/auth/signin"
              className="rounded-lg border border-gray-muted bg-white px-4 py-1.5 text-sm font-semibold text-navy hover:bg-offwhite"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
