/**
 * routes/my-bets.index.tsx — MY BETS list.
 * Collapsed receipt cards (stake, total odds, potential, status) with an
 * Open/Settled filter. Integrated with SmartBet Online MyBets API:
 * - GET /api/Online/MyBets
 * - Local ticket persistence and Supabase synchronization
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Receipt, RotateCw } from "lucide-react";
import { useBetSlip, type PlacedBet } from "@/lib/betslip";
import { formatUgx } from "@/lib/betting-data";
import { smartBetApi } from "@/lib/api-smartbet";

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
  const [filter, setFilter] = useState<"open" | "settled">("open");
  const [remoteBets, setRemoteBets] = useState<PlacedBet[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadRemoteBets() {
    setLoading(true);
    try {
      const serverRows = (await smartBetApi.getMyBets()) as Array<{
        ReceiptId?: string | number;
        BookingCode?: string;
        Stake?: number;
        Odds?: number;
        Payout?: number;
        Status?: string;
        Date?: string;
      }>;

      if (Array.isArray(serverRows) && serverRows.length > 0) {
        const adapted: PlacedBet[] = serverRows.map((row) => ({
          id: String(row.ReceiptId || row.BookingCode || Math.random()),
          code: String(row.BookingCode || row.ReceiptId || "SB-REC"),
          placedAt: row.Date || "Recent",
          stake: row.Stake || 1000,
          totalOdds: row.Odds || 2.0,
          potential: row.Payout || 2000,
          status: (row.Status?.toLowerCase() === "won"
            ? "won"
            : row.Status?.toLowerCase() === "lost"
              ? "lost"
              : "open") as "open" | "won" | "lost",
          selections: [],
        }));
        setRemoteBets(adapted);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRemoteBets();
  }, []);

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
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-md py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              filter === f.id
                ? "bg-odds-active text-odds-active-foreground"
                : "text-secondary-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
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
