"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const MENU_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Profile", href: "/account/profile" },
  { label: "Settings", href: "/account/settings" },
  { label: "Facility", href: "/facility" },
  { label: "Help & Support", href: "/contact" },
];

export default function UserMenu() {
  const { profile, signedIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!signedIn || !profile) return null;

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-gray-muted bg-white p-1 pr-2.5 transition-colors hover:border-navy/30"
        aria-label="Account menu"
      >
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
            {initials(profile.displayName)}
          </span>
        )}
        <span className="hidden text-sm font-medium text-navy sm:inline">
          {profile.displayName.split(" ")[0]}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate/50">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-gray-muted bg-white shadow-panel">
          {/* Header */}
          <div className="border-b border-gray-muted px-4 py-3">
            <p className="truncate text-sm font-semibold text-navy">{profile.fullName}</p>
            <p className="truncate text-xs text-slate/60">{profile.email}</p>
            {profile.facilityName && (
              <p className="mt-1 truncate text-xs text-teal">{profile.facilityName}</p>
            )}
          </div>

          {/* Links */}
          <div className="py-1">
            {MENU_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-slate transition-colors hover:bg-offwhite hover:text-navy"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Sign out */}
          <div className="border-t border-gray-muted py-1">
            <button
              onClick={handleSignOut}
              className="block w-full px-4 py-2 text-left text-sm font-medium text-coral transition-colors hover:bg-coral/5"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
