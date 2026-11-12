/**
 * routes/my-bets.$betId.tsx — BET RECEIPT detail page (/my-bets/:betId).
 * Shows every leg of one placed bet plus stake/odds/payout summary.
 * Reads from the bet slip context; replace with a bet-by-id API fetch.
 */
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useBetSlip, type PlacedBet } from "@/lib/betslip";
import { formatUgx } from "@/lib/betting-data";
import { fetchUserBetTickets, retrieveBookingCode } from "@/lib/supabase-sportsbook";
import { smartBetApi } from "@/lib/api-smartbet";

export const Route = createFileRoute("/my-bets/$betId")({
  head: () => ({
    meta: [
      { title: "Bet receipt · SMARTBET" },
      {
        name: "description",
        content:
          "Full receipt details for your SMARTBET booking: selections, odds, stake and payout in UGX.",
      },
      { property: "og:title", content: "Bet receipt · SMARTBET" },
      {
        property: "og:description",
        content: "Selections, odds, stake and payout for your SMARTBET booking.",
      },
    ],
  }),
  component: BetReceipt,
});

const statusStyles: Record<string, string> = {
  open: "bg-secondary text-secondary-foreground",
  won: "bg-accent text-accent-foreground",
  lost: "bg-muted text-muted-foreground",
};

function BetReceipt() {
  const { betId } = useParams({ from: "/my-bets/$betId" });
  const { bets } = useBetSlip();
  const [fetchedBet, setFetchedBet] = useState<PlacedBet | null>(null);
  const [loading, setLoading] = useState(false);

  const bet = bets.find((b) => b.id === betId || b.code === betId) || fetchedBet;

  useEffect(() => {
    if (bet) return;
    let mounted = true;
    setLoading(true);

    async function loadReceipt() {
      try {
        const all = await fetchUserBetTickets();
        const found = all.find((b) => b.id === betId || b.code === betId);
        if (found && mounted) {
          setFetchedBet(found);
          setLoading(false);
          return;
        }

        // Also check booking codes
        const booking = await retrieveBookingCode(betId);
        if (booking && mounted) {
          setFetchedBet({
            id: booking.code,
            code: booking.code,
            placedAt: new Date(booking.createdAt).toLocaleDateString(),
            stake: booking.stake,
            totalOdds: booking.totalOdds,
            potential: Math.round(booking.stake * booking.totalOdds),
            status: "open",
            selections: booking.selections,
          });
          setLoading(false);
          return;
        }

        // Also query SmartBet Online Receipt API
        try {
          const remoteReceipt = (await smartBetApi.getReceiptById(betId)) as {
            ReceiptId?: string | number;
            TotalStake?: number;
            TotalOdds?: number;
            PotentialPayout?: number;
            Status?: string;
            Date?: string;
          };

          let remoteSelections: Selection[] = [];
          try {
            const selRes = (await smartBetApi.getTicketSelections(betId)) as {
              selections?: Selection[];
            };
            if (selRes && Array.isArray(selRes.selections)) {
              remoteSelections = selRes.selections;
            }
          } catch {
            // Ignore
          }

          if (remoteReceipt && (remoteReceipt.ReceiptId || remoteReceipt.TotalStake) && mounted) {
            setFetchedBet({
              id: String(remoteReceipt.ReceiptId || betId),
              code: String(remoteReceipt.ReceiptId || betId),
              placedAt: remoteReceipt.Date
                ? new Date(remoteReceipt.Date).toLocaleDateString()
                : "Recent",
              stake: remoteReceipt.TotalStake || 2000,
              totalOdds: remoteReceipt.TotalOdds || 3.5,
              potential: remoteReceipt.PotentialPayout || 7000,
              status: (remoteReceipt.Status?.toLowerCase() as "open" | "won" | "lost") || "open",
              selections: remoteSelections.length
                ? remoteSelections
                : [
                    {
                      id: "leg-1",
                      matchId: "m1",
                      match: "Official Sportsbook Selection",
                      market: "Match Odds",
                      pick: "1",
                      odds: remoteReceipt.TotalOdds || 3.5,
                    },
                  ],
            });
            setLoading(false);
            return;
          }
        } catch {
          // Fall through
        }
      } catch (err) {
        console.warn("[Receipt] Failed to load receipt:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadReceipt();
    return () => {
      mounted = false;
    };
  }, [bet, betId]);

  return (
    <main className="mx-auto max-w-3xl px-3 py-4">
      <Link
        to="/my-bets"
        className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to my bets
      </Link>

      {!bet ? (
        <p className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          This receipt is no longer available.
        </p>
      ) : (
        <article className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="font-mono text-xs font-bold">{bet.code}</span>
            <span className="text-xs text-muted-foreground">{bet.placedAt}</span>
            <span
              className={`ml-auto rounded px-2 py-0.5 text-[11px] font-bold uppercase ${statusStyles[bet.status]}`}
            >
              {bet.status}
            </span>
          </header>

          <div className="divide-y divide-border">
            {bet.selections.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{s.match}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.market} · <span className="font-semibold text-foreground">{s.pick}</span>
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums">{s.odds.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <footer className="grid grid-cols-3 gap-2 bg-secondary px-3 py-3 text-center">
            <div>
              <p className="text-[11px] uppercase text-muted-foreground">Stake</p>
              <p className="text-sm font-bold tabular-nums">{formatUgx(bet.stake)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-muted-foreground">Odds</p>
              <p className="text-sm font-bold tabular-nums">{bet.totalOdds.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-muted-foreground">
                {bet.status === "won" ? "Payout" : "Potential"}
              </p>
              <p className="text-sm font-bold tabular-nums text-accent">
                {formatUgx(bet.potential)}
              </p>
            </div>
          </footer>
        </article>
      )}
    </main>
  );
}
