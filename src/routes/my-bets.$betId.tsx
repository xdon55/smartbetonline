/**
 * routes/my-bets.$betId.tsx — BET RECEIPT detail page (/my-bets/:betId).
 * Shows every leg of one placed bet returned by the SmartBet API.
 */
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  createLiveMatchLookup,
  mapApiBetToPlacedBet,
  mapSelectionLeg,
  useBetSlip,
  type PlacedBet,
  type Selection,
} from "@/lib/betslip";
import { formatLiveClock, formatUgx } from "@/lib/betting-data";
import { smartBetApi } from "@/lib/api-smartbet";
import { useAuth } from "@/hooks/use-auth";
import { useLiveGames } from "@/hooks/use-live-games";

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
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { bets } = useBetSlip();
  const { matches: liveMatches, endedMatches } = useLiveGames();
  const [fetchedBet, setFetchedBet] = useState<PlacedBet | null>(null);
  const [loading, setLoading] = useState(false);

  const findLiveMatch = useMemo(
    () => createLiveMatchLookup([...liveMatches, ...endedMatches]),
    [liveMatches, endedMatches],
  );

  const bet = bets.find((b) => b.id === betId || b.code === betId) || fetchedBet;

  useEffect(() => {
    if (bet || authLoading || !isAuthenticated) return;
    let mounted = true;
    setLoading(true);

    async function loadReceipt() {
      try {
        // 1. Check GET /api/Online/MyBets
        try {
          const rows = await smartBetApi.getMyBets();
          if (Array.isArray(rows)) {
            const mapped = rows
              .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
              .map(mapApiBetToPlacedBet);
            const match = mapped.find((b) => b.id === betId || b.code === betId);
            if (match && mounted) {
              setFetchedBet(match);
              setLoading(false);
              return;
            }
          }
        } catch {
          // Fall through to Receipt endpoints
        }

        // 2. Query SmartBet Online Receipt & Selections APIs
        const remoteReceipt = (await smartBetApi.getReceiptById(betId)) as {
          ReceiptId?: string | number;
          BookingCode?: string;
          TotalStake?: number;
          TotalOdds?: number;
          PotentialPayout?: number;
          Status?: string;
          Date?: string;
        };

        let remoteSelections: Selection[] = [];
        try {
          const selRes = (await smartBetApi.getTicketSelections(betId)) as {
            selections?: Array<Record<string, unknown>>;
          };
          if (selRes && Array.isArray(selRes.selections)) {
            remoteSelections = selRes.selections.map((leg, idx) =>
              mapSelectionLeg(leg, `leg-${betId}-${idx}`),
            );
          }
        } catch {
          // Selections unavailable
        }

        if (remoteReceipt && (remoteReceipt.ReceiptId || remoteReceipt.TotalStake) && mounted) {
          const rawStatus = String(remoteReceipt.Status || "open").toLowerCase();
          setFetchedBet({
            id: String(remoteReceipt.ReceiptId || betId),
            code: String(remoteReceipt.BookingCode || remoteReceipt.ReceiptId || betId),
            placedAt: remoteReceipt.Date
              ? new Date(remoteReceipt.Date).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "",
            stake: Number(remoteReceipt.TotalStake || 0),
            totalOdds: Number(remoteReceipt.TotalOdds || 1),
            potential: Number(remoteReceipt.PotentialPayout || 0),
            status: rawStatus === "won" ? "won" : rawStatus === "lost" ? "lost" : "open",
            selections: remoteSelections,
          });
        }
      } catch {
        // Receipt not found or unauthorized
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadReceipt();
    return () => {
      mounted = false;
    };
  }, [bet, betId, authLoading, isAuthenticated]);

  return (
    <main className="mx-auto max-w-3xl px-3 py-4">
      <Link
        to="/my-bets"
        className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to my bets
      </Link>

      {loading ? (
        <p className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Loading bet receipt…
        </p>
      ) : !bet ? (
        <p className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          This receipt is no longer available.
        </p>
      ) : (
        <article className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="font-mono text-xs font-bold">{bet.code}</span>
            <span className="text-xs text-muted-foreground">{bet.placedAt}</span>
            <span
              className={`ml-auto rounded px-2 py-0.5 text-[11px] font-bold uppercase ${
                statusStyles[bet.status] || statusStyles["open"]
              }`}
            >
              {bet.status}
            </span>
          </header>

          {bet.selections.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No selection details available for this receipt.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {bet.selections.map((s) => {
                const liveMatch = findLiveMatch(s);
                const liveInfo = liveMatch?.live;
                const rawClock = liveInfo ? formatLiveClock(liveInfo) : null;
                const isFinished =
                  rawClock === "FT" || (Boolean(liveInfo) && bet.status !== "open");
                const clockLabel = isFinished ? "FT" : rawClock;

                return (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{s.match}</p>
                      {liveInfo && clockLabel && (
                        <div className="mt-1 flex items-center gap-2">
                          {isFinished ? (
                            <span
                              className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-black dark:bg-zinc-200"
                              aria-label="Full time"
                            >
                              FT
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 rounded bg-live px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-live-foreground"
                              aria-label={`Live ${clockLabel}`}
                            >
                              <span
                                className="h-1.5 w-1.5 animate-pulse rounded-full bg-live-foreground"
                                aria-hidden="true"
                              />
                              {clockLabel}
                            </span>
                          )}
                          <span
                            className={`font-mono text-xs font-bold tabular-nums ${
                              isFinished ? "text-black dark:text-white" : "text-live"
                            }`}
                            aria-label={`${isFinished ? "Final" : "Live"} score ${liveInfo.homeScore} to ${liveInfo.awayScore}`}
                          >
                            {liveInfo.homeScore} - {liveInfo.awayScore}
                          </span>
                        </div>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s.market} · <span className="font-semibold text-foreground">{s.pick}</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums">
                      {s.odds.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

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
