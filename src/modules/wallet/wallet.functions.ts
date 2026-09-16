/**
 * wallet/wallet.functions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server functions for the player wallet and transaction history.
 *
 * INTEGRATION NOTES:
 * - Money never moves by editing a `balance` column. Every movement creates a
 *   `transactions` row plus two `ledger_entries` rows (debit/credit) inside the
 *   `wallet_transact` database function.
 * - `internalDeposit` and `internalWithdraw` are test/admin operations that credit
 *   or debit the wallet without an external payment provider. They let us prove
 *   the ledger before wiring MTN/Airtel/card integrations.
 * - Real payment deposits will later call the same `wallet_transact` RPC once the
 *   provider webhook confirms funds.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


export type WalletTransaction = {
  id: string;
  type: string;
  status: string;
  direction: string;
  amount: number;
  currency: string;
  reference: string | null;
  // Json metadata is kept simple and serializable for RPC returns.
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
};

function mapTransaction(row: Record<string, unknown>): WalletTransaction {
  const meta = row["metadata"] && typeof row["metadata"] === "object" && !Array.isArray(row["metadata"])
    ? (row["metadata"] as Record<string, unknown>)
    : {};

  const metadata: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
      metadata[k] = v;
    } else {
      metadata[k] = JSON.stringify(v);
    }
  }

  return {
    id: String(row["id"]),
    type: String(row["type"]),
    status: String(row["status"]),
    direction: String(row["direction"]),
    amount: Number(row["amount"]),
    currency: String(row["currency"]),
    reference: row["reference"] == null ? null : String(row["reference"]),
    metadata,
    created_at: String(row["created_at"]),
  };
}




/**
 * Return the derived wallet balance for the signed-in user.
 * Balance is computed from ledger entries so it is always consistent with the
 * audit trail.
 */
export const getWalletBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("wallet_balance", { _user_id: userId });
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  });

/**
 * Paginated transaction history for the signed-in user.
 * Defaults to the most recent 50 rows.
 */
export const getWalletTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { cursor?: string; limit?: number }) =>
      z
        .object({
          cursor: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .parse(input),
  )




  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const limit = data.limit ?? 50;
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);


    if (data.cursor) {
      // Cursor-based pagination using the created_at timestamp of the cursor row.
      const { data: cursorRow } = await supabase
        .from("transactions")
        .select("created_at")
        .eq("id", data.cursor)
        .single();
      if (cursorRow) {
        query = query.lt("created_at", cursorRow.created_at);
      }
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map(mapTransaction);
  });


/**
 * Internal test deposit: credits the wallet without an external provider.
 * Requires the signed-in user to have an active wallet.
 */
export const internalDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        amount: z.number().int().positive(),
        reference: z.string().optional(),
      })
      .parse(input),
  )

  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: txId, error } = await supabase.rpc("wallet_transact", {
      _user_id: userId,
      _type: "internal_deposit",
      _direction: "credit",
      _amount: data.amount,
      _counter_account: "system_cash",
      _idempotency_key: `internal_deposit:${userId}:${data.reference ?? "none"}:${data.amount}`,
      _reference: data.reference ?? `Internal deposit ${new Date().toISOString()}`,
      _metadata: { source: "manual" },
    });
    if (error) throw new Error(error.message);

    return { transactionId: txId as string };
  });

/**
 * Internal test withdrawal: debits the wallet without an external provider.
 * The database function enforces sufficient funds atomically.
 */
export const internalWithdraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        amount: z.number().int().positive(),
        reference: z.string().optional(),
      })
      .parse(input),
  )

  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: txId, error } = await supabase.rpc("wallet_transact", {
      _user_id: userId,
      _type: "internal_withdrawal",
      _direction: "debit",
      _amount: data.amount,
      _counter_account: "system_cash",
      _idempotency_key: `internal_withdrawal:${userId}:${data.reference ?? "none"}:${data.amount}`,
      _reference: data.reference ?? `Internal withdrawal ${new Date().toISOString()}`,
      _metadata: { source: "manual" },
    });
    if (error) throw new Error(error.message);

    return { transactionId: txId as string };
  });
