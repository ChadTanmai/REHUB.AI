"use client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

import { getAuthClient } from "@/lib/auth/supabase-browser";

export interface LoginEvent {
  id: string;
  occurredAt: string;
  userAgent: string | null;
}

/**
 * Best-effort sign-in log. Called from AuthProvider on SIGNED_IN — failures
 * are swallowed since this is informational, never something that should
 * block or disrupt authentication.
 */
export async function logSignIn(userId: string): Promise<void> {
  try {
    const supabase = getAuthClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("login_events").insert({
      user_id: userId,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
    });
  } catch {
    /* table may not exist yet if the 0010 migration hasn't been run — ignore */
  }
}

/** Most recent sign-ins for the current user, newest first. */
export async function fetchRecentLogins(limit = 5): Promise<LoginEvent[]> {
  try {
    const supabase = getAuthClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("login_events")
      .select("id, occurred_at, user_agent")
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as Row[]).map((r) => ({
      id: r.id,
      occurredAt: r.occurred_at,
      userAgent: r.user_agent,
    }));
  } catch {
    return [];
  }
}

/** Turn a raw user-agent string into a short, human label — best effort, not a full UA parser. */
export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent;
  const os = /iphone|ipad/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /mac os/i.test(ua) ? "macOS" : /windows/i.test(ua) ? "Windows" : /linux/i.test(ua) ? "Linux" : "Unknown OS";
  const browser = /edg\//i.test(ua) ? "Edge" : /chrome/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : /firefox/i.test(ua) ? "Firefox" : "Browser";
  return `${browser} on ${os}`;
}
