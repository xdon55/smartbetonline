/**
 * betting-data.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CENTRAL MOCK DATA SOURCE for the sportsbook.
 *
 * INTEGRATION NOTES (odds providers):
 * - Replace the exported arrays (`matches`, `sports`, etc.) with data fetched
 *   from your odds/feed provider. Keep the exported TYPE SHAPES identical and
 *   the whole UI keeps working without component changes.
 * - Every screen reads from this module: home, sports, live, match detail,
 *   search, menus and the bet slip.
 * - `formatUgx` is the single currency formatter — reuse it everywhere money
 *   is displayed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** A single selectable price inside a market (e.g. "1" @ 2.05). */
export type Outcome = { id: string; label: string; odds: number };

/** A betting market attached to a match (e.g. 1X2, Total goals 2.5). */
export type Market = {
  id: string;
  name: string;
  outcomes: Outcome[];
};

/** Kickoff buckets used by the "kickoff time" filter on the sports page. */
export type KickoffDay = "today" | "tomorrow" | "day-after" | "this-week";

/**
 * A fixture/event. `live` is optional — when present the event is treated as
 * in-play everywhere (live badge, score, /live page). `markets` holds the
 * prices shown on cards; `marketCount` is the provider's total market count
 * shown on the "+N" button.
 */
export type Match = {
  id: string;
  sport: string;
  league: string;
  country: string;
  home: string;
  away: string;
  startsAt: string;
  day: KickoffDay;
  popular?: boolean;
  live?: { minute: number; homeScore: number; awayScore: number };
  marketCount: number;
  markets: Market[];
};

/* ── Market builder helpers ─────────────────────────────────────────────────
 * Small factories so mock fixtures stay readable. When wiring a real feed,
 * map provider markets into the same { id, name, outcomes[] } shape instead.
 * ──────────────────────────────────────────────────────────────────────── */

/** Classic 1X2 (home/draw/away) market. */
const oneX2 = (h: number, d: number, a: number): Market => ({
  id: "1x2",
  name: "1X2",
  outcomes: [
    { id: "1", label: "1", odds: h },
    { id: "X", label: "X", odds: d },
    { id: "2", label: "2", odds: a },
  ],
});

/** Over/Under 2.5 goals market. */
const goals = (over: number, under: number): Market => ({
  id: "ou25",
  name: "Total goals 2.5",
  outcomes: [
    { id: "over", label: "Over", odds: over },
    { id: "under", label: "Under", odds: under },
  ],
});

/** Both teams to score market. */
const btts = (yes: number, no: number): Market => ({
  id: "btts",
  name: "Both teams to score",
  outcomes: [
    { id: "yes", label: "Yes", odds: yes },
    { id: "no", label: "No", odds: no },
  ],
});

/** Two-way winner market (basketball, tennis, etc.). */
const winner = (h: number, a: number): Market => ({
  id: "ml",
  name: "Winner",
  outcomes: [
    { id: "1", label: "1", odds: h },
    { id: "2", label: "2", odds: a },
  ],
});

/* ── Mock fixtures ──────────────────────────────────────────────────────────
 * TODO(integration): replace with a live odds feed. The UI filters by
 * `sport`, `league`, `country`, `day` and `live` — keep those fields accurate.
 * ──────────────────────────────────────────────────────────────────────── */
