/**
 * routes/match.$matchId.tsx — MATCH DETAIL page (/match/:matchId).
 * Header banner with fixture info plus the full market list from
 * detailMarkets() (mock extras — replace with provider markets). Every
 * outcome button toggles a bet slip selection. Unknown ids show a fallback.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { matches, detailMarkets, flagFor } from "@/lib/betting-data";
import { useBetSlip } from "@/lib/betslip";
import { BetSlip } from "@/components/bet-slip";

export const Route = createFileRoute("/match/$matchId")({
  head: ({ params }) => {
    const m = matches.find((x) => x.id === params.matchId);
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
  const match = matches.find((m) => m.id === matchId);

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
          <Link to="/" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold opacity-80">
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

        {markets.map((market) => (
          <section
            key={market.id}
            className="overflow-hidden bg-card md:rounded-lg md:border md:border-border"
          >
            <p className="border-b border-border bg-secondary px-3 py-2 text-xs font-bold uppercase tracking-wide text-secondary-foreground">
              {market.name}
            </p>
            <div
              className={`grid gap-2 p-3 ${
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
          </section>
        ))}
      </div>

      <BetSlip />
    </main>
  );
}
