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
          const u = JSON.parse(stored) as Record<string, unknown>;
          const uid =
            u?.UserId ??
            u?.userId ??
            u?.AccountId ??
            u?.accountId ??
            u?.UserName ??
            u?.userName ??
            u?.PhoneNumber ??
            u?.phoneNumber ??
            u?.Email ??
            u?.email;
          if (uid) {
            const uname = (u?.UserName ?? u?.userName) as string | undefined;
            const phone = (u?.PhoneNumber ?? u?.phoneNumber) as string | undefined;
            const email = (u?.Email ?? u?.email) as string | undefined;
            setUser({
              id: String(uid),
              email: email || (uname || phone ? `${uname || phone}@smartbet.ug` : undefined),
              username: uname,
            });
          }
        }
      } catch {
        // Storage empty or unparseable
      }

      // 2. Check SmartBet API checkLogin
      try {
        const remoteUser = (await smartBetApi.checkLogin()) as Record<string, unknown> | null;
        if (remoteUser && mounted) {
          const uid =
            remoteUser.UserId ??
            remoteUser.userId ??
            remoteUser.AccountId ??
            remoteUser.accountId ??
            remoteUser.UserName ??
            remoteUser.userName ??
            remoteUser.PhoneNumber ??
            remoteUser.phoneNumber ??
            remoteUser.Email ??
            remoteUser.email;
          if (uid) {
            const uname = (remoteUser.UserName ?? remoteUser.userName) as string | undefined;
            const phone = (remoteUser.PhoneNumber ?? remoteUser.phoneNumber) as string | undefined;
            const email = (remoteUser.Email ?? remoteUser.email) as string | undefined;
            setUser({
              id: String(uid),
              email: email || (uname || phone ? `${uname || phone}@smartbet.ug` : undefined),
              username: uname,
            });
            localStorage.setItem("smartbet_active_user", JSON.stringify(remoteUser));
          }
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
          const sUser = session.user;
          setUser({
            id: sUser.id,
            email: sUser.email,
            username: sUser.user_metadata?.display_name || sUser.email?.split("@")[0],
          });

          // Fetch profile from server function, or fallback directly to supabase table
          let p: UserProfile | null = null;
          try {
            p = await fetchProfile();
          } catch {
            const { data: dbProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", sUser.id)
              .maybeSingle();

            if (dbProfile) {
              p = {
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
          }
          if (mounted && p) setProfile(p);
        }
      } catch {
        // Supabase offline
      }

      if (mounted) setLoading(false);
    }

    checkActiveUser();

    const handleAuthSync = () => {
      checkActiveUser();
    };
    window.addEventListener("smartbet:auth-changed", handleAuthSync);
    window.addEventListener("storage", handleAuthSync);

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
        const sUser = session.user;
        setUser({
          id: sUser.id,
          email: sUser.email,
          username: sUser.user_metadata?.display_name || sUser.email?.split("@")[0],
        });

        try {
          const p = await fetchProfile().catch(async () => {
            const { data: dbProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", sUser.id)
              .maybeSingle();
            return dbProfile as UserProfile | null;
          });
          if (p) setProfile(p);
        } catch (err) {
          console.warn("[Auth] Failed to load profile on auth change:", err);
        }
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      window.removeEventListener("smartbet:auth-changed", handleAuthSync);
      window.removeEventListener("storage", handleAuthSync);
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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("smartbet:auth-changed"));
    }
  };

  return { user, profile, loading, signOut, isAuthenticated: !!user };
}