export const matches: Match[] = [
  {
    id: "m1",
    sport: "Football",
    league: "Uganda Premier League",
    country: "Uganda",
    home: "Vipers SC",
    away: "KCCA FC",
    startsAt: "Today 18:00",
    day: "today",
    popular: true,
    marketCount: 148,
    markets: [oneX2(2.05, 3.1, 3.6), goals(1.85, 1.9), btts(1.78, 1.95)],
  },
  {
    id: "m2",
    sport: "Football",
    league: "Premier League",
    country: "England",
    home: "Arsenal",
    away: "Liverpool",
    startsAt: "Today 20:30",
    day: "today",
    popular: true,
    live: { minute: 63, homeScore: 1, awayScore: 1 },
    marketCount: 212,
    markets: [oneX2(2.45, 3.4, 2.7), goals(1.62, 2.25), btts(1.55, 2.35)],
  },
  {
    id: "m3",
    sport: "Football",
    league: "La Liga",
    country: "Spain",
    home: "Real Betis",
    away: "Sevilla",
    startsAt: "Tomorrow 22:00",
    day: "tomorrow",
    marketCount: 176,
    markets: [oneX2(2.9, 3.15, 2.4), goals(1.95, 1.8), btts(1.7, 2.05)],
  },
  {
    id: "m4",
    sport: "Football",
    league: "Serie A",
    country: "Italy",
    home: "Inter",
    away: "Napoli",
    startsAt: "Today 19:45",
    day: "today",
    popular: true,
    live: { minute: 28, homeScore: 0, awayScore: 0 },
    marketCount: 190,
    markets: [oneX2(1.95, 3.3, 4.1), goals(2.1, 1.7), btts(1.88, 1.85)],
  },
  {
    id: "m5",
    sport: "Basketball",
    league: "NBA",
    country: "USA",
    home: "Boston Celtics",
    away: "Denver Nuggets",
    startsAt: "Tomorrow 03:30",
    day: "tomorrow",
    marketCount: 94,
    markets: [winner(1.72, 2.1), goals(1.9, 1.9)],
  },
  {
    id: "m6",
    sport: "Tennis",
    league: "ATP Masters",
    country: "France",
    home: "C. Alcaraz",
    away: "J. Sinner",
    startsAt: "Today 16:00",
    day: "today",
    live: { minute: 1, homeScore: 1, awayScore: 0 },
    marketCount: 66,
    markets: [winner(1.95, 1.85)],
  },
  {
    id: "m7",
    sport: "Football",
    league: "CAF Champions League",
    country: "Africa",
    home: "Al Ahly",
    away: "Mamelodi Sundowns",
    startsAt: "Sat 17:00",
    day: "this-week",
    popular: true,
    marketCount: 132,
    markets: [oneX2(2.2, 3.05, 3.3), goals(2.0, 1.75), btts(1.82, 1.9)],
  },
  {
    id: "m8",
    sport: "Football",
    league: "Bundesliga",
    country: "Germany",
    home: "Bayern München",
    away: "RB Leipzig",
    startsAt: "Sun 18:30",
    day: "this-week",
    popular: true,
    marketCount: 168,
    markets: [oneX2(1.55, 4.2, 5.4), goals(1.48, 2.6), btts(1.6, 2.25)],
  },
  {
    id: "m9",
    sport: "Football",
    league: "Uganda Premier League",
    country: "Uganda",
    home: "Express FC",
    away: "SC Villa",
    startsAt: "Wed 16:00",
    day: "day-after",
    marketCount: 121,
    markets: [oneX2(2.4, 3.0, 2.95), goals(2.05, 1.72), btts(1.85, 1.88)],
  },
  {
    id: "m10",
    sport: "Football",
    league: "Premier League",
    country: "England",
    home: "Chelsea",
    away: "Everton",
    startsAt: "Wed 21:00",
    day: "day-after",
    marketCount: 205,
    markets: [oneX2(1.68, 3.8, 4.8), goals(1.7, 2.1), btts(1.75, 2.0)],
  },
  {
    id: "m11",
    sport: "Football",
    league: "Ligue 1",
    country: "France",
    home: "PSG",
    away: "Marseille",
    startsAt: "Tomorrow 21:00",
    day: "tomorrow",
    popular: true,
    marketCount: 184,
    markets: [oneX2(1.45, 4.6, 6.0), goals(1.42, 2.75), btts(1.68, 2.1)],
  },
  {
    id: "m12",
    sport: "Basketball",
    league: "NBA",
    country: "USA",
    home: "LA Lakers",
    away: "Golden State Warriors",
    startsAt: "Wed 04:00",
    day: "day-after",
    marketCount: 88,
    markets: [winner(2.05, 1.78)],
  },
];

/* ── Filter option lists ────────────────────────────────────────────────────
 * Drive the sport/league/market/kickoff dropdowns on the sports page.
 * ──────────────────────────────────────────────────────────────────────── */
export const sports = [
  { id: "football", name: "Football", count: 1284 },
  { id: "basketball", name: "Basketball", count: 212 },
  { id: "tennis", name: "Tennis", count: 176 },
  { id: "cricket", name: "Cricket", count: 48 },
  { id: "rugby", name: "Rugby", count: 31 },
  { id: "volleyball", name: "Volleyball", count: 27 },
  { id: "esports", name: "eSports", count: 64 },
  { id: "boxing", name: "Boxing", count: 12 },
];

