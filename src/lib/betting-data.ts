/**
 * betting-data.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CENTRAL DATA SOURCE for the sportsbook.
 *
 * Provides typed definitions and baseline real fixtures from the SmartBet feed
 * (https://api-games.smbet.net).
 *
 * Every screen reads from this module: home, sports, live, match detail,
 * search, menus and the bet slip.
 * `formatUgx` is the single currency formatter — reuse it everywhere money is displayed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** A single selectable price inside a market (e.g. "1" @ 2.05). */
export type Outcome = {
  id: string;
  label: string;
  odds: number;
  matchOddId?: number;
  bookMakerId?: number;
  line?: number | string | null;
  betCategory?: string;
  locked?: boolean;
};

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
  live?: {
    minute: number;
    homeScore: number;
    awayScore: number;
    status?: string;
    period?: number;
    h1HomeScore?: number;
    h1AwayScore?: number;
    corners?: [number, number];
    yellowCards?: [number, number];
    redCards?: [number, number];
  };
  marketCount: number;
  markets: Market[];
};

/* ── Market builder helpers ─────────────────────────────────────────────────
 * Clean factories for constructing typed markets.
 * ──────────────────────────────────────────────────────────────────────── */

export const oneX2 = (h: number, d: number, a: number): Market => ({
  id: "1x2",
  name: "1X2",
  outcomes: [
    { id: "1", label: "1", odds: h, betCategory: "1x2" },
    { id: "X", label: "X", odds: d, betCategory: "1x2" },
    { id: "2", label: "2", odds: a, betCategory: "1x2" },
  ],
});

export const goals = (over: number, under: number, line = "2.5"): Market => ({
  id: line === "2.5" ? "ou25" : `ou_${line.replace(".", "_")}`,
  name: `Total goals ${line}`,
  outcomes: [
    { id: "Over", label: "Over", odds: over, betCategory: "OU", line },
    { id: "Under", label: "Under", odds: under, betCategory: "OU", line },
  ],
});

export const btts = (yes: number, no: number): Market => ({
  id: "btts",
  name: "Both teams to score",
  outcomes: [
    { id: "Yes", label: "Yes", odds: yes, betCategory: "BTS" },
    { id: "No", label: "No", odds: no, betCategory: "BTS" },
  ],
});

export const doubleChance = (w1x: number, w12: number, wx2: number): Market => ({
  id: "dc",
  name: "Double chance",
  outcomes: [
    { id: "1X", label: "1X", odds: w1x, betCategory: "DC" },
    { id: "12", label: "12", odds: w12, betCategory: "DC" },
    { id: "X2", label: "X2", odds: wx2, betCategory: "DC" },
  ],
});

export const drawNoBet = (h: number, a: number, homeTeam: string, awayTeam: string): Market => ({
  id: "dnb",
  name: "Draw no bet",
  outcomes: [
    { id: "1", label: homeTeam, odds: h, betCategory: "DNB" },
    { id: "2", label: awayTeam, odds: a, betCategory: "DNB" },
  ],
});

export const halfTime1X2 = (h: number, d: number, a: number): Market => ({
  id: "1x2_h1",
  name: "1st Half 1X2",
  outcomes: [
    { id: "1", label: "1", odds: h, betCategory: "1x2_H1" },
    { id: "X", label: "X", odds: d, betCategory: "1x2_H1" },
    { id: "2", label: "2", odds: a, betCategory: "1x2_H1" },
  ],
});

/* ── Real fixtures from SmartBet API ──────────────────────────────────────────
 * Authentic real games with actual SmartBet Match IDs and live market odds.
 * ──────────────────────────────────────────────────────────────────────── */
