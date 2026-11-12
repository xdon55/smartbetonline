/**
 * hooks/use-live-games.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that streams real-time live games from Socket.IO (wss://socket.smbet.net).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback } from "react";
import { liveGamesSocket, type LiveSocketStatus } from "@/lib/socket-live-games";
import { matches as fallbackMatches, type Match } from "@/lib/betting-data";

let cachedLiveMatches: Match[] = [];

export function useLiveGames() {
  const [socketMatches, setSocketMatches] = useState<Match[]>(() => {
    const existing = liveGamesSocket.getMatches();
    return existing.length > 0 ? existing : cachedLiveMatches;
  });
  const [status, setStatus] = useState<LiveSocketStatus>(() =>
    typeof window !== "undefined" ? liveGamesSocket.getStatus() : "connecting",
  );
  const [loading, setLoading] = useState<boolean>(
    () => socketMatches.length === 0 && cachedLiveMatches.length === 0,
  );

  useEffect(() => {
    // Subscribe to Socket.IO live stream
    const unsubscribeMatches = liveGamesSocket.subscribe((liveList) => {
      if (liveList && liveList.length > 0) {
        cachedLiveMatches = liveList;
        setSocketMatches(liveList);
        setLoading(false);
      }
    });

    const unsubscribeStatus = liveGamesSocket.subscribeStatus((newStatus) => {
      setStatus(newStatus);
      if (newStatus === "connected" || newStatus === "error") {
        setLoading(false);
      }
    });

    // Auto-sync live odds every 12s in background so odds are always 100% up to date
    const autoInterval = setInterval(() => {
      liveGamesSocket.requestRefresh();
    }, 12000);

    return () => {
      unsubscribeMatches();
      unsubscribeStatus();
      clearInterval(autoInterval);
    };
  }, []);

  const refresh = useCallback(async () => {
    await liveGamesSocket.requestRefresh();
    // Re-check after reconnection snapshot arrives
    setTimeout(() => {
      const current = liveGamesSocket.getMatches();
      if (current.length > 0) {
        cachedLiveMatches = current;
        setSocketMatches(current);
      }
      setLoading(false);
    }, 450);
  }, []);

  // Use real socket matches if available, else cached, else fallback
  const displayMatches =
    socketMatches.length > 0
      ? socketMatches
      : cachedLiveMatches.length > 0
        ? cachedLiveMatches
        : fallbackMatches.filter((m) => m.live);

  return {
    matches: displayMatches,
    status,
    loading: loading && displayMatches.length === 0,
    refresh,
    isRealTime: status === "connected" && displayMatches.length > 0,
  };
}
