/**
 * routes/index.tsx — HOME page.
 * Promotional slideshow banner, top leagues carousel, "Big games" match
 * carousel, "Multiple of the day" combo cards (Add to Betslip pushes all
 * legs into the slip), a football-first sports games list (5 at a time,
 * more via button or scroll), and one row of trending casino/crash games.
 * All content is mock data from lib/betting-data.ts and lib/casino-data.ts.
 */
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Layers,
  Radio,
  Sparkles,
  Volleyball,
  Trophy,
  Users,
} from "lucide-react";
import { casinoGames } from "@/lib/casino-data";
import { flagFor, formatUgx, matches } from "@/lib/betting-data";
import { MatchCard } from "@/components/match-card";
import { BetSlip } from "@/components/bet-slip";
import { useBetSlip } from "@/lib/betslip";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SMARTBET · Sports, casino, aviator and crash in UGX" },
      {
        name: "description",
        content:
          "Featured football odds, top leagues, match combos and the hottest casino, aviator and crash games — all in one place, priced in UGX.",
      },
      { property: "og:title", content: "SMARTBET · Sports, casino, aviator and crash in UGX" },
      {
        property: "og:description",
        content: "Featured odds, top leagues, match combos and hot games in UGX.",
      },
    ],
  }),
  component: HomePage,
});

const banners = [
  {
    id: "b1",
    kicker: "New player offer",
    title: "100% first deposit boost",
    copy: "Top up and double your first stake up to UGX 100,000.",
    cta: "Deposit now",
    to: "/deposit" as const,
    gradient: "linear-gradient(120deg, #031627 0%, #10283D 55%, #0f766e 100%)",
  },
  {
    id: "b2",
    kicker: "Multibet",
    title: "Up to 200% multibet bonus",
    copy: "Add 5 or more selections and grow every winning slip.",
    cta: "Build a slip",
    to: "/sports" as const,
    gradient: "linear-gradient(120deg, #031627 0%, #1e3a8a 60%, #6EDB73 130%)",
  },
  {
    id: "b3",
    kicker: "Aviator",
    title: "Cash out before it flies away",
    copy: "Fly with Aviator and Crash games from UGX 500 a round.",
    cta: "Play Aviator",
    to: "/aviator" as const,
    gradient: "linear-gradient(120deg, #031627 0%, #0e7490 60%, #be123c 130%)",
  },
];

const topLeagues = [
  { name: "Uganda Premier League", country: "Uganda" },
  { name: "Premier League", country: "England" },
  { name: "La Liga", country: "Spain" },
  { name: "Serie A", country: "Italy" },
  { name: "Bundesliga", country: "Germany" },
  { name: "Ligue 1", country: "France" },
  { name: "CAF Champions League", country: "Africa" },
  { name: "NBA", country: "USA" },
];


function useCombos() {
  return [
    {
      id: "combo1",
      name: "Weekend banker",
      picks: matches.filter((m) => m.popular).slice(0, 3),
    },
    {
      id: "combo2",
      name: "Goals galore",
      picks: matches.filter((m) => m.markets.some((k) => k.id === "ou25")).slice(0, 3),
    },
    {
      id: "combo3",
      name: "Uganda special",
      picks: matches.filter((m) => m.country === "Uganda").slice(0, 2),
    },
  ];
}

