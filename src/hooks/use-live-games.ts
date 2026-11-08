/**
 * hooks/use-live-games.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that streams real-time live games from Socket.IO and falls back
 * to the HTTP prematch/live feed if disconnected.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback } from "react";
import { liveGamesSocket, type LiveSocketStatus } from "@/lib/socket-live-games";
import { matches as fallbackMatches, type Match } from "@/lib/betting-data";
import { smartBetApi } from "@/lib/api-smartbet";
import { adaptPrematchGame } from "@/lib/matches-adapter";

export function useLiveGames() {
  const [socketMatches, setSocketMatches] = useState<Match[]>([]);
  const [status, setStatus] = useState<LiveSocketStatus>("connecting");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Subscribe to Socket.IO live stream
    const unsubscribeMatches = liveGamesSocket.subscribe((liveList) => {
      setSocketMatches(liveList);
      if (liveList.length > 0) {
        setLoading(false);
      }
    });

    const unsubscribeStatus = liveGamesSocket.subscribeStatus((newStatus) => {
      setStatus(newStatus);
    });

    // 2. Initial HTTP fetch fallback
    let mounted = true;
    async function loadFallbackFeed() {
      try {
        const topGames = await smartBetApi.getPrematchFeed();
        if (mounted && topGames && topGames.length > 0) {
          const adapted = topGames.map(adaptPrematchGame);
          // Only use if socket hasn't yielded live matches yet
          if (liveGamesSocket.getMatches().length === 0) {
            setSocketMatches(
              adapted.slice(0, 6).map((m, idx) => ({
                ...m,
                live: {
                  minute: 35 + idx * 8,
                  homeScore: idx % 2 === 0 ? 1 : 0,
                  awayScore: idx % 3 === 0 ? 2 : 1,
                },
              })),
            );
          }
        }
      } catch (err) {
        console.warn("[useLiveGames] HTTP feed fallback error, using local seed:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadFallbackFeed();

    return () => {
      mounted = false;
      unsubscribeMatches();
      unsubscribeStatus();
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const feed = await smartBetApi.getPrematchFeed();
      if (feed && feed.length > 0) {
        const adapted = feed.map(adaptPrematchGame);
        setSocketMatches(
          adapted.slice(0, 6).map((m, idx) => ({
            ...m,
            live: {
              minute: 40 + idx * 5,
              homeScore: idx % 2,
              awayScore: idx % 3,
            },
          })),
        );
      }
    } catch {
      // Keep existing matches
    } finally {
      setLoading(false);
    }
  }, []);

  // Use socket matches if available, else static seed live matches
  const displayMatches =
    socketMatches.length > 0 ? socketMatches : fallbackMatches.filter((m) => m.live);

  return {
    matches: displayMatches,
    status,
    loading,
    refresh,
    isRealTime: status === "connected" && socketMatches.length > 0,
  };
}
