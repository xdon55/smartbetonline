/**
 * hooks/use-wallet.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook reading the global reactive WalletProvider state.
 * Keeps balance, bonus wallet, official statements, and ledger transactions
 * synchronized across the entire application.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useWalletContext } from "@/lib/wallet-context";

export function useWallet() {
  return useWalletContext();
}