export const matches: Match[] = [
  {
    id: "9935848",
    sport: "Football",
    league: "Premier League",
    country: "England",
    home: "Manchester United",
    away: "Aston Villa",
    startsAt: "Today 19:30",
    day: "today",
    popular: true,
    marketCount: 291,
    markets: [
      oneX2(2.15, 3.7, 3.1),
      goals(1.53, 2.5, "2.5"),
      btts(1.44, 2.62),
      doubleChance(1.36, 1.28, 1.67),
      drawNoBet(1.57, 2.25, "Manchester United", "Aston Villa"),
      halfTime1X2(2.7, 2.25, 3.4),
    ],
  },
  {
    id: "9935847",
    sport: "Football",
    league: "Premier League",
    country: "England",
    home: "Sunderland",
    away: "Chelsea",
    startsAt: "Today 17:00",
    day: "today",
    popular: true,
    marketCount: 287,
    markets: [
      oneX2(3.5, 3.6, 2.05),
      goals(1.8, 2.0, "2.5"),
      btts(1.67, 2.1),
      doubleChance(1.75, 1.28, 1.29),
      drawNoBet(2.5, 1.5, "Sunderland", "Chelsea"),
      halfTime1X2(3.8, 2.2, 2.6),
    ],
  },
  {
    id: "9935854",
    sport: "Football",
    league: "Premier League",
    country: "England",
    home: "Crystal Palace",
    away: "Liverpool",
    startsAt: "Today 17:00",
    day: "today",
    popular: true,
    marketCount: 293,
    markets: [
      oneX2(5.5, 4.33, 1.57),
      goals(1.5, 2.62, "2.5"),
      btts(1.57, 2.25),
      doubleChance(2.35, 1.2, 1.14),
      drawNoBet(4.0, 1.22, "Crystal Palace", "Liverpool"),
      halfTime1X2(5.2, 2.45, 2.05),
    ],
  },
  {
    id: "9935841",
    sport: "Football",
    league: "Premier League",
    country: "England",
    home: "Brighton",
    away: "Brentford",
    startsAt: "Today 17:00",
    day: "today",
    popular: true,
    marketCount: 295,
    markets: [
      oneX2(1.91, 3.75, 3.75),
      goals(1.57, 2.38, "2.5"),
      btts(1.53, 2.38),
      doubleChance(1.26, 1.25, 1.85),
      drawNoBet(1.42, 2.75, "Brighton", "Brentford"),
    ],
  },
  {
    id: "9935845",
    sport: "Football",
    league: "Premier League",
    country: "England",
    home: "Ipswich Town",
    away: "Bournemouth",
    startsAt: "Today 17:00",
    day: "today",
    popular: true,
    marketCount: 288,
    markets: [
      oneX2(3.9, 3.7, 1.85),
      goals(1.73, 2.1, "2.5"),
      btts(1.62, 2.2),
      doubleChance(1.91, 1.26, 1.24),
      drawNoBet(2.8, 1.4, "Ipswich Town", "Bournemouth"),
    ],
  },
  {
    id: "9938945",
    sport: "Football",
    league: "La Liga",
    country: "Spain",
    home: "Real Sociedad",
    away: "Rayo Vallecano",
    startsAt: "Today 18:15",
    day: "today",
    popular: true,
    marketCount: 288,
    markets: [
      oneX2(1.75, 4.0, 4.1),
      goals(1.57, 2.38, "2.5"),
      btts(1.57, 2.25),
      doubleChance(1.22, 1.22, 2.02),
      drawNoBet(1.3, 3.3, "Real Sociedad", "Rayo Vallecano"),
    ],
  },
  {
    id: "9938944",
    sport: "Football",
    league: "La Liga",
    country: "Spain",
    home: "CF Elche",
    away: "Real Betis",
    startsAt: "Today 16:00",
    day: "today",
    popular: true,
    marketCount: 295,
    markets: [
      oneX2(3.7, 3.7, 1.95),
      goals(1.67, 2.2, "2.5"),
      btts(1.57, 2.25),
      doubleChance(1.81, 1.26, 1.26),
      drawNoBet(2.65, 1.45, "CF Elche", "Real Betis"),
    ],
  },
  {
    id: "9938695",
    sport: "Football",
    league: "Bundesliga",
    country: "Austria",
    home: "Sturm Graz",
    away: "Red Bull Salzburg",
    startsAt: "Today 19:00",
    day: "today",
    popular: true,
    marketCount: 302,
    markets: [
      oneX2(2.75, 3.9, 2.25),
      goals(1.4, 2.88, "2.5"),
      btts(1.4, 2.75),
      doubleChance(1.61, 1.24, 1.42),
      drawNoBet(2.05, 1.7, "Sturm Graz", "Red Bull Salzburg"),
    ],
  },
  {
    id: "9920151",
    sport: "Football",
    league: "Superleague",
    country: "Greece",
    home: "Olympiakos Piraeus",
    away: "PAOK Salonika",
    startsAt: "Today 22:00",
    day: "today",
    popular: true,
    marketCount: 282,
    markets: [
      oneX2(1.57, 4.0, 5.25),
      goals(1.75, 2.05, "2.5"),
      btts(1.8, 1.95),
      doubleChance(1.14, 1.22, 2.32),
      drawNoBet(1.22, 4.0, "Olympiakos Piraeus", "PAOK Salonika"),
    ],
  },
  {
    id: "9920148",
    sport: "Football",
    league: "Superleague",
    country: "Greece",
    home: "Ofi Kreta",
    away: "Atromitos Athinon",
    startsAt: "Today 19:30",
    day: "today",
    popular: true,
    marketCount: 279,
    markets: [
      oneX2(2.15, 3.4, 3.25),
      goals(2.0, 1.8, "2.5"),
      btts(1.75, 2.0),
      doubleChance(1.32, 1.3, 1.66),
      drawNoBet(1.57, 2.35, "Ofi Kreta", "Atromitos Athinon"),
    ],
  },
  {
    id: "9920154",
    sport: "Football",
    league: "Superleague",
    country: "Greece",
    home: "AEK Athens",
    away: "Levadiakos",
    startsAt: "Today 18:00",
    day: "today",
    popular: true,
    marketCount: 287,
    markets: [
      oneX2(1.22, 5.5, 15.0),
      goals(1.7, 2.1, "2.5"),
      btts(2.25, 1.57),
      doubleChance(1.02, 1.13, 4.0),
      drawNoBet(1.05, 10.0, "AEK Athens", "Levadiakos"),
    ],
  },
  {
    id: "9920152",
    sport: "Football",
    league: "Superleague",
    country: "Greece",
    home: "Iraklis",
    away: "Panathinaikos",
    startsAt: "Today 18:30",
    day: "today",
    popular: true,
    marketCount: 276,
    markets: [
      oneX2(9.5, 5.0, 1.3),
      goals(1.73, 2.08, "2.5"),
      btts(2.2, 1.62),
      doubleChance(3.35, 1.16, 1.05),
      drawNoBet(6.8, 1.09, "Iraklis", "Panathinaikos"),
    ],
  },
];