function BannerSlider() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, []);
  const b = banners[i]!;

  return (
    <section>
      <div
        className="relative flex h-[24vh] flex-col overflow-hidden rounded-lg border border-surface-foreground/10 text-surface-foreground shadow-[var(--shadow-card)]"
        style={{ background: b.gradient }}
      >
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          {b.kicker}
        </p>
        <h2 className="mt-2 max-w-md font-display text-2xl font-bold leading-tight md:text-3xl">
          {b.title}
        </h2>
        <p className="mt-2 max-w-md text-sm opacity-80">{b.copy}</p>
        <Link
          to={b.to}
          className="mt-4 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground"
        >
          {b.cta}
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous banner"
            onClick={() => setI((v) => (v - 1 + banners.length) % banners.length)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-foreground/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            {banners.map((x, idx) => (
              <button
                key={x.id}
                type="button"
                aria-label={`Go to banner ${idx + 1}`}
                onClick={() => setI(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === i ? "w-6 bg-accent" : "w-2 bg-surface-foreground/30"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next banner"
            onClick={() => setI((v) => (v + 1) % banners.length)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-foreground/10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function SectionHead({
  title,
  icon: Icon,
  to,
}: {
  title: string;
  icon: typeof Flame;
  to?: "/sports" | "/live" | "/casino" | "/aviator" | "/crash";
}) {
  return (
    <div className="flex items-center justify-between px-3 md:px-0">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
        <Icon className="h-4 w-4 text-accent" />
        {title}
      </h2>
      {to && (
        <Link to={to} className="text-xs font-semibold text-accent">
          See all
        </Link>
      )}
    </div>
  );
}

const PAGE_SIZE = 5;

function SportsGamesSection() {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sportMatches = [...matches]
    .sort((a, b) => Number(b.sport === "Football") - Number(a.sport === "Football"))
    .sort((a, b) => Number(b.popular) - Number(a.popular));
  const shown = sportMatches.slice(0, visible);
  const hasMore = visible < sportMatches.length;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible((v) => Math.min(v + PAGE_SIZE, sportMatches.length));
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, sportMatches.length]);

  return (
    <div className="space-y-3">
      <SectionHead title="Sports" icon={Volleyball} to="/sports" />
      <section className="overflow-hidden bg-card md:rounded-md md:border md:border-border md:shadow-[var(--shadow-card)]">
        {shown.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </section>
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center px-3 md:px-0">
          <button
            type="button"
            onClick={() => setVisible((v) => Math.min(v + PAGE_SIZE, sportMatches.length))}
            className="h-10 w-full rounded-md border border-border bg-card text-xs font-semibold text-card-foreground transition-colors hover:border-accent/60 hover:text-accent"
          >
            More games
          </button>
        </div>
      )}
    </div>
  );
}

function HomePage() {
  const combos = useCombos();
  const { toggle, has } = useBetSlip();
  const featured = matches.filter((m) => m.popular).slice(0, 4);
  const liveNow = matches.filter((m) => m.live).slice(0, 3);
  const topGames = [...casinoGames].sort((a, b) => b.popularity - a.popularity).slice(0, 8);

  return (
    <main className="relative mx-auto flex w-full max-w-[968px] gap-2 px-0 py-4 md:grid md:h-[calc(100vh-7.5rem)] md:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] md:overflow-hidden md:px-3 md:py-5">
      <div className="no-scrollbar min-w-0 flex-1 space-y-6 md:h-full md:overflow-y-auto md:pb-5 md:pt-0">
        <BannerSlider />


        <div className="space-y-3">
          <SectionHead title="Top leagues" icon={Trophy} to="/sports" />
          <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-3 md:px-0">
            {topLeagues.map((l) => (
              <Link
                key={l.name}
                to="/sports"
                className="flex w-40 shrink-0 flex-col gap-2 rounded-md border border-border bg-card p-3 transition-colors hover:border-accent/60"
              >
                <span className="text-xl leading-none">{flagFor(l.country)}</span>
                <span className="text-xs font-semibold leading-snug text-card-foreground">
                  {l.name}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">{l.country}</span>
              </Link>
            ))}
          </div>
        </div>

        {liveNow.length > 0 && (
          <div className="space-y-3">
            <SectionHead title="Live now" icon={Radio} to="/live" />
            <section className="overflow-hidden bg-card md:rounded-md md:border md:border-border md:shadow-[var(--shadow-card)]">
              {liveNow.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </section>
          </div>
        )}

        <div className="space-y-3">
          <SectionHead title="Big games" icon={Flame} to="/sports" />
          <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 md:px-0">
            {featured.map((m) => {
              const market = m.markets.find((k) => k.id === "1x2") ?? m.markets[0]!;
              const labels = ["W1", "X", "W2"];
              return (
                <div
                  key={m.id}
                  className="w-[19rem] shrink-0 snap-start overflow-hidden rounded-lg border border-border p-3.5 shadow-[var(--shadow-card)]"
                  style={{
                    background:
                      "linear-gradient(150deg, color-mix(in oklab, var(--color-card) 92%, #0b2740) 0%, var(--color-card) 55%, color-mix(in oklab, var(--color-card) 88%, #0b2740) 100%)",
                  }}
                >
                  <Link
                    to="/match/$matchId"
                    params={{ matchId: m.id }}
                    className="flex items-center gap-2 border-b border-border/70 pb-2.5"
                  >
                    <span className="text-base leading-none">⚽</span>
                    <span className="text-sm leading-none">{flagFor(m.country)}</span>
                    <span className="truncate text-xs font-semibold text-muted-foreground">
                      {m.league}
                    </span>
                  </Link>

                  <div className="grid grid-cols-3 items-center gap-2 py-3.5">
                    <p className="truncate text-center text-xs font-bold text-card-foreground">
                      {m.home}
                    </p>
                    <p className="text-center text-[11px] font-semibold leading-tight text-muted-foreground">
                      {m.startsAt}
                    </p>
                    <p className="truncate text-center text-xs font-bold text-card-foreground">
                      {m.away}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {market.outcomes.slice(0, 3).map((o, idx) => {
                      const id = `${m.id}-${market.id}-${o.id}`;
                      const active = has(id);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() =>
                            toggle({
                              id,
                              matchId: m.id,
                              match: `${m.home} v ${m.away}`,
                              market: market.name,
                              pick: o.label,
                              odds: o.odds,
                            })
                          }
                          className={`flex h-12 flex-col items-center justify-center rounded-md text-[10px] font-semibold transition-colors ${
                            active
                              ? "bg-odds-active text-odds-active-foreground"
                              : "bg-odds text-odds-foreground hover:bg-odds-hover"
                          }`}
                        >
                          <span className="opacity-70">{labels[idx] ?? o.label}</span>
                          <span className="text-sm font-bold tabular-nums">
                            {o.odds.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <SectionHead title="Multiple of the day" icon={Layers} />
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-3 md:px-0">
            {combos.map((c) => {
              const legs = c.picks.map((m) => {
                const market = m.markets[0]!;
                const outcome = market.outcomes[0]!;
                return { m, market, outcome };
              });
              const total = legs.reduce((acc, l) => acc * l.outcome.odds, 1);
              const active = legs.every((l) => has(`${l.m.id}-${l.market.id}-${l.outcome.id}`));
              return (
                <div
                  key={c.id}
                  className="relative flex w-[21rem] shrink-0 flex-col overflow-hidden rounded-lg border border-border p-4 shadow-[var(--shadow-card)] md:w-[24rem]"
                  style={{
                    background:
                      "radial-gradient(120% 140% at 85% 0%, color-mix(in oklab, var(--color-card) 78%, #1d4ed8) 0%, var(--color-card) 55%), linear-gradient(160deg, color-mix(in oklab, var(--color-card) 90%, #0b2740) 0%, var(--color-card) 70%)",
                  }}
                >
                  <span className="absolute right-0 top-3 rounded-l-md bg-[#f5b800] px-2 py-0.5 text-[10px] font-bold text-[#031627]">
                    + 7% BONUS
                  </span>
                  <p className="pr-20 font-display text-sm font-semibold text-card-foreground">
                    {c.name}
                  </p>
                  <ul className="mt-3 flex-1 space-y-2.5 border-t border-border/60 pt-3">
                    {legs.map((l) => (
                      <li key={l.m.id} className="flex items-start gap-2">
                        <span className="mt-0.5 text-xs leading-none">⚽</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[11px] font-bold text-card-foreground">
                              {l.m.home} - {l.m.away}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {l.m.startsAt}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[10px] text-muted-foreground">
                              {l.market.name} - {l.outcome.label}
                            </span>
                            <span className="shrink-0 text-[11px] font-bold tabular-nums text-card-foreground">
                              {l.outcome.odds.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {legs.length} events
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Total odds{" "}
                      <span className="text-base font-bold tabular-nums text-[#f5b800]">
                        {total.toFixed(2)}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      legs.forEach((l) =>
                        toggle({
                          id: `${l.m.id}-${l.market.id}-${l.outcome.id}`,
                          matchId: l.m.id,
                          match: `${l.m.home} v ${l.m.away}`,
                          market: l.market.name,
                          pick: l.outcome.label,
                          odds: l.outcome.odds,
                        }),
                      )
                    }
                    className={`mt-3 h-10 rounded-md text-xs font-semibold transition-colors ${
                      active
                        ? "bg-odds-active text-odds-active-foreground"
                        : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {active ? "In slip" : "Add to Betslip"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <SportsGamesSection />

        <div className="space-y-3">
          <SectionHead title="Trending" icon={Sparkles} to="/casino" />
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-3 pb-1 md:px-0">
            {topGames.map((g) => (
              <Link
                key={g.id}
                to={g.category === "casino" ? "/casino" : g.category === "aviator" ? "/aviator" : "/crash"}
                className="group w-40 shrink-0 overflow-hidden rounded-md border border-border bg-card transition-colors hover:border-accent/60"
              >
                <div
                  className="relative flex h-24 items-end p-2.5"
                  style={{ background: g.gradient }}
                >
                  {g.isNew && (
                    <span className="absolute right-2 top-2 rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground">
                      NEW
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded bg-black/35 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                    <Users className="h-2.5 w-2.5" />
                    {g.players.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-semibold text-card-foreground">{g.name}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {g.provider} · min {formatUgx(g.minBet)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>

      <BetSlip />
    </main>
  );
}
