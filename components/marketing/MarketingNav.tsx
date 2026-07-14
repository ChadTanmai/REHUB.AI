"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { RehubWordmark } from "@/components/RehubLogo";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/lib/auth/AuthProvider";
import { EASE } from "./motion";

const LINKS = [
  { href: "/for-facilities", label: "For facilities" },
  { href: "/#product", label: "Product" },
  { href: "/about", label: "About" },
];

export default function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { signedIn, loading } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-gray-muted bg-offwhite/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/">
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

        <div className="hidden items-center gap-3 md:flex">
          {loading ? (
            <div className="h-9 w-20 animate-pulse rounded-lg bg-gray-muted/40" />
          ) : signedIn ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-soft transition-all hover:bg-[#0c2030]"
              >
                Go to dashboard
              </Link>
              <UserMenu />
            </>
          ) : (
            <>
              <Link
                href="/contact"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate transition-colors hover:text-navy"
              >
                Request a demo
              </Link>
              <Link
                href="/auth/signin"
                className="rounded-lg border border-gray-muted bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-offwhite"
              >
                Sign in
              </Link>
              <Link
                href="/get-started"
                className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-soft transition-all hover:bg-[#0c2030] hover:shadow-panel"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-navy md:hidden"
        >
          <div className="space-y-1.5">
            <span
              className={`block h-0.5 w-5 bg-navy transition-transform ${open ? "translate-y-2 rotate-45" : ""}`}
            />
            <span className={`block h-0.5 w-5 bg-navy transition-opacity ${open ? "opacity-0" : ""}`} />
            <span
              className={`block h-0.5 w-5 bg-navy transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`}
            />
          </div>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden border-t border-gray-muted bg-offwhite md:hidden"
          >
            <div className="space-y-1 px-4 py-3">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2.5 text-base font-medium text-slate hover:bg-white hover:text-navy"
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2.5 text-base font-medium text-slate hover:bg-white hover:text-navy"
              >
                Request a demo
              </Link>
              {signedIn ? (
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="mt-3 block rounded-lg bg-navy px-4 py-2.5 text-center text-sm font-semibold text-white"
                >
                  Go to dashboard
                </Link>
              ) : (
                <div className="flex gap-2 pt-3">
                  <Link
                    href="/auth/signin"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-lg border border-gray-muted bg-white px-4 py-2.5 text-center text-sm font-semibold text-navy"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/get-started"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-lg bg-navy px-4 py-2.5 text-center text-sm font-semibold text-white"
                  >
                    Get started
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
