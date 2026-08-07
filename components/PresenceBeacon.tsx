"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { joinPresence, subscribeNudges, type ScreenKind } from "@/lib/supabase/presence";

/**
 * Announces "this screen is online" to the facility's admin roster, and obeys
 * targeted nudges (reload / go back to the room screen).
 *
 * Rendered as a component rather than a hook so pages with early returns (the
 * room screen bails out before any hooks when unpaired) can mount it inside
 * their JSX without tripping the rules of hooks.
 *
 * Renders nothing. Carries no patient content — see lib/supabase/presence.ts.
 */
export default function PresenceBeacon({
  facilityId,
  kind,
  label,
  roomId,
  roomNumber,
  homePath,
}: {
  facilityId: string;
  kind: ScreenKind;
  label: string;
  roomId?: string;
  roomNumber?: string;
  /** Where "go-home" sends this device. Defaults to the current path. */
  homePath?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!facilityId) return;
    const leave = joinPresence(facilityId, {
      kind, label, roomId, roomNumber, path: pathname ?? "",
    });
    return leave;
  }, [facilityId, kind, label, roomId, roomNumber, pathname]);

  useEffect(() => {
    if (!facilityId) return;
    return subscribeNudges(facilityId, (action) => {
      if (action === "reload") window.location.reload();
      else if (action === "go-home") router.push(homePath ?? pathname ?? "/");
    });
  }, [facilityId, homePath, pathname, router]);

  return null;
}
