/**
 * routes/my-bets.index.tsx — MY BETS list.
 * Collapsed receipt cards (stake, total odds, potential, status) with an
 * Open/Settled filter. Tapping a receipt opens the detail page at
 * /my-bets/$betId. Data comes from the bet slip context (seeded mock bets).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Receipt } from "lucide-react";
import { useBetSlip } from "@/lib/betslip";
import { formatUgx } from "@/lib/betting-data";

export const Route = createFileRoute("/my-bets/")({
  head: () => ({
    meta: [
      { title: "My bets · SMARTBET" },
      {
        name: "description",
        content: "Track open and settled bets with booking codes, stakes and potential payouts in UGX.",
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
  const { bets } = useBetSlip();
  const [filter, setFilter] = useState<"open" | "settled">("open");

  const visible = bets.filter((b) => (filter === "open" ? b.status === "open" : b.status !== "open"));

  return (
    <main className="mx-auto max-w-3xl px-3 py-4">
      <h1 className="mb-3 font-display text-xl font-bold uppercase tracking-wide">My bets</h1>

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
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${statusStyles[bet.status]}`}
                  >
                    {bet.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {bet.selections.length} selection{bet.selections.length > 1 ? "s" : ""} ·{" "}
                  {bet.placedAt}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-muted-foreground">Total odds</p>
                <p className="text-sm font-bold tabular-nums text-accent">
                  {bet.totalOdds.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-muted-foreground">Stake</p>
                <p className="text-sm font-bold tabular-nums">{formatUgx(bet.stake)}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