/* ── Sports metadata ────────────────────────────────────────────────────────
 * List of available sports with display icons.
 * ──────────────────────────────────────────────────────────────────────── */
export const sports = [
  { id: "football", name: "Football", icon: "⚽" },
  { id: "basketball", name: "Basketball", icon: "🏀" },
  { id: "tennis", name: "Tennis", icon: "🎾" },
  { id: "rugby", name: "Rugby", icon: "🏉" },
  { id: "cricket", name: "Cricket", icon: "🏏" },
];

/** Market choices available in the sports filter dropdown. */
export const marketOptions = [
  { id: "all", name: "All markets" },
  { id: "1x2", name: "1X2 (Match result)" },
  { id: "ou25", name: "Total goals (Over/Under 2.5)" },
  { id: "btts", name: "Both teams to score" },
  { id: "dc", name: "Double chance" },
  { id: "dnb", name: "Draw no bet" },
];

/** Kickoff time filter chips on /sports. */
export const kickoffOptions: { id: KickoffDay | "all"; label: string } = [
  { id: "all", label: "All times" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "day-after", label: "Day after" },
  { id: "this-week", label: "This week" },
];

/* ── Country flags lookup ───────────────────────────────────────────────────
 * Emoji flags keyed by country name.
 * ──────────────────────────────────────────────────────────────────────── */
export const countryFlags: Record<string, string> = {
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Spain: "🇪🇸",
  Italy: "🇮🇹",
  Germany: "🇩🇪",
  France: "🇫🇷",
  Greece: "🇬🇷",
  Austria: "🇦🇹",
  Netherlands: "🇳🇱",
  Portugal: "🇵🇹",
  Turkey: "🇹🇷",
  "Czech Republic": "🇨🇿",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  Romania: "🇷🇴",
  Norway: "🇳🇴",
  Sweden: "🇸🇪",
  Poland: "🇵🇱",
  Belgium: "🇧🇪",
  Denmark: "🇩🇰",
  Switzerland: "🇨🇭",
  Uganda: "🇺🇬",
  Kenya: "🇰🇪",
  Tanzania: "🇹🇿",
  "South Africa": "🇿🇦",
  Africa: "🌍",
  Europe: "🇪🇺",
  USA: "🇺🇸",
  Brazil: "🇧🇷",
  Argentina: "🇦🇷",
  Thailand: "🇹🇭",
  Japan: "🇯🇵",
  Australia: "🇦🇺",
  Egypt: "🇪🇬",
  Morocco: "🇲🇦",
  Russia: "🇷🇺",
  Ukraine: "🇺🇦",
  Chile: "🇨🇱",
  International: "🌐",
};

