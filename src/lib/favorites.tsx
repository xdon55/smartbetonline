/**
 * lib/favorites.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Global Favorites context (My Favorites) for logged-in users.
 * Allows authenticated users to pin/unpin matches and leagues to a personal
 * "My Favorites" collection, persisted across server proxy (/api/Online/Favorites),
 * Supabase platform_config (when configured), and per-user localStorage cache.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { Match } from "@/lib/betting-data";
import { useAuth } from "@/hooks/use-auth";
import {
  smartBetApi,
  type FavoriteLeagueRecord,
  type FavoriteMatchRecord,
  type UserFavoritesPayload,
} from "@/lib/api-smartbet";
import { fetchUserFavorites, saveUserFavorites } from "@/lib/supabase-sportsbook";

export type { FavoriteMatchRecord, FavoriteLeagueRecord, UserFavoritesPayload };

export type LeaguePinInput = {
  league: string;
  country?: string;
  sport?: string;
};

type FavoritesContextValue = {
  favoriteMatches: FavoriteMatchRecord[];
  favoriteLeagues: FavoriteLeagueRecord[];
  loading: boolean;
  totalCount: number;
  isMatchFavorited: (matchId: string) => boolean;
  isLeagueFavorited: (league: string, country?: string) => boolean;
  toggleFavoriteMatch: (match: Match) => void;
  toggleFavoriteLeague: (input: LeaguePinInput) => void;
  removeFavoriteMatch: (matchId: string) => void;
  removeFavoriteLeague: (key: string) => void;
  clearFavorites: () => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function normalizeLeagueKey(league: string, country = "International"): string {
  const cleanCountry = (country || "International").trim().toLowerCase();
  const cleanLeague = (league || "").trim().toLowerCase();
  return `${cleanCountry}:::${cleanLeague}`;
}

function getStorageKey(userId: string): string {
  return `smartbet_favorites_${userId}`;
}

function readLocalFavorites(userId: string): UserFavoritesPayload | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserFavoritesPayload>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      matches: Array.isArray(parsed.matches) ? parsed.matches : [],
      leagues: Array.isArray(parsed.leagues) ? parsed.leagues : [],
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

function writeLocalFavorites(userId: string, payload: UserFavoritesPayload): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

function parseTimestamp(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [favoriteMatches, setFavoriteMatches] = useState<FavoriteMatchRecord[]>([]);
  const [favoriteLeagues, setFavoriteLeagues] = useState<FavoriteLeagueRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Keep latest state in refs for synchronous mutation & rollback-safe saves
  const stateRef = useRef<{ matches: FavoriteMatchRecord[]; leagues: FavoriteLeagueRecord[] }>({
    matches: [],
    leagues: [],
  });
  stateRef.current = { matches: favoriteMatches, leagues: favoriteLeagues };

  const activeUserId = isAuthenticated && user?.id ? user.id : null;

  useEffect(() => {
    if (authLoading) return;

    if (!activeUserId) {
      setFavoriteMatches([]);
      setFavoriteLeagues([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // 1. Immediate per-user local hydration
    const localData = readLocalFavorites(activeUserId);
    if (localData) {
      setFavoriteMatches(localData.matches);
      setFavoriteLeagues(localData.leagues);
    } else {
      setFavoriteMatches([]);
      setFavoriteLeagues([]);
    }

    // 2. Sync with backend proxy & optional Supabase
    void (async () => {
      const [apiRes, supaRes] = await Promise.allSettled([
        smartBetApi.getFavorites(activeUserId),
        fetchUserFavorites(activeUserId),
      ]);

      if (cancelled) return;

      const candidates: UserFavoritesPayload[] = [];
      if (localData) candidates.push(localData);

      if (apiRes.status === "fulfilled" && apiRes.value) {
        candidates.push({
          matches: Array.isArray(apiRes.value.matches) ? apiRes.value.matches : [],
          leagues: Array.isArray(apiRes.value.leagues) ? apiRes.value.leagues : [],
          updatedAt: apiRes.value.updatedAt || new Date(0).toISOString(),
        });
      }

      if (supaRes.status === "fulfilled" && supaRes.value) {
        candidates.push({
          matches: (supaRes.value.matches as FavoriteMatchRecord[]) || [],
          leagues: (supaRes.value.leagues as FavoriteLeagueRecord[]) || [],
          updatedAt: supaRes.value.updatedAt || new Date(0).toISOString(),
        });
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => parseTimestamp(b.updatedAt) - parseTimestamp(a.updatedAt));
        const winner = candidates[0]!;
        setFavoriteMatches(winner.matches);
        setFavoriteLeagues(winner.leagues);
        writeLocalFavorites(activeUserId, winner);

        // Backfill server proxy if local/Supabase had newer data
        if (
          winner.matches.length > 0 ||
          winner.leagues.length > 0 ||
          parseTimestamp(winner.updatedAt) > 0
        ) {
          void smartBetApi.saveFavorites(winner, activeUserId).catch(() => {});
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeUserId, authLoading]);

  const persist = useCallback(
    (nextMatches: FavoriteMatchRecord[], nextLeagues: FavoriteLeagueRecord[]) => {
      if (!activeUserId) return;
      const payload: UserFavoritesPayload = {
        matches: nextMatches,
        leagues: nextLeagues,
        updatedAt: new Date().toISOString(),
      };
      setFavoriteMatches(nextMatches);
      setFavoriteLeagues(nextLeagues);
      writeLocalFavorites(activeUserId, payload);
      void smartBetApi.saveFavorites(payload, activeUserId).catch(() => {});
      void saveUserFavorites(activeUserId, payload).catch(() => {});
    },
    [activeUserId],
  );

  const requireAuthPrompt = useCallback(() => {
    toast("Sign in to pin favorites", {
      description: "Log in to save matches and leagues to My Favorites.",
      action: {
        label: "Login",
        onClick: () => {
          void navigate({ to: "/auth", search: { tab: "login" } });
        },
      },
    });
  }, [navigate]);

  const matchIdSet = useMemo(
    () => new Set(favoriteMatches.map((m) => m.matchId)),
    [favoriteMatches],
  );

  const leagueKeySet = useMemo(() => new Set(favoriteLeagues.map((l) => l.key)), [favoriteLeagues]);

  const isMatchFavorited = useCallback((matchId: string) => matchIdSet.has(matchId), [matchIdSet]);

  const isLeagueFavorited = useCallback(
    (league: string, country = "International") =>
      leagueKeySet.has(normalizeLeagueKey(league, country)),
    [leagueKeySet],
  );

  const toggleFavoriteMatch = useCallback(
    (match: Match) => {
      if (!isAuthenticated || !activeUserId) {
        requireAuthPrompt();
        return;
      }

      const current = stateRef.current;
      const exists = current.matches.some((m) => m.matchId === match.id);
      if (exists) {
        const next = current.matches.filter((m) => m.matchId !== match.id);
        persist(next, current.leagues);
        toast("Removed from My Favorites", {
          description: `${match.home} v ${match.away}`,
        });
      } else {
        const record: FavoriteMatchRecord = {
          matchId: match.id,
          home: match.home,
          away: match.away,
          league: match.league,
          country: match.country,
          sport: match.sport,
          startsAt: match.startsAt,
          pinnedAt: new Date().toISOString(),
        };
        const next = [record, ...current.matches];
        persist(next, current.leagues);
        toast("Pinned to My Favorites", {
          description: `${match.home} v ${match.away}`,
        });
      }
    },
    [isAuthenticated, activeUserId, persist, requireAuthPrompt],
  );

  const toggleFavoriteLeague = useCallback(
    ({ league, country = "International", sport = "Football" }: LeaguePinInput) => {
      if (!isAuthenticated || !activeUserId) {
        requireAuthPrompt();
        return;
      }

      const cleanLeague = league.trim();
      const cleanCountry = (country || "International").trim();
      if (!cleanLeague) return;

      const key = normalizeLeagueKey(cleanLeague, cleanCountry);
      const current = stateRef.current;
      const exists = current.leagues.some((l) => l.key === key);

      if (exists) {
        const next = current.leagues.filter((l) => l.key !== key);
        persist(current.matches, next);
        toast("League unpinned", {
          description: `${cleanCountry} · ${cleanLeague}`,
        });
      } else {
        const record: FavoriteLeagueRecord = {
          key,
          league: cleanLeague,
          country: cleanCountry,
          sport,
          pinnedAt: new Date().toISOString(),
        };
        const next = [record, ...current.leagues];
        persist(current.matches, next);
        toast("League pinned to My Favorites", {
          description: `${cleanCountry} · ${cleanLeague}`,
        });
      }
    },
    [isAuthenticated, activeUserId, persist, requireAuthPrompt],
  );

  const removeFavoriteMatch = useCallback(
    (matchId: string) => {
      if (!activeUserId) return;
      const current = stateRef.current;
      persist(
        current.matches.filter((m) => m.matchId !== matchId),
        current.leagues,
      );
    },
    [activeUserId, persist],
  );

  const removeFavoriteLeague = useCallback(
    (key: string) => {
      if (!activeUserId) return;
      const current = stateRef.current;
      persist(
        current.matches,
        current.leagues.filter((l) => l.key !== key),
      );
    },
    [activeUserId, persist],
  );

  const clearFavorites = useCallback(() => {
    if (!activeUserId) return;
    persist([], []);
    toast("Cleared all favorites");
  }, [activeUserId, persist]);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favoriteMatches,
      favoriteLeagues,
      loading,
      totalCount: favoriteMatches.length + favoriteLeagues.length,
      isMatchFavorited,
      isLeagueFavorited,
      toggleFavoriteMatch,
      toggleFavoriteLeague,
      removeFavoriteMatch,
      removeFavoriteLeague,
      clearFavorites,
    }),
    [
      favoriteMatches,
      favoriteLeagues,
      loading,
      isMatchFavorited,
      isLeagueFavorited,
      toggleFavoriteMatch,
      toggleFavoriteLeague,
      removeFavoriteMatch,
      removeFavoriteLeague,
      clearFavorites,
    ],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used inside FavoritesProvider");
  }
  return ctx;
}
