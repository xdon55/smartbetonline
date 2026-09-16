/**
 * hooks/use-auth.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that tracks the signed-in user, fetches/creates their profile, and
 * exposes sign-out. Uses the browser Supabase client for session state and a
 * server function for the application profile row.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserProfile, type UserProfile } from "@/modules/auth/auth.functions";

export function useAuth() {
  const fetchProfile = useServerFn(getCurrentUserProfile);
  const [user, setUser] = useState<null | { id: string; email: string | undefined }>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        try {
          const p = await fetchProfile();
          if (mounted) setProfile(p);
        } catch (e) {
          console.error("Failed to load profile", e);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      if (mounted) setLoading(false);
    }

    load();

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
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return { user, profile, loading, signOut, isAuthenticated: !!user };
}
