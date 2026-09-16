/**
 * hooks/use-wallet.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches the signed-in user's wallet balance and recent transaction history.
 * Refreshes automatically when the user changes and exposes a manual refresh
 * callback so form submissions can update the displayed balance without a full
 * page reload.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback } from "react";
import {
  getWalletBalance,
  getWalletTransactions,
  type WalletTransaction,
} from "@/modules/wallet/wallet.functions";
import { useAuth } from "./use-auth";

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
      if (!isAuthenticated || !user) {
        setBalance(null);
        setTransactions([]);
        setLoading(false);
        return;
      }
      try {
        // Balance is derived from ledger_entries by the wallet_balance RPC.
        // Transaction history is paginated; default to the most recent 50 rows.
        const [bal, txs] = await Promise.all([
          getWalletBalance(),
          (getWalletTransactions as any)({ data: {} }),
        ]);

        if (mounted) {
          setBalance(bal);
          setTransactions(txs);
        }
      } catch (e) {
        console.error("Wallet load failed", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, user?.id, refreshKey]);

  return { balance, transactions, loading, refresh };
}
