/**
 * match-card.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Single fixture row used on home, sports, live and search results.
 * Shows kickoff/live badge, teams (+live score), country/league, the main
 * market's odds buttons, and a "+N" link to the full market list.
 * Tapping an odds button toggles a bet slip Selection (see lib/betslip.tsx).
 * Pass `marketId` to render a different market than the match's first one.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { flagFor, type Match } from "@/lib/betting-data";
import { useBetSlip } from "@/lib/betslip";

export function MatchCard({ match, marketId }: { match: Match; marketId?: string }) {
  const { toggle, has } = useBetSlip();
  const main = (marketId && match.markets.find((m) => m.id === marketId)) || match.markets[0];
  if (!main) return null;

  return (
    <article className="group border-b border-border bg-card px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/30">
      <div className="mb-2.5 flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
        {match.live ? (
          <span className="inline-flex items-center gap-1 rounded bg-live px-1.5 py-0.5 text-live-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live-foreground" />
            {match.live.minute}&apos;
          </span>
        ) : (
          <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{match.startsAt}</span>
        )}
          <span className="ml-auto font-medium opacity-80">{main.name}</span>
      </div>

      <Link
        to="/match/$matchId"
        params={{ matchId: match.id }}
        className="flex items-start gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold text-card-foreground">{match.home}</p>
            {match.live && <span className="text-sm font-bold tabular-nums">{match.live.homeScore}</span>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold text-card-foreground">{match.away}</p>
            {match.live && <span className="text-sm font-bold tabular-nums">{match.live.awayScore}</span>}
          </div>
          <p className="mt-1.5 truncate text-[10px] font-medium text-muted-foreground">
            {flagFor(match.country)} {match.country} · {match.league}
          </p>
        </div>
      </Link>


      <div className="mt-3 flex items-stretch gap-2">
        <div
          className={`grid flex-1 gap-2 ${main.outcomes.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
        >
          {main.outcomes.map((o) => {
            const id = `${match.id}-${main.id}-${o.id}`;
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
                    market: main.name,
                    pick: o.label,
                    odds: o.odds,
                  })
                }
                className={`flex h-12 flex-col items-center justify-center rounded-md border text-sm font-bold tabular-nums transition-all ${
                  active
                    ? "border-odds-active bg-odds-active text-odds-active-foreground"
                    : "border-border bg-odds text-odds-foreground hover:border-accent/60 hover:bg-muted"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase opacity-70">{o.label}</span>
                {o.odds.toFixed(2)}
              </button>
            );
          })}
        </div>
        <Link
          to="/match/$matchId"
          params={{ matchId: match.id }}
          className="flex h-12 w-14 items-center justify-center gap-0.5 rounded-md border border-border bg-secondary text-xs font-semibold text-secondary-foreground transition-colors hover:border-accent/60"
        >
          +{match.marketCount}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </article>
  );
}
