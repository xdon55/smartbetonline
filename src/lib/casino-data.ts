/**
 * casino-data.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MOCK GAME CATALOGUE for the Casino / Aviator / Crash products.
 *
 * INTEGRATION NOTES (game providers):
 * - Replace `casinoGames` with your game provider catalogue feed. Keep the
 *   `CasinoGame` shape and the GameLobby UI keeps working.
 * - `gradient` is a CSS placeholder thumbnail; swap for real provider art.
 * - `filterAndSortGames` powers the lobby filters/sorting and works on any
 *   array of CasinoGame objects.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Product buckets — one GameLobby page is rendered per category. */
export type CasinoCategory = "casino" | "aviator" | "crash";

/** A playable game entry shown as a card in the lobby. */
export type CasinoGame = {
  id: string;
  name: string;
  provider: string;
  category: CasinoCategory;
  type: string;
  minBet: number; // UGX
  maxWin: number; // UGX
  rtp: number; // return-to-player percentage
  volatility: "Low" | "Medium" | "High";
  players: number; // mock "online now" count
  popularity: number; // 0–100 score driving the default sort + "Hot" badge
  isNew?: boolean;
  jackpot?: number; // UGX, shown when present
  gradient: string; // placeholder CSS art for the card header
};

/** Helper to build the placeholder card gradients. */
const g = (a: string, b: string) => `linear-gradient(135deg, ${a}, ${b})`;

/* ── Mock catalogue ─────────────────────────────────────────────────────────
 * TODO(integration): fetch from the game aggregation provider instead.
 * ──────────────────────────────────────────────────────────────────────── */
export const casinoGames: CasinoGame[] = [
  // Casino (live tables, slots, game shows)
  { id: "c1", name: "Lightning Roulette", provider: "Evolution", category: "casino", type: "Live table", minBet: 1000, maxWin: 250000000, rtp: 97.3, volatility: "Medium", players: 4821, popularity: 98, gradient: g("#7f1d1d", "#031627") },
  { id: "c2", name: "Blackjack VIP", provider: "Evolution", category: "casino", type: "Live table", minBet: 5000, maxWin: 50000000, rtp: 99.2, volatility: "Low", players: 1204, popularity: 88, gradient: g("#064e3b", "#031627") },
  { id: "c3", name: "Sweet Bonanza", provider: "Pragmatic", category: "casino", type: "Slot", minBet: 500, maxWin: 105000000, rtp: 96.5, volatility: "High", players: 3390, popularity: 95, gradient: g("#9d174d", "#4c1d95") },
  { id: "c4", name: "Gates of Olympus", provider: "Pragmatic", category: "casino", type: "Slot", minBet: 500, maxWin: 125000000, rtp: 96.5, volatility: "High", players: 5120, popularity: 99, jackpot: 84500000, gradient: g("#1e3a8a", "#031627") },
  { id: "c5", name: "Baccarat Speed", provider: "Ezugi", category: "casino", type: "Live table", minBet: 2000, maxWin: 40000000, rtp: 98.9, volatility: "Low", players: 780, popularity: 71, gradient: g("#78350f", "#031627") },
  { id: "c6", name: "Book of Kampala", provider: "Smart Studios", category: "casino", type: "Slot", minBet: 300, maxWin: 60000000, rtp: 95.8, volatility: "Medium", players: 640, popularity: 66, isNew: true, gradient: g("#155e75", "#031627") },
  { id: "c7", name: "Mega Wheel", provider: "Pragmatic", category: "casino", type: "Game show", minBet: 1000, maxWin: 30000000, rtp: 96.4, volatility: "Medium", players: 2210, popularity: 84, gradient: g("#7c2d12", "#4c1d95") },
  { id: "c8", name: "Crazy Time", provider: "Evolution", category: "casino", type: "Game show", minBet: 1000, maxWin: 180000000, rtp: 96.1, volatility: "High", players: 6870, popularity: 100, jackpot: 122000000, gradient: g("#6d28d9", "#031627") },

  // Aviator-style crash flight games
  { id: "a1", name: "Aviator", provider: "Spribe", category: "aviator", type: "Crash flight", minBet: 500, maxWin: 100000000, rtp: 97.0, volatility: "High", players: 9120, popularity: 100, gradient: g("#0e7490", "#031627") },
  { id: "a2", name: "Aviator Pro", provider: "Spribe", category: "aviator", type: "Crash flight", minBet: 2000, maxWin: 200000000, rtp: 97.2, volatility: "High", players: 2410, popularity: 87, isNew: true, gradient: g("#1d4ed8", "#031627") },
  { id: "a3", name: "Jet X", provider: "SmartSoft", category: "aviator", type: "Crash flight", minBet: 500, maxWin: 75000000, rtp: 97.0, volatility: "High", players: 3305, popularity: 92, gradient: g("#b91c1c", "#031627") },
  { id: "a4", name: "Sky Chase", provider: "Smart Studios", category: "aviator", type: "Crash flight", minBet: 300, maxWin: 40000000, rtp: 96.3, volatility: "Medium", players: 880, popularity: 62, gradient: g("#0f766e", "#031627") },
  { id: "a5", name: "Balloon", provider: "Smartsoft", category: "aviator", type: "Crash flight", minBet: 500, maxWin: 55000000, rtp: 96.8, volatility: "Medium", players: 1450, popularity: 74, gradient: g("#a16207", "#031627") },

  // Crash & instant games
  { id: "x1", name: "Crash Classic", provider: "Smart Studios", category: "crash", type: "Crash", minBet: 500, maxWin: 90000000, rtp: 97.0, volatility: "High", players: 4102, popularity: 96, gradient: g("#be123c", "#031627") },
  { id: "x2", name: "Rocket Rush", provider: "Turbo Games", category: "crash", type: "Crash", minBet: 1000, maxWin: 120000000, rtp: 96.9, volatility: "High", players: 2870, popularity: 89, gradient: g("#4338ca", "#031627") },
  { id: "x3", name: "Space XY", provider: "BGaming", category: "crash", type: "Crash", minBet: 500, maxWin: 65000000, rtp: 97.0, volatility: "Medium", players: 1980, popularity: 80, gradient: g("#1e293b", "#0f172a") },
  { id: "x4", name: "Goal Crash", provider: "Smart Studios", category: "crash", type: "Crash", minBet: 300, maxWin: 30000000, rtp: 96.2, volatility: "Low", players: 720, popularity: 58, isNew: true, gradient: g("#166534", "#031627") },
  { id: "x5", name: "Plinko X", provider: "Turbo Games", category: "crash", type: "Instant", minBet: 300, maxWin: 45000000, rtp: 97.1, volatility: "Medium", players: 1610, popularity: 77, gradient: g("#c2410c", "#031627") },
  { id: "x6", name: "Mines", provider: "BGaming", category: "crash", type: "Instant", minBet: 300, maxWin: 25000000, rtp: 97.0, volatility: "Medium", players: 2050, popularity: 82, gradient: g("#0369a1", "#031627") },
];

