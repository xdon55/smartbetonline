/**
 * src/lib/wallet-context.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Global reactive Wallet & Online Account Context.
 *
 * Keeps wallet balance, bonus wallet, official statements, and ledger
 * transactions synchronized across SiteHeader, AccountMenu, BetSlip, Deposit,
 * Withdraw, and Transactions views without page reloads.
 *
 * Integrates with SmartBet Online API routes:
 * - GET /api/Online/UserInfo
 * - GET /api/Account/Bonuses
 * - GET /api/Statement/User?userid=...
 * - Internal PostgreSQL / Supabase ledger fallback
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getWalletBalance,
  getWalletTransactions,
  type WalletTransaction,
} from "@/modules/wallet/wallet.functions";
import { useAuth } from "@/hooks/use-auth";
import { smartBetApi, type BonusesResponse, type StatementRow } from "@/lib/api-smartbet";
import { supabase } from "@/integrations/supabase/client";

export type WalletContextValue = {
  balance: number | null;
  bonusBalance: number;
  accountId: string | null;
  userId: string | null;
  phoneNumber: string | null;
  transactions: WalletTransaction[];
  statement: StatementRow[];
  bonuses: BonusesResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  syncBalance: (newBalance: number) => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [bonusBalance, setBonusBalance] = useState<number>(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [statement, setStatement] = useState<StatementRow[]>([]);
  const [bonuses, setBonuses] = useState<BonusesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWallet = useCallback(async () => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setBalance(null);
      setBonusBalance(0);
      setAccountId(null);
      setUserId(null);
      setPhoneNumber(null);
      setTransactions([]);
      setStatement([]);
      setBonuses(null);
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch SmartBet Online UserInfo & Bonuses in parallel
      const [userInfoRes, bonusesRes] = await Promise.allSettled([
        smartBetApi.getUserInfo(),
        smartBetApi.getBonuses(),
      ]);

      let activeUid = user?.id || "";
      let resolvedRemoteBalance = false;

      if (userInfoRes.status === "fulfilled" && userInfoRes.value) {
        const info = userInfoRes.value;
        if (typeof info.Balance === "number") {
          setBalance(info.Balance);
          resolvedRemoteBalance = true;
          try {
            const storedUser = localStorage.getItem("smartbet_active_user");
            if (storedUser) {
              const parsed = JSON.parse(storedUser);
              parsed.Balance = info.Balance;
              localStorage.setItem("smartbet_active_user", JSON.stringify(parsed));
            }
          } catch {
            // Safe
          }
        }
        if (typeof info.BonusBalance === "number") {
          setBonusBalance(info.BonusBalance);
        }
        if (info.AccountId != null) setAccountId(String(info.AccountId));
        if (info.UserId) {
          activeUid = String(info.UserId);
          setUserId(activeUid);
        }
        if (info.PhoneNumber) setPhoneNumber(info.PhoneNumber);
      }

      if (bonusesRes.status === "fulfilled" && bonusesRes.value) {
        setBonuses(bonusesRes.value);
        if (typeof bonusesRes.value.BonusBalance === "number") {
          setBonusBalance(bonusesRes.value.BonusBalance);
        }
      }

      // 2. Fetch official statement rows from GET /api/Statement/User?userid=...
      if (activeUid) {
        try {
          const stmtRows = await smartBetApi.getStatement(activeUid);
          if (Array.isArray(stmtRows)) {
            setStatement(stmtRows);
          }
        } catch {
          // Safe if offline
        }
      }

      // 3. Also load Supabase internal ledger transactions if signed in
      if (user) {
        let bal: number | null = null;
        let txs: WalletTransaction[] = [];

        try {
          bal = await getWalletBalance();
          txs = await (
            getWalletTransactions as unknown as (args: {
              data?: { cursor?: string; limit?: number };
            }) => Promise<WalletTransaction[]>
          )({ data: {} });
        } catch {
          try {
            const { data: dbTxs } = await supabase
              .from("transactions")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(50);

            if (dbTxs && dbTxs.length > 0) {
              txs = dbTxs.map((row) => ({
                id: row.id,
                type: row.type,
                status: row.status,
                direction: row.direction,
                amount: Number(row.amount),
                currency: row.currency,
                reference: row.reference,
                metadata: (row.metadata || {}) as Record<string, string | number | boolean | null>,
                created_at: row.created_at,
              }));

              let computed = 0;
              for (const t of txs) {
                if (t.direction === "credit") computed += t.amount;
                else if (t.direction === "debit") computed -= t.amount;
              }
              bal = Math.max(0, computed);
            }
          } catch {
            // Supabase table unavailable
          }
        }

        if (!resolvedRemoteBalance && bal !== null) {
          setBalance(bal);
        }
        setTransactions(txs);
      }

      if (!resolvedRemoteBalance) {
        try {
          const storedUser = localStorage.getItem("smartbet_active_user");
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            if (typeof parsed.Balance === "number") {
              setBalance(parsed.Balance);
            }
            if (parsed.PhoneNumber) setPhoneNumber(parsed.PhoneNumber);
          }
        } catch {
          // Ignore
        }
      }
    } catch (err) {
      console.warn("[WalletProvider] Refresh error:", err);
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, user]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const refresh = useCallback(async () => {
    await loadWallet();
  }, [loadWallet]);

  const syncBalance = useCallback((newBalance: number) => {
    if (!Number.isFinite(newBalance)) return;
    setBalance(newBalance);
    try {
      const storedUser = localStorage.getItem("smartbet_active_user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        parsed.Balance = newBalance;
        localStorage.setItem("smartbet_active_user", JSON.stringify(parsed));
      }
    } catch {
      // Safe
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        balance,
        bonusBalance,
        accountId,
        userId,
        phoneNumber,
        transactions,
        statement,
        bonuses,
        loading,
        refresh,
        syncBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used inside WalletProvider");
  }
  return ctx;
}
