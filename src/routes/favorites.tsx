/**
 * routes/favorites.tsx — MY FAVORITES page (/favorites).
 * Dedicated quick-access hub for logged-in users to manage pinned matches
 * and leagues, watch live score updates on pinned fixtures, and jump straight
 * to league match lists.
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Lock, Radio, Star, Trash2, Trophy } from "lucide-react";
import { BetSlip } from "@/components/bet-slip";
import { MatchCard } from "@/components/match-card";
import { useAuth } from "@/hooks/use-auth";
import { flagFor, matches as fallbackMatches, type Match } from "@/lib/betting-data";
import { normalizeLeagueKey, useFavorites } from "@/lib/favorites";
import { useLiveGames } from "@/hooks/use-live-games";
import { usePrematchGames } from "@/hooks/use-prematch-games";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "My Favorites · SMARTBET" },
      {
        name: "description",
        content: "Quick access to your pinned matches and favorite leagues on SMARTBET.",
      },
      { property: "og:title", content: "My Favorites · SMARTBET" },
      {
        property: "og:description",
        content: "Pinned matches and leagues with real-time odds on SMARTBET.",
      },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const {
    favoriteMatches,
    favoriteLeagues,
    loading: favLoading,
    totalCount,
    removeFavoriteMatch,
    removeFavoriteLeague,
    clearFavorites,
  } = useFavorites();

  const { matches: liveMatches } = useLiveGames();
  const { matches: prematchMatches } = usePrematchGames();

  const [filterMode, setFilterMode] = useState<"all" | "live">("all");
  const [expandedLeagueKeys, setExpandedLeagueKeys] = useState<Record<string, boolean>>({});

  // Combined live-first match lookup map
  const activeMatchMap = useMemo(() => {
    const map = new Map<string, Match>();
    const prematchPool = prematchMatches.length ? prematchMatches : fallbackMatches;
    for (const m of prematchPool) {
      map.set(m.id, m);
    }
    // Live feed overrides prematch snapshot with real-time clock, score & odds
    for (const m of liveMatches) {
      map.set(m.id, m);
    }
    return map;
  }, [liveMatches, prematchMatches]);

  // Group all active matches by canonical league key for pinned league cards
  const matchesByLeagueKey = useMemo(() => {
    const map = new Map<string, { live: Match[]; upcoming: Match[] }>();
    const seen = new Set<string>();

    const pushMatch = (m: Match, isLive: boolean) => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      const key = normalizeLeagueKey(m.league, m.country);
      let entry = map.get(key);
      if (!entry) {
        entry = { live: [], upcoming: [] };
        map.set(key, entry);
      }
      if (isLive) {
        entry.live.push(m);
      } else {
        entry.upcoming.push(m);
      }
    };

    for (const m of liveMatches) pushMatch(m, true);
    const prematchPool = prematchMatches.length ? prematchMatches : fallbackMatches;
    for (const m of prematchPool) pushMatch(m, Boolean(m.live));

    return map;
  }, [liveMatches, prematchMatches]);

  const resolvedPinnedMatches = useMemo(() => {
    const items = favoriteMatches.map((fav) => {
      const liveOrUpcoming = activeMatchMap.get(fav.matchId) ?? null;
      return { fav, resolved: liveOrUpcoming };
    });

    // Live pinned matches first, then active upcoming, then expired/unavailable
    items.sort((a, b) => {
      const aScore = a.resolved?.live ? 2 : a.resolved ? 1 : 0;
      const bScore = b.resolved?.live ? 2 : b.resolved ? 1 : 0;
      return bScore - aScore;
    });

    if (filterMode === "live") {
      return items.filter((item) => Boolean(item.resolved?.live));
    }
    return items;
  }, [favoriteMatches, activeMatchMap, filterMode]);

  const displayedLeagues = useMemo(() => {
    if (filterMode !== "live") return favoriteLeagues;
    return favoriteLeagues.filter((l) => {
      const bucket = matchesByLeagueKey.get(l.key);
      return Boolean(bucket && bucket.live.length > 0);
    });
  }, [favoriteLeagues, matchesByLeagueKey, filterMode]);

  const livePinnedMatchCount = useMemo(
    () => favoriteMatches.filter((f) => Boolean(activeMatchMap.get(f.matchId)?.live)).length,
    [favoriteMatches, activeMatchMap],
  );

  const toggleLeaguePreview = (key: string) => {
    setExpandedLeagueKeys((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  return (
    <main className="relative mx-auto flex w-full max-w-[968px] gap-2 px-0 py-4 md:grid md:h-[calc(100vh-7.5rem)] md:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] md:overflow-hidden md:px-3 md:py-5">
      <div className="no-scrollbar min-w-0 flex-1 space-y-4 md:h-full md:overflow-y-auto md:pb-5 md:pt-0">
        {/* Page Header */}
        <section className="overflow-hidden bg-card md:rounded-md md:border md:border-border md:shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-3">
            <div className="flex items-center gap-2">
              <Star className="h-4.5 w-4.5 fill-accent text-accent" />
              <h1 className="font-display text-base font-bold uppercase tracking-wide text-foreground">
                My Favorites
              </h1>
              {isAuthenticated && (
                <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                  ({totalCount})
                </span>
              )}
            </div>

            {isAuthenticated && totalCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-md border border-border bg-secondary p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={`rounded px-2.5 py-1 transition-colors ${
                      filterMode === "all"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("live")}
                    className={`inline-flex items-center gap-1 rounded px-2.5 py-1 transition-colors ${
                      filterMode === "live"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Radio className="h-3 w-3 text-live" />
                    <span>Live</span>
                    {livePinnedMatchCount > 0 && (
                      <span className="font-mono text-[11px] tabular-nums">
                        ({livePinnedMatchCount})
                      </span>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={clearFavorites}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
                  aria-label="Clear all favorites"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            )}
          </div>

          {/* Auth Gate when logged out */}
          {!authLoading && !isAuthenticated ? (
            <div className="px-4 py-10 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Lock className="h-5 w-5" />
              </div>
              <h2 className="mt-3 font-display text-base font-bold text-foreground">
                Sign in to access My Favorites
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Pin your favorite matches and leagues across Sports and Live betting for one-tap
                access on any visit.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <Link
                  to="/auth"
                  search={{ tab: "login" }}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-5 text-xs font-bold uppercase tracking-wide text-accent-foreground transition-colors hover:bg-accent/90"
                >
                  Login
                </Link>
                <Link
                  to="/auth"
                  search={{ tab: "register" }}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-secondary px-5 text-xs font-bold uppercase tracking-wide text-secondary-foreground transition-colors hover:bg-muted"
                >
                  Sign up
                </Link>
              </div>
            </div>
          ) : favLoading && totalCount === 0 ? (
            <div className="px-4 py-10 text-center text-xs font-semibold text-muted-foreground">
              Loading your pinned matches and leagues...
            </div>
          ) : totalCount === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Star className="h-5 w-5" />
              </div>
              <h2 className="mt-3 font-display text-base font-bold text-foreground">
                No pinned matches or leagues yet
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Tap the star icon on any match card, match detail page, or league header to pin it
                here for quick access.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <Link
                  to="/sports"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-xs font-bold uppercase tracking-wide text-accent-foreground transition-colors hover:bg-accent/90"
                >
                  Browse Sports
                </Link>
                <Link
                  to="/live"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-secondary px-4 text-xs font-bold uppercase tracking-wide text-secondary-foreground transition-colors hover:bg-muted"
                >
                  Live Matches
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Pinned Leagues Section */}
              {displayedLeagues.length > 0 && (
                <section aria-labelledby="fav-leagues-heading" className="bg-card">
                  <div className="flex items-center justify-between bg-muted/40 px-3 py-2">
                    <h2
                      id="fav-leagues-heading"
                      className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wide text-foreground"
                    >
                      <Trophy className="h-3.5 w-3.5 text-accent" />
                      <span>Pinned Leagues</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        ({displayedLeagues.length})
                      </span>
                    </h2>
                  </div>

                  <div className="divide-y divide-border">
                    {displayedLeagues.map((favLeague) => {
                      const bucket = matchesByLeagueKey.get(favLeague.key) ?? {
                        live: [],
                        upcoming: [],
                      };
                      const combined =
                        filterMode === "live" ? bucket.live : [...bucket.live, ...bucket.upcoming];
                      const isExpanded = expandedLeagueKeys[favLeague.key] ?? true;

                      return (
                        <div key={favLeague.key} className="bg-card">
                          <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-muted/20">
                            <button
                              type="button"
                              onClick={() => toggleLeaguePreview(favLeague.key)}
                              aria-expanded={isExpanded}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <ChevronDown
                                className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                                  isExpanded ? "rotate-0" : "-rotate-90"
                                }`}
                              />
                              <span className="text-sm leading-none shrink-0">
                                {flagFor(favLeague.country)}
                              </span>
                              <span className="truncate text-xs font-bold text-foreground">
                                {favLeague.country} · {favLeague.league}
                              </span>
                              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                                {bucket.live.length > 0
                                  ? `${bucket.live.length} live · ${bucket.upcoming.length} upcoming`
                                  : `${bucket.upcoming.length} upcoming`}
                              </span>
                            </button>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Link
                                to="/sports"
                                search={{ league: favLeague.league }}
                                className="inline-flex h-7 items-center gap-0.5 rounded border border-border bg-secondary px-2 text-[11px] font-semibold text-secondary-foreground hover:border-accent/60"
                              >
                                <span>Open</span>
                                <ChevronRight className="h-3 w-3" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => removeFavoriteLeague(favLeague.key)}
                                aria-label={`Unpin ${favLeague.country} ${favLeague.league}`}
                                aria-pressed={true}
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-card text-accent transition-colors hover:border-destructive/50 hover:text-destructive"
                              >
                                <Star className="h-3.5 w-3.5 fill-current" />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div>
                              {combined.length === 0 ? (
                                <p className="px-3 py-3 text-xs text-muted-foreground">
                                  No active fixtures scheduled right now in this league.
                                </p>
                              ) : (
                                <>
                                  {combined.slice(0, 5).map((m) => (
                                    <MatchCard key={m.id} match={m} />
                                  ))}
                                  {combined.length > 5 && (
                                    <div className="flex justify-center border-t border-border/60 bg-muted/10 px-3 py-2">
                                      <Link
                                        to="/sports"
                                        search={{ league: favLeague.league }}
                                        className="text-xs font-bold text-accent hover:underline"
                                      >
                                        View all {combined.length} matches in Sports
                                      </Link>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Pinned Matches Section */}
              {resolvedPinnedMatches.length > 0 && (
                <section aria-labelledby="fav-matches-heading" className="bg-card">
                  <div className="flex items-center justify-between bg-muted/40 px-3 py-2">
                    <h2
                      id="fav-matches-heading"
                      className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wide text-foreground"
                    >
                      <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                      <span>Pinned Matches</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        ({resolvedPinnedMatches.length})
                      </span>
                    </h2>
                  </div>

                  <div>
                    {resolvedPinnedMatches.map(({ fav, resolved }) =>
                      resolved ? (
                        <MatchCard key={fav.matchId} match={resolved} />
                      ) : (
                        <article
                          key={fav.matchId}
                          className="flex items-center justify-between gap-3 border-b border-border bg-card px-3 py-3 last:border-b-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-card-foreground">
                              {fav.home} v {fav.away}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">
                              {flagFor(fav.country)} {fav.country} · {fav.league} · {fav.startsAt}
                            </p>
                            <p className="mt-1 text-[10px] font-semibold text-muted-foreground/80">
                              Match ended or markets unavailable
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFavoriteMatch(fav.matchId)}
                            aria-label={`Unpin ${fav.home} v ${fav.away}`}
                            aria-pressed={true}
                            className="inline-flex h-8 shrink-0 items-center gap-1 rounded border border-border bg-secondary px-2.5 text-xs font-semibold text-secondary-foreground hover:border-destructive/50 hover:text-destructive"
                          >
                            <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                            <span>Unpin</span>
                          </button>
                        </article>
                      ),
                    )}
                  </div>
                </section>
              )}

              {filterMode === "live" &&
                displayedLeagues.length === 0 &&
                resolvedPinnedMatches.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs font-semibold text-muted-foreground">
                      None of your pinned matches or leagues are currently in-play.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFilterMode("all")}
                      className="mt-2 text-xs font-bold text-accent hover:underline"
                    >
                      Show all favorites
                    </button>
                  </div>
                )}
            </div>
          )}
        </section>
      </div>

      <BetSlip />
    </main>
  );
}
