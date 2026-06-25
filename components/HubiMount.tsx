"use client";

/**
 * HubiMount — mounts the floating Hubi assistant globally and gives it page
 * context. Rendered once in the root layout so Hubi is present on every page:
 * a live preview for visitors, a context-aware helper for signed-in staff.
 *
 * Hidden on full-screen kiosk / capture surfaces (patient room tablet, join
 * pairing, single-room view) and auth screens, where a floating mic would
 * collide with the page's own voice flow or distract from a focused task.
 */

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import HubiWidget from "@/components/HubiWidget";

// Map a pathname to a short, human-readable context string for Hubi.
function describe(path: string): string {
  if (path === "/") return "the ReHub home page";
  if (path.startsWith("/command")) return "the staff command center (live request queue)";
  if (path.startsWith("/dashboard")) return "the facility dashboard";
  if (path.startsWith("/rooms")) return "the patient rooms page";
  if (path.startsWith("/facility")) return "the operations page (facility, staff, and analytics)";
  if (path.startsWith("/admin")) return "the analytics page";
  if (path.startsWith("/account") || path.startsWith("/setup")) return "account & settings";
  if (path.startsWith("/onboarding")) return "facility onboarding";
  if (path.startsWith("/pricing")) return "the pricing page";
  if (path.startsWith("/for-facilities")) return "the for-facilities page";
  if (path.startsWith("/contact") || path.startsWith("/demo")) return "the contact / demo page";
  return "the ReHub website";
}

// Surfaces where the floating assistant should NOT appear.
const HIDDEN_PREFIXES = ["/patient", "/resident", "/join", "/room/", "/auth", "/diagnostics"];

export default function HubiMount() {
  const path = usePathname() || "/";
  const { signedIn } = useAuth();

  if (HIDDEN_PREFIXES.some((p) => path.startsWith(p))) return null;

  return <HubiWidget pageContext={describe(path)} signedIn={signedIn} />;
}
