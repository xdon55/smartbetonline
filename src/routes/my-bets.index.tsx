/**
 * routes/my-bets.index.tsx — MY BETS list.
 * Collapsed receipt cards (stake, total odds, potential, status) with an
 * Open/Settled filter. Integrated with SmartBet Online MyBets API:
 * - GET /api/Online/MyBets
 * - Local ticket persistence and Supabase synchronization
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ChevronRight, Receipt, RotateCw } from "lucide-react";
import { useBetSlip, type PlacedBet } from "@/lib/betslip";
import { formatUgx } from "@/lib/betting-data";
import { smartBetApi } from "@/lib/api-smartbet";
import { fetchUserBetTickets } from "@/lib/supabase-sportsbook";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/my-bets/")({
  head: () => ({
    meta: [
      { title: "My bets · SMARTBET" },
      {
        name: "description",
        content:
          "Track open and settled bets with booking codes, stakes and potential payouts in UGX.",
      },
      { property: "og:title", content: "My bets · SMARTBET" },
      {
        property: "og:description",
        content: "Track open and settled bets with booking codes and payouts in UGX.",
      },
    ],
  }),
  component: MyBets,
});

export const statusStyles: Record<string, string> = {
  open: "bg-secondary text-secondary-foreground",
  won: "bg-accent text-accent-foreground",
  lost: "bg-muted text-muted-foreground",
};

const filters = [
  { id: "open", label: "Open" },
  { id: "settled", label: "Settled" },
] as const;

function MyBets() {
  const { bets: localBets } = useBetSlip();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"open" | "settled">("open");
  const [remoteBets, setRemoteBets] = useState<PlacedBet[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRemoteBets = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch tickets from local storage
      let localSaved: PlacedBet[] = [];
      try {
        const raw = localStorage.getItem("smartbet_placed_bets");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) localSaved = parsed;
        }
      } catch {
        // Safe
      }

      // 2. Fetch tickets from Supabase database (transactions & audit_log)
      const supabaseTickets = await fetchUserBetTickets(user?.id);

      // 3. Fetch from SmartBet online API if available
      let serverRows: Array<{
        ReceiptId?: string | number;
        BookingCode?: string;
        Stake?: number;
        Odds?: number;
        Payout?: number;
        Status?: string;
        Date?: string;
        selections?: unknown[];
      }> = [];

      try {
        serverRows = (await smartBetApi.getMyBets()) as typeof serverRows;
      } catch {
        // Safe if offline
      }

      const adaptedMap = new Map<string, PlacedBet>();
      [...localSaved, ...supabaseTickets].forEach((b) => {
        adaptedMap.set(b.id || b.code, b);
      });

      if (Array.isArray(serverRows) && serverRows.length > 0) {
        serverRows.forEach((row) => {
          const id = String(row.ReceiptId || row.BookingCode || Math.random());
          const code = String(row.BookingCode || row.ReceiptId || "SB-REC");
          const existing = adaptedMap.get(id) || adaptedMap.get(code);

          const rawSelections =
            Array.isArray(row.selections) && row.selections.length > 0
              ? (row.selections as Array<Record<string, unknown>>)
              : (existing?.selections as unknown as Array<Record<string, unknown>>) || [];

          const selections = rawSelections.map((leg, idx) => ({
            id: String(leg.id || `leg-${id}-${idx}`),
            matchId: String(leg.matchId || 123456),
            match: String(leg.match || leg.MatchName || `Match #${leg.matchId || 123456}`),
            market: String(leg.market || leg.betCategory || "1X2"),
            pick: String(leg.pick || leg.betOption || "1"),
            odds: Number(leg.odds || leg.odd || 1.8),
          }));

          adaptedMap.set(id, {
            id,
            code,
            placedAt: row.Date
              ? new Date(row.Date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : existing?.placedAt || "Recent",
            stake: row.Stake || existing?.stake || 1000,
            totalOdds: row.Odds || existing?.totalOdds || 2.0,
            potential: row.Payout || existing?.potential || 2000,
            status: (row.Status?.toLowerCase() === "won"
              ? "won"
              : row.Status?.toLowerCase() === "lost"
                ? "lost"
                : "open") as "open" | "won" | "lost",
            selections,
          });
        });
      }

      setRemoteBets(Array.from(adaptedMap.values()));
    } catch (err) {
      console.warn("[MyBets] Failed to load remote tickets:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadRemoteBets();
  }, [loadRemoteBets]);

  const combinedBets = [...localBets];
  // Merge remote bets not already in local
  for (const rb of remoteBets) {
    if (!combinedBets.some((b) => b.code === rb.code || b.id === rb.id)) {
      combinedBets.push(rb);
    }
  }

  const visible = combinedBets.filter((b) =>
    filter === "open" ? b.status === "open" : b.status !== "open",
  );

  return (
    <main className="mx-auto max-w-3xl px-3 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold uppercase tracking-wide">My bets</h1>
        <button
          type="button"
          onClick={loadRemoteBets}
          disabled={loading}
          aria-label="Refresh bets"
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
        {filters.map((f) => {
          const count = combinedBets.filter((b) =>
            f.id === "open" ? b.status === "open" : b.status !== "open",
          ).length;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                filter === f.id
                  ? "bg-odds-active text-odds-active-foreground"
                  : "text-secondary-foreground"
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] font-mono tabular-nums ${
                  filter === f.id
                    ? "bg-black/20 text-odds-active-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-6 py-12 text-center">
          <Receipt className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold">No {filter} bets</p>
          <p className="text-xs text-muted-foreground">Your receipts will show up here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((bet) => (
            <Link
              key={bet.id}
              to="/my-bets/$betId"
              params={{ betId: bet.id }}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 transition-colors hover:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold">{bet.code}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                      statusStyles[bet.status] || statusStyles["open"]
                    }`}
                  >
                    {bet.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {bet.selections.length > 0 ? `${bet.selections.length} selections · ` : ""}
                  {bet.placedAt}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Stake {formatUgx(bet.stake)}</p>
                <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                  {formatUgx(bet.potential)}
                </p>
              </div>

              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