/** Kickoff-time filter chips ("All", "Today", ...). */
export const kickoffOptions: { id: KickoffDay | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "day-after", label: "Day after" },
  { id: "this-week", label: "This week" },
];

/** Market filter options — ids must match the market ids used in fixtures. */
export const marketOptions = [
  { id: "1x2", name: "1X2" },
  { id: "ou25", name: "Total goals 2.5" },
  { id: "btts", name: "Both teams to score" },
  { id: "ml", name: "Winner" },
];

/** Country → leagues tree rendered in the left slide-in main menu. */
export const countriesWithLeagues = [
  { country: "Uganda", leagues: ["Uganda Premier League", "Uganda Big League"] },
  { country: "England", leagues: ["Premier League", "Championship", "FA Cup"] },
  { country: "Spain", leagues: ["La Liga", "Copa del Rey"] },
  { country: "Italy", leagues: ["Serie A", "Coppa Italia"] },
  { country: "Germany", leagues: ["Bundesliga", "DFB Pokal"] },
  { country: "France", leagues: ["Ligue 1", "Coupe de France"] },
  { country: "Africa", leagues: ["CAF Champions League", "CAF Confederation Cup"] },
  { country: "USA", leagues: ["NBA", "MLS"] },
];

/** Derived lookup lists (unique leagues / countries present in fixtures). */
export const allLeagues = Array.from(new Set(matches.map((m) => m.league))).sort();
export const allCountries = Array.from(new Set(matches.map((m) => m.country))).sort();

/* ── Country flags ──────────────────────────────────────────────────────────
 * Emoji flags keyed by country name. TODO(integration): swap for flag
 * sprites/SVGs if the design system requires crisp icons.
 * ──────────────────────────────────────────────────────────────────────── */
export const countryFlags: Record<string, string> = {
  Uganda: "🇺🇬",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Spain: "🇪🇸",
  Italy: "🇮🇹",
  Germany: "🇩🇪",
  France: "🇫🇷",
  Africa: "🌍",
  USA: "🇺🇸",
  Kenya: "🇰🇪",
  Tanzania: "🇹🇿",
};

/** Flag lookup with a neutral fallback for unmapped countries. */
export const flagFor = (country: string) => countryFlags[country] ?? "🏳️";

/**
 * Extra mock markets shown on the match detail page (/match/:id).
 * Football gets the full set; other sports only get "Draw no bet" on top of
 * their base markets. Replace with provider market data per event.
 */
export function detailMarkets(match: Match): Market[] {
  const base = match.markets;
  const extras: Market[] = [
    {
      id: "dc",
      name: "Double chance",
      outcomes: [
        { id: "1x", label: "1X", odds: 1.32 },
        { id: "12", label: "12", odds: 1.28 },
        { id: "x2", label: "X2", odds: 1.55 },
      ],
    },
    {
      id: "ou15",
      name: "Total goals 1.5",
      outcomes: [
        { id: "over", label: "Over", odds: 1.28 },
        { id: "under", label: "Under", odds: 3.4 },
      ],
    },
    {
      id: "ou35",
      name: "Total goals 3.5",
      outcomes: [
        { id: "over", label: "Over", odds: 2.9 },
        { id: "under", label: "Under", odds: 1.38 },
      ],
    },
    {
      id: "dnb",
      name: "Draw no bet",
      outcomes: [
        { id: "1", label: match.home, odds: 1.72 },
        { id: "2", label: match.away, odds: 2.05 },
      ],
    },
    {
      id: "ht",
      name: "Half time result",
      outcomes: [
        { id: "1", label: "1", odds: 2.85 },
        { id: "X", label: "X", odds: 2.1 },
        { id: "2", label: "2", odds: 3.9 },
      ],
    },
    {
      id: "cs",
      name: "Correct score",
      outcomes: [
        { id: "1-0", label: "1-0", odds: 6.5 },
        { id: "2-1", label: "2-1", odds: 8.5 },
        { id: "1-1", label: "1-1", odds: 6.0 },
        { id: "0-0", label: "0-0", odds: 9.5 },
        { id: "0-1", label: "0-1", odds: 8.0 },
        { id: "1-2", label: "1-2", odds: 11.0 },
      ],
    },
  ];
  return match.sport === "Football" ? [...base, ...extras] : [...base, extras[3]!];
}

/** Single currency formatter for the whole app — always display money via this. */
export const formatUgx = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(value);
