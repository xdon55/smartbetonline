/**
 * src/lib/auth-context.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Global reactive Authentication Context.
 *
 * Uses GET /api/Account/CheckLogin as the authoritative session source so
 * expired or signed-out sessions never survive via stale localStorage.
 * Updates all consumers synchronously on login, registration, and sign-out.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserProfile, type UserProfile } from "@/modules/auth/auth.functions";
import { clearSmartBetSession, smartBetApi } from "@/lib/api-smartbet";

export type AuthUser = {
  id: string;
  email: string | undefined;
  username?: string;
  phoneNumber?: string;
};

export type AuthContextValue = {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const isSupabaseConfigured =
  typeof import.meta !== "undefined" &&
  Boolean(import.meta.env?.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY);

function clearClientAuthStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("smartbet_active_user");
    clearSmartBetSession();

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("sb-") || k.includes("supabase.auth"))) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage errors
  }

  try {
    const sessionKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith("sb-") || k.includes("supabase.auth"))) {
        sessionKeys.push(k);
      }
    }
    for (const k of sessionKeys) {
      sessionStorage.removeItem(k);
    }
  } catch {
    // Ignore storage errors
  }
}

function mapRemoteUser(raw: Record<string, unknown>): AuthUser | null {
  const userId = raw["UserId"] ?? raw["userId"] ?? raw["AccountId"] ?? raw["accountId"];
  const userName = (raw["UserName"] ?? raw["userName"]) as string | undefined;
  const phone = (raw["PhoneNumber"] ?? raw["phoneNumber"]) as string | undefined;
  const email = (raw["Email"] ?? raw["email"]) as string | undefined;

  if (!userId && !userName && !phone) return null;

  return {
    id: String(userId ?? userName ?? phone),
    email: email || (userName ? `${userName}@smartbet.ug` : `${phone}@smartbet.ug`),
    username: userName,
    phoneNumber: phone,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSupabaseProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    if (!isSupabaseConfigured) return null;
    try {
      return await getCurrentUserProfile();
    } catch {
      try {
        const { data: dbProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (dbProfile) {
          return {
            id: dbProfile.id,
            display_name: dbProfile.display_name,
            phone: dbProfile.phone,
            country: dbProfile.country,
            currency: dbProfile.currency,
            date_of_birth: dbProfile.date_of_birth,
            kyc_status: dbProfile.kyc_status,
            account_status: dbProfile.account_status,
          };
        }
      } catch {
        // Offline
      }
      return null;
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    let nextUser: AuthUser | null = null;
    let nextProfile: UserProfile | null = null;

    // 1. Authoritative check with SmartBet Online API (GET /api/Account/CheckLogin)
    try {
      const remote = await smartBetApi.checkLogin();
      if (remote && typeof remote === "object") {
        const mapped = mapRemoteUser(remote as unknown as Record<string, unknown>);
        if (mapped) {
          nextUser = mapped;
          try {
            localStorage.setItem("smartbet_active_user", JSON.stringify(remote));
          } catch {
            // Ignore storage error
          }
        }
      }
    } catch {
      // Network/timeout fallback only
    }

    // 2. Check active Supabase session if configured
    if (isSupabaseConfigured) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const sUser = session.user;
          nextUser = {
            id: sUser.id,
            email: sUser.email,
            username: sUser.user_metadata?.display_name || sUser.email?.split("@")[0],
          };
          nextProfile = await loadSupabaseProfile(sUser.id);
        }
      } catch {
        // Supabase offline
      }
    }

    // 3. Fall back to smartbet_active_user cache (populated by auth.tsx login/register)
    if (!nextUser) {
      try {
        const stored = localStorage.getItem("smartbet_active_user");
        if (stored) {
          nextUser = mapRemoteUser(JSON.parse(stored) as Record<string, unknown>);
        }
      } catch {
        // Ignore
      }
    }

    setUser(nextUser);
    setProfile(nextProfile);
    setLoading(false);
  }, [loadSupabaseProfile]);

  useEffect(() => {
    void refreshAuth();

    const handleSync = () => {
      void refreshAuth();
    };
    window.addEventListener("smartbet:auth-changed", handleSync);
    window.addEventListener("storage", handleSync);

    if (!isSupabaseConfigured) {
      return () => {
        window.removeEventListener("smartbet:auth-changed", handleSync);
        window.removeEventListener("storage", handleSync);
      };
    }

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
        const sUser = session.user;
        setUser({
          id: sUser.id,
          email: sUser.email,
          username: sUser.user_metadata?.display_name || sUser.email?.split("@")[0],
        });
        const p = await loadSupabaseProfile(sUser.id);
        if (p) setProfile(p);
      } else if (event === "SIGNED_OUT") {
        clearClientAuthStorage();
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      window.removeEventListener("smartbet:auth-changed", handleSync);
      window.removeEventListener("storage", handleSync);
      listener.subscription.unsubscribe();
    };
  }, [refreshAuth, loadSupabaseProfile]);

  const signOut = useCallback(async () => {
    setUser(null);
    setProfile(null);

    try {
      await smartBetApi.logOff();
    } catch {
      // Safe if offline
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Fallback
      }
    }

    clearClientAuthStorage();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAuthenticated: !!user,
        signOut,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
