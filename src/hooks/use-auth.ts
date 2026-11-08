/**
 * hooks/use-auth.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook tracking the signed-in user across SmartBet Online API session
 * and Supabase PostgreSQL. Provides real login, registration status, and signout.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserProfile, type UserProfile } from "@/modules/auth/auth.functions";
import { smartBetApi } from "@/lib/api-smartbet";

export function useAuth() {
  const fetchProfile = useServerFn(getCurrentUserProfile);
  const [user, setUser] = useState<null | {
    id: string;
    email: string | undefined;
    username?: string;
  }>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkActiveUser() {
      // 1. Check local session storage first
      try {
        const stored = localStorage.getItem("smartbet_active_user");
        if (stored) {
          const u = JSON.parse(stored);
          if (u && (u.UserId || u.PhoneNumber || u.UserName)) {
            setUser({
              id: String(u.UserId || u.AccountId),
              email: u.Email || `${u.UserName || u.PhoneNumber}@smartbet.ug`,
              username: u.UserName,
            });
          }
        }
      } catch {
        // Storage empty or unparseable
      }

      // 2. Check SmartBet API checkLogin
      try {
        const remoteUser = await smartBetApi.checkLogin();
        if (remoteUser && mounted) {
          setUser({
            id: String(remoteUser.UserId || remoteUser.AccountId),
            email:
              remoteUser.Email || `${remoteUser.UserName || remoteUser.PhoneNumber}@smartbet.ug`,
            username: remoteUser.UserName,
          });
          localStorage.setItem("smartbet_active_user", JSON.stringify(remoteUser));
        }
      } catch {
        // API offline or guest
      }

      // 3. Check Supabase session
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            username: session.user.user_metadata?.display_name || session.user.email?.split("@")[0],
          });
          const p = await fetchProfile().catch(() => null);
          if (mounted && p) setProfile(p);
        }
      } catch {
        // Supabase offline
      }

      if (mounted) setLoading(false);
    }

    checkActiveUser();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        fetchProfile().then(setProfile).catch(console.error);
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    try {
      await smartBetApi.logOff();
    } catch {
      // Fallback
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // Fallback
    }
    try {
      localStorage.removeItem("smartbet_active_user");
    } catch {
      // Fallback
    }
    setUser(null);
    setProfile(null);
  };

  return { user, profile, loading, signOut, isAuthenticated: !!user };
}
