/**
 * src/lib/auth-context.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Global reactive Authentication Context.
 *
 * Ensures sign-in and sign-out update every mounted consumer (SiteHeader,
 * AccountMenu, WalletProvider, Deposit, Withdraw, MyBets) synchronously,
 * and clears both SmartBet proxy/backend sessions and Supabase auth storage
 * cleanly on sign-out.
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSupabaseProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
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

    // 1. Check local cached user
    try {
      const stored = localStorage.getItem("smartbet_active_user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u && (u.UserId || u.PhoneNumber || u.UserName)) {
          nextUser = {
            id: String(u.UserId || u.AccountId),
            email: u.Email || `${u.UserName || u.PhoneNumber}@smartbet.ug`,
            username: u.UserName,
          };
        }
      }
    } catch {
      // Storage empty or unparseable
    }

    // 2. Verify with SmartBet API CheckLogin
    try {
      const remoteUser = await smartBetApi.checkLogin();
      if (remoteUser && (remoteUser.UserId || remoteUser.AccountId || remoteUser.UserName)) {
        nextUser = {
          id: String(remoteUser.UserId || remoteUser.AccountId),
          email: remoteUser.Email || `${remoteUser.UserName || remoteUser.PhoneNumber}@smartbet.ug`,
          username: remoteUser.UserName,
        };
        try {
          localStorage.setItem("smartbet_active_user", JSON.stringify(remoteUser));
        } catch {
          // Ignore storage error
        }
      }
    } catch {
      // Offline or unauthenticated
    }

    // 3. Check active Supabase session
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

    setUser(nextUser);
    setProfile(nextProfile);
    setLoading(false);
  }, [loadSupabaseProfile]);

  useEffect(() => {
    void refreshAuth();

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
      listener.subscription.unsubscribe();
    };
  }, [refreshAuth, loadSupabaseProfile]);

  const signOut = useCallback(async () => {
    // 1. Immediately reflect signed-out state across all consumers
    setUser(null);
    setProfile(null);

    // 2. Call SmartBet logOff (also clears smartbet_session_token & smartbet_active_user)
    try {
      await smartBetApi.logOff();
    } catch {
      // Safe if offline
    }

    // 3. Sign out of Supabase locally & globally
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Fallback
    }

    // 4. Wipe any remaining local auth tokens
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