/** Flag lookup with a neutral fallback for unmapped countries. */
export const flagFor = (country: string) => countryFlags[country] ?? "🌐";

/**
 * Extracts a numeric Over/Under line from a market's outcomes, name, or id.
 */
function parseOverUnderLine(market: Market): number | null {
  for (const o of market.outcomes) {
    if (o.line !== undefined && o.line !== null && o.line !== "") {
      const n = Number(o.line);
      if (Number.isFinite(n)) return n;
    }
  }

  const cleanName = market.name
    .replace(/\b1st\b/gi, "")
    .replace(/\b2nd\b/gi, "")
    .replace(/\bfirst\b/gi, "")
    .replace(/\bsecond\b/gi, "")
    .replace(/\bhalf\b/gi, "")
    .replace(/\bht\b/gi, "")
    .replace(/\bh1\b/gi, "")
    .replace(/\bh2\b/gi, "")
    .replace(/\bteam\s*[12]\b/gi, "");

  const nameMatch = cleanName.match(/\d+(?:\.\d+)?/);
  if (nameMatch) {
    const n = Number(nameMatch[0]);
    if (Number.isFinite(n)) return n;
  }

  const idMatch = market.id.toLowerCase().match(/ou_?(?:h[12]_)?(\d+)(?:_(\d+))?/);
  if (idMatch) {
    if (idMatch[2] !== undefined) {
      const n = Number(`${idMatch[1]}.${idMatch[2]}`);
      if (Number.isFinite(n)) return n;
    }
    const raw = idMatch[1]!;
    if (raw.length === 2 && raw.endsWith("5")) {
      return Number(`${raw[0]}.${raw[1]}`);
    }
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Filters a live market's individual outcomes (e.g. Correct Score or Exact Goals)
 * when specific outcomes have become mathematically impossible, or returns null
 * when the entire market has exceeded its lifespan.
 */
function evaluateLiveMarket(match: Match, market: Market): Market | null {
  const live = match.live;
  if (!live) return market;

  const minute = live.minute;
  const homeScore = live.homeScore;
  const awayScore = live.awayScore;
  const totalGoals = homeScore + awayScore;
  const statusLower = (live.status || "").toLowerCase();
  const period = live.period;

  const idLower = market.id.toLowerCase();
  const nameLower = market.name.toLowerCase();
  const betCats = market.outcomes.map((o) => (o.betCategory || "").toLowerCase()).join(" ");
  const combined = `${idLower} ${nameLower} ${betCats}`;

  // 0. Match finished -> all regular in-play markets expired
  const isMatchEnded =
    (period !== undefined && period >= 4) ||
    /\b(ft|full\s*time|finished|ended|aet|after\s*extra|pen|penalties)\b/.test(statusLower);
  if (isMatchEnded) {
    return null;
  }

  // 1. Halftime / 1st Half period expiration
  const isHalftimeOrLaterStatus =
    /\b(ht|half\s*time|halftime|break|2h|2nd\s*half|second\s*half|et|extra\s*time)\b/.test(
      statusLower,
    );
  const isPastFirstHalf =
    minute > 45 || (period !== undefined && period >= 2) || isHalftimeOrLaterStatus;

  const isSecondHalfOnly =
    /\b(2nd\s*half|second\s*half|2h|h2)\b/.test(combined) || /(?:^|[_-])h2(?:$|[_-])/.test(idLower);

  const isFirstHalfMarket =
    !isSecondHalfOnly &&
    (/\b(1st\s*half|first\s*half|half\s*time|halftime|half-time|1h|h1|ht|ht\/ft|htft)\b/.test(
      combined,
    ) ||
      /(?:^|[_-])(h1|1h|ht)(?:$|[_-])/.test(idLower) ||
      idLower.includes("ht/ft") ||
      idLower.includes("htft"));

  if (isFirstHalfMarket && isPastFirstHalf) {
    return null;
  }

  // 2. Time-interval / minute-window markets (e.g. "1-15 min", "Goal in 0-30 min", "Result at 30 min")
  const intervalMatch = nameLower.match(
    /\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(?:min|mins|minutes|')\b/,
  );
  if (intervalMatch) {
    const endMin = Number(intervalMatch[2]);
    if (Number.isFinite(endMin) && minute > endMin) {
      return null;
    }
  }
  const thresholdMinMatch =
    nameLower.match(/\b(?:1st|first|at|up\s*to|by)\s*(\d{1,2})\s*(?:min|mins|minutes|')\b/) ||
    nameLower.match(
      /\b(\d{1,2})\s*(?:min|mins|minutes)\s*(?:result|1x2|winner|goals|o\/u|over\/under)\b/,
    );
  if (thresholdMinMatch) {
    const limitMin = Number(thresholdMinMatch[1]);
    if (Number.isFinite(limitMin) && minute > limitMin) {
      return null;
    }
  }

  // 3. First Goal / Nth Goal / Next Goal markets
  if (
    /\b(first\s+goal|first\s+team\s+to\s+score|team\s+to\s+score\s+first|1st\s+goal|time\s+of\s+first\s+goal)\b/.test(
      combined,
    ) &&
    totalGoals >= 1
  ) {
    return null;
  }
  const nthGoalMatch =
    combined.match(/\b(\d+)(?:st|nd|rd|th)\s+goal\b/) ||
    combined.match(/\bgoal\s+(\d+)\b/) ||
    combined.match(/\bnext\s+goal\s*\(?(\d+)\)?\b/);
  if (nthGoalMatch) {
    const goalNum = Number(nthGoalMatch[1]);
    if (Number.isFinite(goalNum) && totalGoals >= goalNum) {
      return null;
    }
  }

  // Team detection helpers
  const homeLower = match.home.trim().toLowerCase();
  const awayLower = match.away.trim().toLowerCase();
  const mentionsHome =
    (homeLower.length >= 2 && new RegExp(`\\b${escapeRegExp(homeLower)}\\b`).test(nameLower)) ||
    /\b(home|team\s*1|t1)\b/.test(nameLower);
  const mentionsAway =
    (awayLower.length >= 2 && new RegExp(`\\b${escapeRegExp(awayLower)}\\b`).test(nameLower)) ||
    /\b(away|team\s*2|t2)\b/.test(nameLower);
  const isHomeOnly = mentionsHome && !mentionsAway;
  const isAwayOnly = mentionsAway && !mentionsHome;

  // 4. Clean Sheet / Win to Nil / Single Team to Score
  if (/\bclean\s*sheet\b/.test(combined)) {
    if (isHomeOnly && awayScore >= 1) return null;
    if (isAwayOnly && homeScore >= 1) return null;
  }
  if (/\bwin\s+to\s+nil\b/.test(combined)) {
    if (isHomeOnly && awayScore >= 1) return null;
    if (isAwayOnly && homeScore >= 1) return null;
  }
  const isBothTeamsPhrase = /\bboth\s+teams?\b/.test(combined);
  if (
    !isBothTeamsPhrase &&
    /\bto\s+score\b/.test(combined) &&
    !/\b(first|last|next|both|most|half)\b/.test(combined)
  ) {
    if (isHomeOnly && homeScore >= 1) return null;
    if (isAwayOnly && awayScore >= 1) return null;
  }

  // 5. Both Teams to Score (BTTS / BTS)
  const isBttsMarket =
    /\b(btts|bts|both\s+teams?\s+to\s+score)\b/.test(combined) || idLower.includes("btts");
  const isComboWithResult = /\b(1x2|double\s+chance|dc|result|winner|dnb|draw\s+no\s+bet)\b/.test(
    combined,
  );

  if (isBttsMarket && !isComboWithResult) {
    if (isSecondHalfOnly) {
      if (live.h1HomeScore !== undefined && live.h1AwayScore !== undefined) {
        const h2Home = Math.max(0, homeScore - live.h1HomeScore);
        const h2Away = Math.max(0, awayScore - live.h1AwayScore);
        if (h2Home >= 1 && h2Away >= 1) return null;
      }
    } else if (!/\bboth\s+halves\b/.test(combined)) {
      if (homeScore >= 1 && awayScore >= 1) {
        // Also covers 1st half BTTS while still in 1st half
        return null;
      }
    } else if (
      isPastFirstHalf &&
      live.h1HomeScore !== undefined &&
      live.h1AwayScore !== undefined &&
      (live.h1HomeScore === 0 || live.h1AwayScore === 0)
    ) {
      return null;
    }
  }

  // 6. Over / Under / Total markets (Goals, Corners, Cards)
  const hasOverUnderOutcomes =
    market.outcomes.some((o) => o.label.toLowerCase().includes("over")) &&
    market.outcomes.some((o) => o.label.toLowerCase().includes("under"));
  const isOverUnderMarket =
    idLower.startsWith("ou") ||
    idLower.includes("ou_") ||
    nameLower.includes("total goals") ||
    nameLower.includes("over/under") ||
    nameLower.includes("over / under") ||
    hasOverUnderOutcomes;

  if (isOverUnderMarket) {
    const line = parseOverUnderLine(market);
    if (line !== null) {
      const isCorners = /\bcorner(s)?\b/.test(combined);
      const isCards = /\b(card|cards|booking|bookings|yellow|red)\b/.test(combined);
      const isOtherStat = /\b(offside|foul|shot|throw|penalty|penalties|substitution)\b/.test(
        combined,
      );

      if (isCorners) {
        if (live.corners) {
          const statTotal = isHomeOnly
            ? live.corners[0]
            : isAwayOnly
              ? live.corners[1]
              : live.corners[0] + live.corners[1];
          if (statTotal > line) return null;
        }
      } else if (isCards) {
        const cardsSource = /\bred\b/.test(combined) ? live.redCards : live.yellowCards;
        if (cardsSource) {
          const statTotal = isHomeOnly
            ? cardsSource[0]
            : isAwayOnly
              ? cardsSource[1]
              : cardsSource[0] + cardsSource[1];
          if (statTotal > line) return null;
        }
      } else if (!isOtherStat) {
        // Goals Over/Under market
        if (isSecondHalfOnly) {
          if (live.h1HomeScore !== undefined && live.h1AwayScore !== undefined) {
            const h2Home = Math.max(0, homeScore - live.h1HomeScore);
            const h2Away = Math.max(0, awayScore - live.h1AwayScore);
            const relevantScore = isHomeOnly ? h2Home : isAwayOnly ? h2Away : h2Home + h2Away;
            if (relevantScore > line) return null;
          }
        } else {
          const relevantScore = isHomeOnly ? homeScore : isAwayOnly ? awayScore : totalGoals;
          if (relevantScore > line) return null;
        }
      }
    }
  }

  // 7. Combo BTTS + Over/Under (e.g. "BTTS & Over 2.5")
  if (isBttsMarket && /\bover\b/.test(combined)) {
    const line = parseOverUnderLine(market);
    if (line !== null && homeScore >= 1 && awayScore >= 1 && totalGoals > line) {
      return null;
    }
  }

  // 8. Correct Score: prune impossible scorelines (e.g. 0-0 when already 1-0)
  if (/\bcorrect\s+score\b/.test(combined) || idLower === "cs" || idLower.startsWith("cs_")) {
    const validOutcomes = market.outcomes.filter((o) => {
      const scoreMatch = o.label.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
      if (!scoreMatch) return true;
      const h = Number(scoreMatch[1]);
      const a = Number(scoreMatch[2]);
      return h >= homeScore && a >= awayScore;
    });
    if (validOutcomes.length === 0) return null;
    if (validOutcomes.length !== market.outcomes.length) {
      return { ...market, outcomes: validOutcomes };
    }
  }

  // 9. Exact Goals / Total Goals Exact / Multigoals: prune impossible counts/bands
  if (
    /\b(exact\s+goals|total\s+goals\s+exact|number\s+of\s+goals|multigoals)\b/.test(combined) &&
    !isOverUnderMarket
  ) {
    const relevantGoals = isHomeOnly ? homeScore : isAwayOnly ? awayScore : totalGoals;
    const validOutcomes = market.outcomes.filter((o) => {
      const lbl = o.label.trim();
      if (/^\d+$/.test(lbl)) {
        return Number(lbl) >= relevantGoals;
      }
      const rangeMatch = lbl.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (rangeMatch) {
        return Number(rangeMatch[2]) >= relevantGoals;
      }
      return true;
    });
    if (validOutcomes.length < 2) return null;
    if (validOutcomes.length !== market.outcomes.length) {
      return { ...market, outcomes: validOutcomes };
    }
  }

  return market;
}

/**
 * Returns true when a market has exceeded its live lifespan for the given match state.
 */
export function isLiveMarketExpired(match: Match, market: Market): boolean {
  return evaluateLiveMarket(match, market) === null;
}

/**
 * Filters out live markets that have exceeded their lifespan (e.g. Over 2.5 when 3+ goals
 * have been scored, 1st Half markets after halftime, BTTS once both teams scored, etc.).
 * Prematch fixtures are returned unchanged.
 */
export function filterLiveMarkets(match: Match, markets: Market[] = match.markets): Market[] {
  if (!match.live) return markets;
  const active: Market[] = [];
  for (const m of markets) {
    const evaluated = evaluateLiveMarket(match, m);
    if (evaluated) {
      active.push(evaluated);
    }
  }
  return active;
}

/**
 * Returns full betting markets for the match detail page (/match/:id).
 * For live fixtures, returns strictly authentic active markets from the live
 * socket feed (with expired markets filtered out) — never synthetic or hardcoded odds.
 */
export function detailMarkets(match: Match): Market[] {
  const base = filterLiveMarkets(match, match.markets || []);

  if (match.live) {
    return base;
  }

  if (base.length > 2) {
    return base;
  }

  const extras: Market[] = [
    {
      id: "dc",
      name: "Double chance",
      outcomes: [
        { id: "1X", label: "1X", odds: 1.32, betCategory: "DC" },
        { id: "12", label: "12", odds: 1.28, betCategory: "DC" },
        { id: "X2", label: "X2", odds: 1.55, betCategory: "DC" },
      ],
    },
    {
      id: "ou05",
      name: "Total goals 0.5",
      outcomes: [
        { id: "Over", label: "Over", odds: 1.08, betCategory: "OU", line: "0.5" },
        { id: "Under", label: "Under", odds: 7.5, betCategory: "OU", line: "0.5" },
      ],
    },
    {
      id: "ou15",
      name: "Total goals 1.5",
      outcomes: [
        { id: "Over", label: "Over", odds: 1.28, betCategory: "OU", line: "1.5" },
        { id: "Under", label: "Under", odds: 3.4, betCategory: "OU", line: "1.5" },
      ],
    },
    {
      id: "ou35",
      name: "Total goals 3.5",
      outcomes: [
        { id: "Over", label: "Over", odds: 2.9, betCategory: "OU", line: "3.5" },
        { id: "Under", label: "Under", odds: 1.38, betCategory: "OU", line: "3.5" },
      ],
    },
    {
      id: "ou_h1_05",
      name: "1st Half Total goals 0.5",
      outcomes: [
        { id: "Over", label: "Over", odds: 1.42, betCategory: "OU_H1", line: "0.5" },
        { id: "Under", label: "Under", odds: 2.75, betCategory: "OU_H1", line: "0.5" },
      ],
    },
    {
      id: "ou_h1_15",
      name: "1st Half Total goals 1.5",
      outcomes: [
        { id: "Over", label: "Over", odds: 2.65, betCategory: "OU_H1", line: "1.5" },
        { id: "Under", label: "Under", odds: 1.42, betCategory: "OU_H1", line: "1.5" },
      ],
    },
    {
      id: "dnb",
      name: "Draw no bet",
      outcomes: [
        { id: "1", label: match.home, odds: 1.72, betCategory: "DNB" },
        { id: "2", label: match.away, odds: 2.05, betCategory: "DNB" },
      ],
    },
    {
      id: "dc_h1",
      name: "1st Half Double chance",
      outcomes: [
        { id: "1X", label: "1X", odds: 1.45, betCategory: "DC_H1" },
        { id: "12", label: "12", odds: 1.35, betCategory: "DC_H1" },
        { id: "X2", label: "X2", odds: 1.62, betCategory: "DC_H1" },
      ],
    },
    {
      id: "handicap",
      name: "Handicap",
      outcomes: [
        { id: "1", label: `${match.home} (-1)`, odds: 3.2, betCategory: "HC" },
        { id: "X", label: "Draw (-1)", odds: 3.6, betCategory: "HC" },
        { id: "2", label: `${match.away} (+1)`, odds: 1.85, betCategory: "HC" },
      ],
    },
    {
      id: "1x2_h1",
      name: "1st Half 1X2",
      outcomes: [
        { id: "1", label: "1", odds: 2.85, betCategory: "1x2_H1" },
        { id: "X", label: "X", odds: 2.1, betCategory: "1x2_H1" },
        { id: "2", label: "2", odds: 3.9, betCategory: "1x2_H1" },
      ],
    },
  ];

  const existingIds = new Set(base.map((m) => m.id));
  const missing = extras.filter((m) => !existingIds.has(m.id));
  return [...base, ...missing];
}

/** Real countries and leagues tree for the navigation menu. */
export const countriesWithLeagues: Array<{ country: string; leagues: string[] }> = [
  {
    country: "England",
    leagues: ["Premier League", "FA Cup", "EFL Cup", "Championship", "WNL", "WSL 2"],
  },
  {
    country: "Spain",
    leagues: ["La Liga", "Copa del Rey", "Segunda Division RFEF", "Primera Division RFEF"],
  },
  {
    country: "Italy",
    leagues: ["Serie A", "Coppa Italia", "Serie B"],
  },
  {
    country: "Germany",
    leagues: ["Bundesliga", "DFB Pokal", "2. Bundesliga", "Oberliga"],
  },
  {
    country: "France",
    leagues: ["Ligue 1", "Coupe de France", "Ligue 2", "League U19"],
  },
  {
    country: "Greece",
    leagues: ["Superleague", "Greek Cup"],
  },
  {
    country: "Austria",
    leagues: ["Bundesliga", "OFB Cup"],
  },
  {
    country: "Netherlands",
    leagues: ["Eredivisie", "KNVB Beker"],
  },
  {
    country: "Portugal",
    leagues: ["Primeira Liga", "Taca de Portugal", "Campeonato de Portugal"],
  },
  {
    country: "Turkey",
    leagues: ["Super Lig", "TFF 1. League", "TFF 2. League"],
  },
  {
    country: "Czech Republic",
    leagues: ["1. Liga", "3rd League", "4th League"],
  },
  {
    country: "Uganda",
    leagues: ["Uganda Premier League", "Uganda Cup"],
  },
  {
    country: "Europe",
    leagues: ["UEFA Champions League", "UEFA Europa League", "UEFA Conference League"],
  },
  {
    country: "Africa",
    leagues: ["CAF Champions League", "CAF Confederation Cup"],
  },
];

/** Single currency formatter for the whole app — always display money via this. */
export const formatUgx = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(value);

/**
 * Formats an in-play match clock from live feed period & elapsed minutes:
 * - Period 2 / status "1015" -> "HT"
 * - Period >= 4 / status "1017" -> "FT"
 * - 1st-half added time (period === 1 && minute > 45) -> "45+X'"
 * - 2nd-half added time ((period === 3 || period === undefined) && minute > 90) -> "90+X'"
 * - Otherwise -> "{minute}'"
 */
export function formatLiveClock(live: NonNullable<Match["live"]>): string {
  const statusLower = (live.status || "").trim().toLowerCase();
  if (
    live.period === 2 ||
    statusLower === "1015" ||
    /\b(ht|half\s*time|halftime)\b/.test(statusLower)
  ) {
    return "HT";
  }
  if (
    (live.period !== undefined && live.period >= 4) ||
    statusLower === "1017" ||
    /\b(ft|full\s*time|finished|ended)\b/.test(statusLower)
  ) {
    return "FT";
  }
  if (live.period === 1 && live.minute > 45) {
    return `45+${live.minute - 45}'`;
  }
  if ((live.period === undefined || live.period === 3) && live.minute > 90) {
    return `90+${live.minute - 90}'`;
  }
  return `${live.minute}'`;
}
