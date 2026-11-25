/**
 * routes/my-bets.index.tsx — MY BETS list.
 * Displays strictly the authenticated user's bet history returned by
 * GET /api/Online/MyBets with an Open/Settled filter.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Lock, Receipt, RotateCw } from "lucide-react";
import { useBetSlip } from "@/lib/betslip";
import { formatUgx } from "@/lib/betting-data";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

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
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { bets, betsLoading, refreshBets } = useBetSlip();
  const [filter, setFilter] = useState<"open" | "settled">("open");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setRefreshing(true);
    try {
      await refreshBets();
    } finally {
      setRefreshing(false);
    }
  }, [isAuthenticated, refreshBets]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void refreshBets();
    }
  }, [authLoading, isAuthenticated, refreshBets]);

  const isBusy = authLoading || betsLoading || refreshing;
  const visible = bets.filter((b) =>
    filter === "open" ? b.status === "open" : b.status !== "open",
  );

  return (
    <main className="mx-auto max-w-3xl px-3 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold uppercase tracking-wide">My bets</h1>
        {isAuthenticated ? (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isBusy}
            aria-label="Refresh bets"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <RotateCw className={`h-4 w-4 ${isBusy ? "animate-spin" : ""}`} />
          </button>
        ) : null}
      </div>

      {!authLoading && !isAuthenticated ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-10 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Sign in to view your bets</p>
            <p className="text-xs text-muted-foreground">
              Your open tickets and settled bet history appear here once signed in.
            </p>
          </div>
          <Button asChild size="sm" className="bg-accent text-accent-foreground hover:opacity-90">
            <Link to="/auth">Sign in / Register</Link>
          </Button>
        </section>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
            {filters.map((f) => {
              const count = bets.filter((b) =>
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
                    className={`rounded px-1.5 py-0.2 font-mono text-[10px] tabular-nums ${
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

          {isBusy && bets.length === 0 ? (
            <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
              Loading bet history…
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-6 py-12 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-semibold">No {filter} bets</p>
              <p className="text-xs text-muted-foreground">
                Bets you place will appear here from your account history.
              </p>
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
                    <p className="text-[11px] text-muted-foreground">
                      Stake {formatUgx(bet.stake)}
                    </p>
                    <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                      {formatUgx(bet.potential)}
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
