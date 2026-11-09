/**
 * sportsbook/betting.functions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server functions for placing and reading real bets (Phase 3 — sportsbook core).
 *
 * INTEGRATION NOTES:
 * - The browser sends ONLY selection keys (eventId / marketKey / selectionKey)
 *   and the stake. Odds, total odds, payout and balance checks are decided by
 *   the database function `place_bet`, which re-reads prices from the
 *   `sb_selections` catalogue. Never trust client-side odds.
 * - `place_bet` debits the stake through `wallet_transact`, so every bet has a
 *   matching double-entry ledger movement. The stake debit and the bet row are
 *   written in one transaction.
 * - Every placement carries an idempotency key, so a retried request returns the
 *   original bet instead of debiting twice.
 * - TODO(integration): when a live odds provider is wired in, it writes into
 *   sb_events / sb_markets / sb_selections; nothing here changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** One leg as sent by the bet slip — keys only, never prices. */
export type BetPick = {
  eventId: string;
  marketKey: string;
  selectionKey: string;
};

/** A bet leg as stored by the server (prices frozen at placement time). */
export type ServerBetSelection = {
  id: string;
  eventId: string;
  marketKey: string;
  selectionKey: string;
  eventLabel: string;
  marketName: string;
  selectionLabel: string;
  odds: number;
  status: string;
};

/** A placed bet receipt returned to the UI. */
export type ServerBet = {
  id: string;
  code: string;
  stake: number;
  totalOdds: number;
  potentialPayout: number;
  currency: string;
  status: string;
  createdAt: string;
  selections: ServerBetSelection[];
};

const pickSchema = z.object({
  eventId: z.string().min(1),
  marketKey: z.string().min(1),
  selectionKey: z.string().min(1),
});

/**
 * Place a bet for the signed-in user.
 * Returns the stored receipt, re-read from the database after placement.
 */
export const placeBetOnServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        stake: z.number().int().positive(),
        picks: z.array(pickSchema).min(1).max(30),
        // Client-generated so a double submit collapses into one bet.
        idempotencyKey: z.string().min(8).max(120),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: betId, error } = await supabase.rpc("place_bet", {
      _user_id: userId,
      _stake: data.stake,
      _picks: data.picks,
      _idempotency_key: data.idempotencyKey,
    });
    if (error) throw new Error(error.message);

    const bet = await readBet(supabase, String(betId));
    if (!bet) throw new Error("Bet was placed but could not be read back");
    return bet;
  });

/** Recent bets for the signed-in user, newest first. */
export const getMyBets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: bets, error } = await supabase
      .from("bets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    if (!bets?.length) return [] as ServerBet[];

    const { data: legs, error: legError } = await supabase
      .from("bet_selections")
      .select("*")
      .in(
        "bet_id",
        bets.map((b) => b.id),
      );
    if (legError) throw new Error(legError.message);

    return bets.map((b) =>
      mapBet(
        b,
        (legs ?? []).filter((l) => l.bet_id === b.id),
      ),
    );
  });

/* ── Internal helpers ─────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;

function mapLeg(row: Row): ServerBetSelection {
  return {
    id: String(row["id"]),
    eventId: String(row["event_id"]),
    marketKey: String(row["market_key"]),
    selectionKey: String(row["selection_key"]),
    eventLabel: String(row["event_label"]),
    marketName: String(row["market_name"]),
    selectionLabel: String(row["selection_label"]),
    odds: Number(row["odds"]),
    status: String(row["status"]),
  };
}

function mapBet(row: Row, legs: Row[]): ServerBet {
  return {
    id: String(row["id"]),
    code: String(row["code"]),
    stake: Number(row["stake"]),
    totalOdds: Number(row["total_odds"]),
    potentialPayout: Number(row["potential_payout"]),
    currency: String(row["currency"]),
    status: String(row["status"]),
    createdAt: String(row["created_at"]),
    selections: legs.map(mapLeg),
  };
}

/** Read one bet with its legs using the caller's RLS-scoped client. */
async function readBet(
  supabase: { from: (t: string) => Record<string, unknown> },
  betId: string,
): Promise<ServerBet | null> {
  const { data: bet } = await supabase.from("bets").select("*").eq("id", betId).maybeSingle();
  if (!bet) return null;
  const { data: legs } = await supabase.from("bet_selections").select("*").eq("bet_id", betId);
  return mapBet(bet as Row, (legs ?? []) as Row[]);
}
