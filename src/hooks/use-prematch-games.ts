/**
 * hooks/use-prematch-games.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that loads real prematch fixtures from the SmartBet gamesBaseUrl feed
 * (https://api-games.smbet.net/) and falls back to local fixtures if offline.
 *
 * Implements a shared module cache to prevent redundant re-fetching across routes.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback } from "react";
import { smartBetApi, type CountryWithLeagues } from "@/lib/api-smartbet";
import { adaptPrematchGame } from "@/lib/matches-adapter";
import { matches as fallbackMatches, type Match } from "@/lib/betting-data";

let cachedMatches: Match[] | null = null;
let cachedCountries: CountryWithLeagues[] | null = null;
let inFlightFetch: Promise<Match[]> | null = null;

export function getCachedMatchById(id: string): Match | undefined {
  if (cachedMatches) {
    const found = cachedMatches.find((m) => m.id === id);
    if (found) return found;
  }
  return fallbackMatches.find((m) => m.id === id);
}

export function usePrematchGames() {
  const [matches, setMatches] = useState<Match[]>(() => cachedMatches || fallbackMatches);
  const [countries, setCountries] = useState<CountryWithLeagues[]>(() => cachedCountries || []);
  const [loading, setLoading] = useState<boolean>(() => !cachedMatches);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async (force = false) => {
    if (!force && cachedMatches && cachedMatches.length > 0) {
      setMatches(cachedMatches);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      if (!inFlightFetch || force) {
        inFlightFetch = (async () => {
          const feed = await smartBetApi.getPrematchFeed();
          if (Array.isArray(feed) && feed.length > 0) {
            const adapted = feed.map(adaptPrematchGame);
            cachedMatches = adapted;
            return adapted;
          }
          return fallbackMatches;
        })();
      }

      const [adaptedMatches, countriesData] = await Promise.allSettled([
        inFlightFetch,
        smartBetApi.getCountriesWithLeagues().catch(() => []),
      ]);

      if (adaptedMatches.status === "fulfilled" && adaptedMatches.value.length > 0) {
        setMatches(adaptedMatches.value);
      } else {
        setMatches(cachedMatches || fallbackMatches);
      }

      if (countriesData.status === "fulfilled" && Array.isArray(countriesData.value)) {
        cachedCountries = countriesData.value;
        setCountries(countriesData.value);
      }
    } catch (err) {
      console.warn("[usePrematchGames] Error fetching games feed, using cache or fallback:", err);
      setError(err instanceof Error ? err.message : "Failed to load feed");
      setMatches(cachedMatches || fallbackMatches);
    } finally {
      inFlightFetch = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
    // Auto-refresh prematch odds and games every 60 seconds in the background
    const interval = setInterval(() => fetchGames(true), 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchGames]);

  return {
    matches,
    countries,
    loading,
    error,
    refresh: () => fetchGames(true),
  };
}
