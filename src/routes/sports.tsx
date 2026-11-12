/**
 * routes/sports.tsx — SPORTS book page.
 * Upcoming / Popular / Live tabs over live and prematch fixtures from
 * SmartBet feeds (https://api-games.smbet.net and wss://socket.smbet.net).
 * Desktop uses a 60/40 grid: scrollable match list left, stationary bet slip right.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Flame, Gift, Ticket, RotateCw } from "lucide-react";
import { matches as fallbackMatches } from "@/lib/betting-data";
import { MatchCard } from "@/components/match-card";
import { BetSlip } from "@/components/bet-slip";
import {
  SportsFilters,
  defaultFilters,
  filterMatches,
  type SportsFilterState,
} from "@/components/sports-filters";
import { usePrematchGames } from "@/hooks/use-prematch-games";
import { useLiveGames } from "@/hooks/use-live-games";

export const Route = createFileRoute("/sports")({
  validateSearch: (search: Record<string, unknown>): { league?: string } => ({
    league: typeof search.league === "string" ? search.league : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sports betting · Today's football odds in UGX | SMARTBET" },
      {
        name: "description",
        content:
          "Browse today's football, basketball and tennis odds on SMARTBET. Build your bet slip and stake in UGX.",
      },
      { property: "og:title", content: "SMARTBET · Today's football odds in UGX" },
      {
        property: "og:description",
        content: "Browse today's odds, build your bet slip and stake in UGX.",
      },
    ],
  }),
  component: Index,
});

const promos = [
  { icon: Gift, title: "100% first deposit boost", copy: "Up to UGX 100,000 on your first top-up" },
  { icon: Flame, title: "Multibet bonus", copy: "Up to 200% extra on 5+ selections" },
  { icon: Ticket, title: "Free bet Fridays", copy: "Stake UGX 5,000, get UGX 2,000 free" },
];

const tabs = [
  { id: "upcoming", label: "Upcoming" },
  { id: "popular", label: "Popular" },
  { id: "live", label: "Live" },
];

function Index() {
  const { league: searchLeague } = Route.useSearch();
  const [tab, setTab] = useState("upcoming");
  const [filters, setFilters] = useState<SportsFilterState>(() => ({
    ...defaultFilters,
    league: searchLeague || "all",
  }));

  const {
    matches: prematchMatches,
    loading: loadingPrematch,
    refresh: refreshPrematch,
  } = usePrematchGames();
  const { matches: liveMatches, loading: loadingLive, refresh: refreshLive } = useLiveGames();

  const allPrematch = prematchMatches.length ? prematchMatches : fallbackMatches;

  const base =
    tab === "live"
      ? liveMatches
      : tab === "popular"
        ? allPrematch.filter((m) => m.popular)
        : allPrematch.filter((m) => !m.live);

  const list = filterMatches(base, filters);
  const loading = tab === "live" ? loadingLive : loadingPrematch;
  // Group matches by league/competition
  type LeagueGroup = {
    key: string;
    league: string;
    country: string;
    matches: typeof list;
  };

  const leagueGroups: LeagueGroup[] = [];
  const leagueMap = new Map<string, LeagueGroup>();

  for (const m of list) {
    const key = `${m.country}___${m.league}`;
    let group = leagueMap.get(key);
    if (!group) {
      group = {
        key,
        league: m.league,
        country: m.country,
        matches: [],
      };
      leagueMap.set(key, group);
      leagueGroups.push(group);
    }
    group.matches.push(m);
  }

  // Manage expanded state for sections: initially show top 5 games per league
  const [expandedLeagues, setExpandedLeagues] = useState<Record<string, boolean>>({});

  const toggleLeagueExpand = (key: string) => {
    setExpandedLeagues((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <main className="relative mx-auto flex w-full max-w-[968px] gap-2 px-0 py-4 md:grid md:h-[calc(100vh-7.5rem)] md:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] md:overflow-hidden md:px-3 md:py-5">
      <div className="no-scrollbar min-w-0 flex-1 space-y-4 md:h-full md:overflow-y-auto md:pb-5 md:pt-0">
        <section className="no-scrollbar flex gap-3 overflow-x-auto px-3 md:px-0">
          {promos.map((p) => (
            <div
              key={p.title}
              className="flex w-64 shrink-0 items-start gap-3 rounded-md border border-surface-foreground/10 brand-gradient p-4 text-surface-foreground shadow-[var(--shadow-card)]"
            >
              <p.icon className="mt-0.5 h-5 w-5 text-accent" />
              <div>
                <p className="font-display text-sm font-semibold">{p.title}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-75">{p.copy}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="overflow-hidden bg-card md:rounded-md md:border md:border-border md:shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-border bg-card px-3">
            <div className="flex flex-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    setExpandedLeagues({});
                  }}
                  className={`relative flex-1 px-3 py-3 font-display text-sm font-semibold transition-colors ${
                    tab === t.id
                      ? "border-b-2 border-accent text-foreground"
                      : "text-secondary-foreground/70 hover:text-foreground"
                  }`}
                >
                  {t.id === "live" && (
                    <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-live align-middle" />
                  )}
                  {t.label}
                  <span className="ml-1 text-[11px] font-mono opacity-60">
                    (
                    {t.id === "live"
                      ? liveMatches.length
                      : t.id === "popular"
                        ? allPrematch.filter((m) => m.popular).length
                        : allPrematch.filter((m) => !m.live).length}
                    )
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={tab === "live" ? refreshLive : refreshPrematch}
              disabled={loading}
              title="Refresh odds"
              aria-label="Refresh odds"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="p-3">
            <SportsFilters value={filters} onChange={setFilters} matchesList={base} />
          </div>

          <div className="border-t border-border">
            {list.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No matches found matching your filters.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {leagueGroups.map((group) => {
                  const isExpanded = Boolean(expandedLeagues[group.key]);
                  const totalGames = group.matches.length;
                  const hasExtra = totalGames > 4;
                  const initialMatches = group.matches.slice(0, 4);
                  const extraMatches = group.matches.slice(4);

                  return (
                    <section key={group.key} className="bg-card">
                      <header className="flex items-center justify-between bg-muted/40 px-3 py-2 text-xs font-bold text-foreground">
                        <div className="flex items-center gap-1.5 truncate">
                          <span>⚽</span>
                          <span className="truncate">
                            {group.country} · {group.league}
                          </span>
                        </div>
                        <span className="ml-2 shrink-0 font-mono text-[11px] text-muted-foreground">
                          ({totalGames})
                        </span>
                      </header>

                      <div>
                        {initialMatches.map((m) => (
                          <MatchCard key={m.id} match={m} marketId={filters.market} />
                        ))}
                      </div>

                      {hasExtra && (
                        <div
                          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                          }`}
                        >
                          <div className="overflow-hidden">
                            {extraMatches.map((m) => (
                              <MatchCard key={m.id} match={m} marketId={filters.market} />
                            ))}
                          </div>
                        </div>
                      )}

                      {hasExtra && (
                        <div className="flex justify-center border-t border-border/60 bg-muted/20 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleLeagueExpand(group.key)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-accent transition-colors hover:text-accent/80 hover:underline"
                          >
                            <span>{isExpanded ? "Show less" : "See all"}</span>
                            <span className="font-mono">({totalGames})</span>
                          </button>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
      <BetSlip />
    </main>
  );
}
