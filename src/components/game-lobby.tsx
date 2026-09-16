/**
 * game-lobby.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable game grid for the Casino / Aviator / Crash pages. Filter by
 * provider/type/volatility, free-text search, and sort — all driven by
 * filterAndSortGames() from lib/casino-data.ts. The "Play" button is a stub
 * that toasts until the game provider launch integration is wired in.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState } from "react";
import { Flame, Search, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import {
  casinoGames,
  filterAndSortGames,
  sortOptions,
  ugx,
  type CasinoCategory,
  type SortId,
} from "@/lib/casino-data";

function uniq(values: string[]) {
  return Array.from(new Set(values)).sort();
}

const selectClass =
  "h-9 rounded-md border border-border bg-card px-2 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring";

export function GameLobby({
  category,
  title,
  tagline,
}: {
  category: CasinoCategory;
  title: string;
  tagline: string;
}) {
  const games = useMemo(() => casinoGames.filter((g) => g.category === category), [category]);
  const [provider, setProvider] = useState("all");
  const [type, setType] = useState("all");
  const [volatility, setVolatility] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortId>("popular");

  const results = useMemo(
    () => filterAndSortGames(games, { provider, type, volatility, query, sort }),
    [games, provider, type, volatility, query, sort],
  );

  const totalPlayers = games.reduce((sum, g) => sum + g.players, 0);
  const reset = () => {
    setProvider("all");
    setType("all");
    setVolatility("all");
    setQuery("");
    setSort("popular");
  };

  return (
    <main className="mx-auto w-full max-w-[968px] px-3 py-3">
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 bg-secondary px-3 py-3 text-secondary-foreground">
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold uppercase tracking-wide">{title}</h1>
            <p className="text-xs opacity-80">{tagline}</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-background/20 px-2.5 py-1 text-[11px] font-bold">
            <Users className="h-3.5 w-3.5" />
            {totalPlayers.toLocaleString()} playing
          </span>
        </div>

        <div className="space-y-2 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games or providers"
              aria-label="Search games"
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <select className={selectClass} aria-label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="all">All providers</option>
              {uniq(games.map((g) => g.provider)).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select className={selectClass} aria-label="Game type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All game types</option>
              {uniq(games.map((g) => g.type)).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select className={selectClass} aria-label="Volatility" value={volatility} onChange={(e) => setVolatility(e.target.value)}>
              <option value="all">Any volatility</option>
              {["Low", "Medium", "High"].map((v) => (
                <option key={v} value={v}>{v} volatility</option>
              ))}
            </select>
            <select className={selectClass} aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortId)}>
              {sortOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{results.length} games</span>
            <button type="button" onClick={reset} className="font-semibold underline underline-offset-2">
              Reset filters
            </button>
          </div>
        </div>

        {results.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No games match these filters.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 lg:grid-cols-4">
            {results.map((game) => (
              <article key={game.id} className="overflow-hidden rounded-lg border border-border bg-background">
                <div
                  className="relative flex h-28 items-end p-2"
                  style={{ background: game.gradient }}
                >
                  <div className="absolute left-2 top-2 flex gap-1">
                    {game.isNew && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-black">
                        <Sparkles className="h-2.5 w-2.5" /> New
                      </span>
                    )}
                    {game.popularity >= 95 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-live px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        <Flame className="h-2.5 w-2.5" /> Hot
                      </span>
                    )}
                  </div>
                  <span className="rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {game.players.toLocaleString()} online
                  </span>
                </div>
                <div className="space-y-1 p-2">
                  <h2 className="truncate text-sm font-bold text-foreground">{game.name}</h2>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {game.provider} · {game.type}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    RTP {game.rtp}% · {game.volatility}
                  </p>
                  <p className="text-[11px] font-semibold text-foreground">Min {ugx(game.minBet)}</p>
                  {game.jackpot && (
                    <p className="text-[11px] font-bold text-live">Jackpot {ugx(game.jackpot)}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => toast.info(`${game.name} launches here once the game provider is connected.`)}
                    className="mt-1 w-full rounded-md bg-odds-active px-2 py-1.5 text-xs font-bold uppercase text-odds-active-foreground"
                  >
                    Play
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
