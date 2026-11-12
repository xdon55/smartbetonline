/**
 * hooks/use-open-bets.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks the count of active unsettled open bets.
 * Syncs with the SmartBet Online OpenBetsCount API (GET /api/Online/OpenBetsCount)
 * and active bet slips.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback } from "react";
import { smartBetApi } from "@/lib/api-smartbet";
import { useBetSlip } from "@/lib/betslip";

export function useOpenBets() {
  const { bets } = useBetSlip();
  const localOpenCount = bets.filter((b) => b.status === "open").length;

  const [openCount, setOpenCount] = useState<number>(localOpenCount);
  const [loading, setLoading] = useState(false);

  const fetchCount = useCallback(async () => {
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
      setOpenCount(Math.max(remoteCount, localOpenCount));
    } catch {
      setOpenCount(localOpenCount);
    } finally {
      setLoading(false);
    }
  }, [localOpenCount]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return {
    openCount,
    loading,
    refresh: fetchCount,
  };
}