/** Sort options shown in the lobby "Sort by" dropdown. */
export const sortOptions = [
  { id: "popular", label: "Most popular" },
  { id: "players", label: "Players online" },
  { id: "new", label: "Newest" },
  { id: "rtp", label: "Highest RTP" },
  { id: "minbet", label: "Lowest min bet" },
  { id: "az", label: "A–Z" },
] as const;

export type SortId = (typeof sortOptions)[number]["id"];

/**
 * Applies lobby filters (provider, type, volatility, free-text query) and
 * sorting. Pure function — safe to reuse for any game list.
 */
export function filterAndSortGames(
  games: CasinoGame[],
  opts: { provider: string; type: string; volatility: string; query: string; sort: SortId },
) {
  const q = opts.query.trim().toLowerCase();
  const out = games.filter(
    (game) =>
      (opts.provider === "all" || game.provider === opts.provider) &&
      (opts.type === "all" || game.type === opts.type) &&
      (opts.volatility === "all" || game.volatility === opts.volatility) &&
      (q === "" || game.name.toLowerCase().includes(q) || game.provider.toLowerCase().includes(q)),
  );

  // Sort a copy — never mutate the source catalogue.
  const sorted = [...out];
  switch (opts.sort) {
    case "players":
      sorted.sort((a, b) => b.players - a.players);
      break;
    case "new":
      sorted.sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew) || b.popularity - a.popularity);
      break;
    case "rtp":
      sorted.sort((a, b) => b.rtp - a.rtp);
      break;
    case "minbet":
      sorted.sort((a, b) => a.minBet - b.minBet);
      break;
    case "az":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default: // "popular"
      sorted.sort((a, b) => b.popularity - a.popularity);
  }
  return sorted;
}

/** Compact "UGX 1,000" formatter used on game cards (no currency symbol styling). */
export const ugx = (n: number) =>
  `UGX ${new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(n)}`;
