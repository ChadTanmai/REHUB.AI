"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { getAuthClient } from "./supabase-browser";
import { getStore } from "@/lib/store";

const SUPABASE_ENABLED =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export interface AuthProfile {
  fullName: string;
  displayName: string;
  email: string;
  facilityId: string | null;
  facilityName: string;
  facilityCode: string | null;
  role: string;
  avatarUrl: string | null;
}

interface AuthContextValue {
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  signedIn: boolean;
  signOut: () => Promise<void>;
  signOutAllDevices: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signedIn: false,
  signOut: async () => {},
  signOutAllDevices: async () => {},
  refresh: async () => {},
});

function profileFromUser(user: User | null): AuthProfile | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  const fullName = meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? "User";
  return {
    fullName,
    displayName: meta.display_name ?? meta.nickname ?? fullName,
    email: user.email ?? "",
    facilityId: meta.facility_id ?? null,
    facilityName: meta.facility_name ?? "",
    facilityCode: meta.facility_code ?? null,
    role: meta.role ?? "facility_director",
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
  };
}

/**
 * Bind the local workspace store to the authenticated account and reconcile
 * the user's own facility. This is the tenant-isolation boundary on the client:
 *   1. The store only ever lists facilities owned by this user id.
 *   2. The user's Supabase-metadata facility (if any) is claimed/validated so
 *      it shows up for them — and only them.
 *   3. Stale staff sessions from a previous account are purged.
 */
function bindStoreToUser(user: User | null) {
  if (typeof window === "undefined") return;
  const store = getStore();
  const ownerId = user?.id ?? null;
  store.setOwner(ownerId);
  if (ownerId) {
    const metaFacilityId = (user?.user_metadata?.facility_id as string) ?? null;
    if (metaFacilityId) {
      // Re-associate the user's own facility (orphan-claim is a no-op if it's
      // already owned by them, and refuses if owned by someone else).
      store.claimFacility(metaFacilityId, ownerId);
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(SUPABASE_ENABLED);

  // Keep the workspace store scoped to the current account at all times.
  useEffect(() => {
    bindStoreToUser(user);
  }, [user]);

  const refresh = useCallback(async () => {
    if (!SUPABASE_ENABLED) {
      setLoading(false);
      return;
    }
    const { data } = await getAuthClient().auth.getUser();
    setUser(data.user ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!SUPABASE_ENABLED) {
      setLoading(false);
      return;
    }
    const supabase = getAuthClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const clearLocalSessions = () => {
    if (typeof window === "undefined") return;
    // Correct session keys (lib/session.ts). The staff session must be cleared
    // so the next account that signs in on this browser starts clean.
    localStorage.removeItem("rehub:session:therapist");
    sessionStorage.removeItem("rehub:intro-seen");
    // Re-scope the store to "no owner" so no facility is visible while signed out.
    getStore().setOwner(null);
  };

  const signOut = useCallback(async () => {
    if (SUPABASE_ENABLED) await getAuthClient().auth.signOut();
    setUser(null);
    clearLocalSessions();
  }, []);

  const signOutAllDevices = useCallback(async () => {
    if (SUPABASE_ENABLED) await getAuthClient().auth.signOut({ scope: "global" });
    setUser(null);
    clearLocalSessions();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: profileFromUser(user),
        loading,
        signedIn: Boolean(user),
        signOut,
        signOutAllDevices,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
