/**
 * routes/my-bets.$betId.tsx — BET RECEIPT detail page (/my-bets/:betId).
 * Shows every leg of one placed bet plus stake/odds/payout summary.
 * Reads from the bet slip context; replace with a bet-by-id API fetch.
 */
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useBetSlip } from "@/lib/betslip";
import { formatUgx } from "@/lib/betting-data";

export const Route = createFileRoute("/my-bets/$betId")({
  head: () => ({
    meta: [
      { title: "Bet receipt · SMARTBET" },
      {
        name: "description",
        content: "Full receipt details for your SMARTBET booking: selections, odds, stake and payout in UGX.",
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
  const bet = bets.find((b) => b.id === betId);

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
              <p className="text-sm font-bold tabular-nums text-accent">{formatUgx(bet.potential)}</p>
            </div>
          </footer>
        </article>
      )}
    </main>
  );
}
