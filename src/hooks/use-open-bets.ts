/**
 * hooks/use-open-bets.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks the count of active unsettled open bets.
 * Syncs exclusively with the SmartBet Online OpenBetsCount API
 * (GET /api/Online/OpenBetsCount).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback } from "react";
import { smartBetApi } from "@/lib/api-smartbet";
import { useBetSlip } from "@/lib/betslip";
import { useAuth } from "@/hooks/use-auth";

export function useOpenBets() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { bets } = useBetSlip();
  const apiOpenCount = bets.filter((b) => b.status === "open").length;

  const [openCount, setOpenCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchCount = useCallback(async () => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setOpenCount(0);
      return;
    }

    setLoading(true);
    try {
      const res = await smartBetApi.getOpenBetsCount();
      let remoteCount = 0;
      if (typeof res === "number") {
        remoteCount = res;
      } else if (
        res &&
        typeof res === "object" &&
        typeof (res as { count: number }).count === "number"
      ) {
        remoteCount = (res as { count: number }).count;
      }
      setOpenCount(remoteCount);
    } catch {
      setOpenCount(apiOpenCount);
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, apiOpenCount]);

  useEffect(() => {
    void fetchCount();
  }, [fetchCount]);

  return {
    openCount: isAuthenticated ? openCount : 0,
    loading,
    refresh: fetchCount,
  };
}
