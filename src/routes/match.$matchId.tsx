/**
 * routes/match.$matchId.tsx — MATCH DETAIL page (/match/:matchId).
 * Header banner with fixture info plus the full market list from
 * real SmartBet feeds. Every outcome button toggles a bet slip selection.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { matches as fallbackMatches, detailMarkets, flagFor, type Match } from "@/lib/betting-data";
import { useBetSlip } from "@/lib/betslip";
import { BetSlip } from "@/components/bet-slip";
import { usePrematchGames, getCachedMatchById } from "@/hooks/use-prematch-games";
import { useLiveGames } from "@/hooks/use-live-games";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/match/$matchId")({
  head: ({ params }) => {
    const m = getCachedMatchById(params.matchId);
    const title = m ? `${m.home} v ${m.away} odds · SMARTBET` : "Match odds · SMARTBET";
    const description = m
      ? `All betting markets for ${m.home} v ${m.away} in the ${m.league}. Stake in UGX on SMARTBET.`
      : "Browse all betting markets for this fixture on SMARTBET.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: MatchDetail,
});

function MatchDetail() {
  const { matchId } = Route.useParams();
  const { toggle, has } = useBetSlip();

  const { matches: prematchMatches, loading: loadingPrematch } = usePrematchGames();
  const { matches: liveMatches, loading: loadingLive } = useLiveGames();

  // Find match in prematch feed, live feed, or local fallback
  const match: Match | undefined =
    prematchMatches.find((m) => m.id === matchId) ||
    liveMatches.find((m) => m.id === matchId) ||
    fallbackMatches.find((m) => m.id === matchId);

  const isLoading = (loadingPrematch || loadingLive) && !match;

  if (isLoading) {
    return (
      <main className="mx-auto max-w-md px-3 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" />
        <p className="mt-4 text-sm font-semibold text-muted-foreground">
          Loading fixture markets...
        </p>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="mx-auto max-w-md px-3 py-12 text-center">
        <p className="text-sm font-semibold">This event is no longer available.</p>
        <Link to="/" className="mt-3 inline-block text-sm font-bold text-accent">
          Back to sports
        </Link>
      </main>
    );
  }

  const markets = detailMarkets(match);

  return (
    <main className="relative mx-auto flex w-full max-w-[968px] gap-2 px-0 py-3 md:grid md:h-[calc(100vh-7.5rem)] md:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] md:overflow-hidden md:px-3">
      <div className="no-scrollbar min-w-0 flex-1 space-y-3 md:h-full md:overflow-y-auto md:py-3">
        <section className="brand-gradient px-3 py-4 text-surface-foreground md:rounded-lg">
          <Link
            to="/"
            className="mb-3 inline-flex items-center gap-1 text-xs font-semibold opacity-80"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
            {flagFor(match.country)} {match.country} · {match.league}
          </p>
          <h1 className="mt-1 font-display text-xl font-bold">
            {match.home} v {match.away}
          </h1>
          <p className="mt-1 text-xs opacity-80">
            {match.live ? (
              <span className="font-bold">
                Live {match.live.minute}&apos; · {match.live.homeScore}-{match.live.awayScore}
              </span>
            ) : (
              match.startsAt
            )}
          </p>
        </section>

        <Accordion type="multiple" defaultValue={["main", "goals"]} className="space-y-3">
          {markets.map((market) => {
            const cat =
              market.id === "1x2" || market.id === "dnb" || market.id === "dc"
                ? "Main Markets"
                : market.id.includes("ou") || market.id === "btts"
                  ? "Goals & Scoring"
                  : market.id.includes("h1") || market.id.includes("half")
                    ? "Halves"
                    : "Specials & Other";

            return (
              <AccordionItem
                key={market.id}
                value={market.id}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <AccordionTrigger className="bg-secondary px-3 py-2 text-xs font-bold uppercase tracking-wide text-secondary-foreground hover:no-underline">
                  <span>{market.name}</span>
                  <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                    ({cat})
                  </span>
                </AccordionTrigger>
                <AccordionContent className="p-3">
                  <div
                    className={`grid gap-2 ${
                      market.outcomes.length === 2
                        ? "grid-cols-2"
                        : market.outcomes.length > 3
                          ? "grid-cols-3"
                          : "grid-cols-3"
                    }`}
                  >
                    {market.outcomes.map((o) => {
                      const id = `${match.id}-${market.id}-${o.id}`;
                      const active = has(id);
                      const isLocked = Boolean(o.locked || o.odds <= 0);

                      if (isLocked) {
                        return (
                          <div
                            key={o.id}
                            title="Odds temporarily locked by live bookmaker"
                            className="flex h-12 flex-col items-center justify-center rounded-md border border-border/50 bg-muted/30 text-muted-foreground"
                          >
                            <span className="max-w-full truncate px-1 text-[10px] font-semibold uppercase opacity-70">
                              {o.label}
                            </span>
                            <span className="flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground/80">
                              <span className="text-[10px]">🔒</span> Locked
                            </span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() =>
                            toggle({
                              id,
                              matchId: match.id,
                              match: `${match.home} v ${match.away}`,
                              market: market.name,
                              pick: o.label,
                              odds: o.odds,
                              betCategory: o.betCategory,
                              matchOddId: o.matchOddId,
                              bookMakerId: o.bookMakerId,
                              isLive: Boolean(match.live),
                            })
                          }
                          className={`flex h-12 flex-col items-center justify-center rounded-md text-sm font-bold tabular-nums transition-colors ${
                            active
                              ? "bg-odds-active text-odds-active-foreground"
                              : "bg-odds text-odds-foreground hover:bg-muted"
                          }`}
                        >
                          <span className="max-w-full truncate px-1 text-[10px] font-semibold uppercase opacity-70">
                            {o.label}
                          </span>
                          {o.odds.toFixed(2)}
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      <BetSlip />
    </main>
  );
}
