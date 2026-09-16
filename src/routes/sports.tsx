/**
 * routes/sports.tsx — SPORTS book page.
 * Upcoming / Popular / Live tabs over the mock fixtures, with sport, league,
 * market and kickoff-time filters (components/sports-filters.tsx). Desktop
 * uses a 60/40 grid: scrollable match list left, stationary bet slip right.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Flame, Gift, Ticket } from "lucide-react";
import { matches } from "@/lib/betting-data";
import { MatchCard } from "@/components/match-card";
import { BetSlip } from "@/components/bet-slip";
import {
  SportsFilters,
  defaultFilters,
  filterMatches,
  type SportsFilterState,
} from "@/components/sports-filters";

export const Route = createFileRoute("/sports")({
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
  const [tab, setTab] = useState("upcoming");
  const [filters, setFilters] = useState<SportsFilterState>(defaultFilters);

  const base =
    tab === "live"
      ? matches.filter((m) => m.live)
      : tab === "popular"
        ? matches.filter((m) => m.popular)
        : matches.filter((m) => !m.live);

  const list = filterMatches(base, filters);

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
          <div className="flex border-b border-border bg-card px-3">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative flex-1 px-3 py-3 font-display text-sm font-semibold transition-colors ${
                  tab === t.id
                    ? "border-b-2 border-accent text-foreground"
                    : "text-secondary-foreground/70"
                }`}
              >
                {t.id === "live" && (
                  <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-live align-middle" />
                )}
                {t.label}
              </button>
            ))}
          </div>

          <SportsFilters value={filters} onChange={setFilters} showKickoff={tab !== "live"} />

          {list.length ? (
            list.map((m) => <MatchCard key={m.id} match={m} marketId={filters.market} />)
          ) : (
            <p className="bg-card px-3 py-10 text-center text-sm text-muted-foreground">
              No events match these filters.
            </p>
          )}
        </section>
      </div>

      <BetSlip />
    </main>
  );
}
