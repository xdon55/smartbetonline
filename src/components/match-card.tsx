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
import { ChevronRight, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { flagFor, filterLiveMarkets, formatLiveClock, type Match } from "@/lib/betting-data";
import { useBetSlip } from "@/lib/betslip";
import { useFavorites } from "@/lib/favorites";

export function MatchCard({ match, marketId }: { match: Match; marketId?: string }) {
  const { toggle, has } = useBetSlip();
  const { isMatchFavorited, toggleFavoriteMatch } = useFavorites();
  const activeMarkets = filterLiveMarkets(match);
  const main =
    (marketId && activeMarkets.find((m) => m.id === marketId)) ||
    activeMarkets.find((m) => m.id === "1x2") ||
    activeMarkets[0];
  if (!main) return null;

  const pinned = isMatchFavorited(match.id);

  return (
    <article className="group border-b border-border bg-card px-3 py-2.5 transition-colors last:border-b-0 hover:bg-muted/30">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-muted-foreground">
        <div className="flex items-center gap-2">
          {match.live ? (
            <span className="inline-flex items-center gap-1 rounded bg-live px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-live-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live-foreground" />
              {formatLiveClock(match.live)}
            </span>
          ) : (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {match.startsAt}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavoriteMatch(match);
          }}
          aria-label={
            pinned
              ? `Unpin ${match.home} v ${match.away} from My Favorites`
              : `Pin ${match.home} v ${match.away} to My Favorites`
          }
          aria-pressed={pinned}
          title={pinned ? "Remove from My Favorites" : "Pin to My Favorites"}
          className={`inline-flex h-6 w-6 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            pinned
              ? "text-accent hover:bg-accent/10"
              : "text-muted-foreground/60 hover:bg-muted hover:text-foreground"
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${pinned ? "fill-current" : ""}`} />
        </button>
      </div>

      <Link to="/match/$matchId" params={{ matchId: match.id }} className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-bold text-card-foreground">{match.home}</p>
            {match.live && (
              <span className="text-xs font-bold tabular-nums text-live">
                {match.live.homeScore}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-bold text-card-foreground">{match.away}</p>
            {match.live && (
              <span className="text-xs font-bold tabular-nums text-live">
                {match.live.awayScore}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">
            {flagFor(match.country)} {match.country} · {match.league}
          </p>
        </div>
      </Link>

      <div className="mt-2 flex items-stretch gap-1.5">
        <div
          className={`grid flex-1 gap-1.5 ${main.outcomes.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
        >
          {main.outcomes.map((o) => {
            const id = `${match.id}-${main.id}-${o.id}`;
            const active = has(id);
            const isLocked = Boolean(o.locked || o.odds <= 0);

            if (isLocked) {
              return (
                <div
                  key={o.id}
                  title="Odds temporarily locked by bookmaker"
                  className="flex h-9 flex-col items-center justify-center rounded border border-border/50 bg-muted/30 px-1 text-muted-foreground"
                >
                  <span className="text-[9px] font-semibold uppercase opacity-70 leading-tight truncate max-w-full">
                    {o.label}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground/80 leading-none">
                    <span className="text-[9px]">🔒</span> Locked
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
                    market: main.name,
                    pick: o.label,
                    odds: o.odds,
                    betCategory: o.betCategory || main.id,
                    line: o.line,
                    matchOddId: o.matchOddId,
                    bookMakerId: o.bookMakerId,
                    isLive: Boolean(match.live),
                  })
                }
                className={`flex h-9 flex-col items-center justify-center rounded border px-1 text-xs font-bold tabular-nums transition-all ${
                  active
                    ? "border-odds-active bg-odds-active text-odds-active-foreground"
                    : "border-border bg-odds text-odds-foreground hover:border-accent/60 hover:bg-muted"
                }`}
              >
                <span className="text-[9px] font-semibold uppercase opacity-70 leading-tight truncate max-w-full">
                  {o.label}
                </span>
                <span className="leading-none">{o.odds.toFixed(2)}</span>
              </button>
            );
          })}
        </div>
        <Link
          to="/match/$matchId"
          params={{ matchId: match.id }}
          className="flex h-9 w-12 items-center justify-center gap-0.5 rounded border border-border bg-secondary text-[11px] font-semibold text-secondary-foreground transition-colors hover:border-accent/60"
        >
          +{match.live ? activeMarkets.length : match.marketCount}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </article>
  );
}
