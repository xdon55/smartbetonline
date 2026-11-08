/**
 * hooks/use-wallet.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches the signed-in user's wallet balance and recent transaction history.
 * Supports both SmartBet Online UserInfo API (GET /api/Online/UserInfo)
 * and internal PostgreSQL ledger entries via Supabase.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback } from "react";
import {
  getWalletBalance,
  getWalletTransactions,
  type WalletTransaction,
} from "@/modules/wallet/wallet.functions";
import { useAuth } from "./use-auth";
import { smartBetApi } from "@/lib/api-smartbet";

export function useWallet() {
  const { isAuthenticated, user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    async function load() {
      // 1. First check SmartBet Online UserInfo API
      try {
        const userInfo = await smartBetApi.getUserInfo();
        if (mounted && userInfo && typeof userInfo.Balance === "number") {
          setBalance(userInfo.Balance);
          setLoading(false);
          return;
        }
      } catch {
        // User not logged into SmartBet session or API offline
      }

      // 2. Check Supabase internal ledger balance if authenticated
      if (!isAuthenticated || !user) {
        // Check if there is an active local user session
        const storedUser = localStorage.getItem("smartbet_active_user");
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            if (typeof parsed.Balance === "number") {
              setBalance(parsed.Balance);
              setLoading(false);
              return;
            }
          } catch {
            // Ignore parse error
          }
        }
        setBalance(null);
        setTransactions([]);
        setLoading(false);
        return;
      }

      try {
        const [bal, txs] = await Promise.all([
          getWalletBalance(),
          (
            getWalletTransactions as unknown as (args: {
              data?: { cursor?: string; limit?: number };
            }) => Promise<WalletTransaction[]>
          )({ data: {} }),
        ]);

        if (mounted) {
          setBalance(bal);
          setTransactions(txs);
        }
      } catch (e) {
        console.warn("Wallet ledger load fallback:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, user, refreshKey]);

  return { balance, transactions, loading, refresh };
}
