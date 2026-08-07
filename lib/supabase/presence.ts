"use client";

/**
 * Live device presence — which screens are actually online right now.
 *
 * Uses Supabase Realtime Presence (the same transport as liveChannel.ts), which
 * is purpose-built for this: each client joins a channel and publishes a small
 * state blob; every subscriber gets the full roster plus join/leave events, and
 * a client that loses power or network is dropped automatically by the server's
 * heartbeat. That last part is why this beats writing `last_seen_at` rows — a
 * tablet that dies mid-shift disappears on its own instead of looking "online"
 * until some timeout we'd have to hand-tune.
 *
 * Carries NO patient content — only which device is on which screen. The live
 * transcript stream is a separate channel (liveChannel.ts) so an admin roster
 * view can never accidentally become a patient-speech feed.
 */

import { getAuthClient } from "@/lib/auth/supabase-browser";

export type ScreenKind = "room" | "staff" | "admin";

export interface DevicePresence {
  deviceKey: string;      // stable per browser/tab
  kind: ScreenKind;
  roomId?: string;
  roomNumber?: string;
  label: string;          // "Room 204" / "Command Center" — never a patient name
  path: string;           // which screen it's on
  since: number;          // epoch ms this device joined
}

const TOPIC = (facilityId: string) => `presence:${facilityId}`;

/** Stable per-tab id so a refresh doesn't look like a brand-new device forever. */
export function deviceKey(): string {
  if (typeof window === "undefined") return "ssr";
  const KEY = "rehub:device-key";
  try {
    let k = sessionStorage.getItem(KEY);
    if (!k) {
      k = `dev-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    return `dev-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Announce this screen as online for the facility. Returns a cleanup fn.
 * Safe to call when Supabase isn't configured — it just no-ops.
 */
export function joinPresence(
  facilityId: string,
  info: Omit<DevicePresence, "deviceKey" | "since">,
): () => void {
  if (typeof window === "undefined") return () => {};
  try {
    const supabase = getAuthClient();
    const key = deviceKey();
    const channel = supabase.channel(TOPIC(facilityId), {
      config: { presence: { key } },
    });
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        channel.track({ ...info, deviceKey: key, since: Date.now() }).catch(() => {});
      }
    });
    return () => { try { supabase.removeChannel(channel); } catch { /* ignore */ } };
  } catch {
    return () => {};
  }
}

/**
 * Watch the live roster of online screens for a facility.
 * `onRoster` fires with the full current list on every join/leave/sync.
 */
export function subscribePresence(
  facilityId: string,
  onRoster: (devices: DevicePresence[]) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  try {
    const supabase = getAuthClient();
    // A distinct presence key so the watcher itself doesn't appear in its own
    // roster as a phantom device.
    const channel = supabase.channel(TOPIC(facilityId), {
      config: { presence: { key: `watch-${deviceKey()}` } },
    });

    const emit = () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = (channel as any).presenceState() as Record<string, unknown[]>;
        const devices: DevicePresence[] = [];
        for (const [k, entries] of Object.entries(state)) {
          if (k.startsWith("watch-")) continue; // skip other admin watchers
          const e = entries?.[0] as DevicePresence | undefined;
          if (e?.label) devices.push(e);
        }
        devices.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
        onRoster(devices);
      } catch { /* transient */ }
    };

    channel
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("presence" as any, { event: "sync" }, emit)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("presence" as any, { event: "join" }, emit)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("presence" as any, { event: "leave" }, emit)
      .subscribe();

    return () => { try { supabase.removeChannel(channel); } catch { /* ignore */ } };
  } catch {
    return () => {};
  }
}

// ── Remote nudge ────────────────────────────────────────────────────────────
// NOT remote control — a browser cannot take over another device's screen.
// This is a targeted message a room screen chooses to obey: "go back to your
// room screen" / "reload". It fixes the real failure mode (a tablet drifted to
// the wrong page or got logged out) without pretending to be screen-sharing.

const NUDGE_EVENT = "nudge";
// Sender and listener MUST share one topic for broadcast to route between them.
const NUDGE_TOPIC = (facilityId: string) => `nudge:${facilityId}`;
export type NudgeAction = "reload" | "go-home";

export function sendNudge(facilityId: string, targetDeviceKey: string, action: NudgeAction): void {
  try {
    const supabase = getAuthClient();
    const ch = supabase.channel(NUDGE_TOPIC(facilityId));
    ch.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: NUDGE_EVENT, payload: { targetDeviceKey, action } });
        setTimeout(() => { try { supabase.removeChannel(ch); } catch { /* ignore */ } }, 500);
      }
    });
  } catch { /* best effort */ }
}

/** Room screens listen for nudges addressed to them. Returns a cleanup fn. */
export function subscribeNudges(facilityId: string, onNudge: (a: NudgeAction) => void): () => void {
  if (typeof window === "undefined") return () => {};
  try {
    const supabase = getAuthClient();
    const me = deviceKey();
    const channel = supabase
      .channel(NUDGE_TOPIC(facilityId))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("broadcast" as any, { event: NUDGE_EVENT }, (msg: any) => {
        // Every device receives every nudge; only the addressed one acts.
        if (msg?.payload?.targetDeviceKey === me) onNudge(msg.payload.action as NudgeAction);
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch { /* ignore */ } };
  } catch {
    return () => {};
  }
}
