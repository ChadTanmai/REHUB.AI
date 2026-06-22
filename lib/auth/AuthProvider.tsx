"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { getAuthClient } from "./supabase-browser";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(SUPABASE_ENABLED);

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

  const signOut = useCallback(async () => {
    if (SUPABASE_ENABLED) await getAuthClient().auth.signOut();
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("rehub:therapist");
      localStorage.removeItem("rehub:room");
      sessionStorage.removeItem("rehub:intro-seen");
    }
  }, []);

  const signOutAllDevices = useCallback(async () => {
    if (SUPABASE_ENABLED) await getAuthClient().auth.signOut({ scope: "global" });
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("rehub:therapist");
      localStorage.removeItem("rehub:room");
    }
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
