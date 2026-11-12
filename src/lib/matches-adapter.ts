/**
 * matches-adapter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Adapts raw SmartBet prematch games and live socket updates into the
 * application's standard Match, Market, and Outcome data types.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { Match, Market, Outcome, KickoffDay } from "./betting-data";
import type { PrematchGame, PrematchMatchOdd } from "./api-smartbet";

const KNOWN_COUNTRIES = [
  "England",
  "Spain",
  "Italy",
  "Germany",
  "France",
  "Uganda",
  "Greece",
  "Netherlands",
  "Portugal",
  "Turkey",
  "Czech Republic",
  "Austria",
  "Scotland",
  "Romania",
  "Norway",
  "Sweden",
  "Poland",
  "Belgium",
  "Denmark",
  "Switzerland",
  "Croatia",
  "Serbia",
  "Hungary",
  "Slovakia",
  "Cyprus",
  "USA",
  "Brazil",
  "Argentina",
  "Kenya",
  "Tanzania",
  "South Africa",
  "Thailand",
  "Japan",
  "Australia",
  "Egypt",
  "Morocco",
  "Russia",
  "Ukraine",
  "Chile",
  "Indonesia",
];

/**
 * Extracts country and clean league name from a raw league string
 * (e.g. "England Premier League" -> country "England", league "Premier League").
 */
export function parseCountryAndLeague(
  rawLeague?: string,
  providedCountry?: string,
): { country: string; league: string } {
  if (providedCountry && rawLeague) {
    return { country: providedCountry, league: rawLeague };
  }

  if (!rawLeague) {
    return { country: "International", league: "Featured League" };
  }

  for (const c of KNOWN_COUNTRIES) {
    if (rawLeague.startsWith(c)) {
      const rest = rawLeague.slice(c.length).trim();
      return {
        country: c,
        league: rest || rawLeague,
      };
    }
  }

  if (rawLeague.toLowerCase().includes("champions league")) {
    return { country: "Europe", league: rawLeague };
  }
  if (rawLeague.toLowerCase().includes("caf")) {
    return { country: "Africa", league: rawLeague };
  }

  return {
    country: "International",
    league: rawLeague,
  };
}

/**
 * Formats match kickoff into human-readable label: "Today 19:30", "Tomorrow 17:00", etc.
 */
export function formatStartsAt(startTimeStr?: string): { display: string; day: KickoffDay } {
  if (!startTimeStr) {
    return { display: "Today 19:30", day: "today" };
  }

  try {
    const kickoff = new Date(startTimeStr);
    const now = new Date();

    const kickoffMidnight = new Date(kickoff.getFullYear(), kickoff.getMonth(), kickoff.getDate());
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round(
      (kickoffMidnight.getTime() - nowMidnight.getTime()) / (1000 * 60 * 60 * 24),
    );

    const hours = String(kickoff.getHours()).padStart(2, "0");
    const mins = String(kickoff.getMinutes()).padStart(2, "0");
    const timeStr = `${hours}:${mins}`;

    if (diffDays <= 0) {
      return { display: `Today ${timeStr}`, day: "today" };
    }
    if (diffDays === 1) {
      return { display: `Tomorrow ${timeStr}`, day: "tomorrow" };
    }
    if (diffDays === 2) {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return { display: `${dayNames[kickoff.getDay()]} ${timeStr}`, day: "day-after" };
    }

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return { display: `${dayNames[kickoff.getDay()]} ${timeStr}`, day: "this-week" };
  } catch {
    return { display: "Today 19:30", day: "today" };
  }
}

/**
 * Determines whether a league is among major popular competitions.
 */
function isPopularLeague(leagueStr: string): boolean {
  const lower = leagueStr.toLowerCase();
  return (
    lower.includes("premier league") ||
    lower.includes("la liga") ||
    lower.includes("serie a") ||
    lower.includes("bundesliga") ||
    lower.includes("ligue 1") ||
    lower.includes("superleague") ||
    lower.includes("eredivisie") ||
    lower.includes("champions league") ||
    lower.includes("uganda")
  );
}

/**
 * Standard outcome ordering map for sports betting markets.
 */
const OUTCOME_ORDER: Record<string, string[]> = {
  "1x2": ["1", "X", "2"],
  "1x2_h1": ["1", "X", "2"],
  dc: ["1X", "12", "X2"],
  btts: ["Yes", "No"],
  ou15: ["Over", "Under"],
  ou25: ["Over", "Under"],
  ou35: ["Over", "Under"],
  dnb: ["1", "2"],
};

/**
 * Groups raw MatchOdds from the SmartBet games feed into standard Market structures.
 */
function groupMatchOddsIntoMarkets(oddsList: PrematchMatchOdd[]): Market[] {
  if (!oddsList || !oddsList.length) {
    return [];
  }

  const marketMap = new Map<string, { id: string; name: string; outcomes: Outcome[] }>();

  for (const odd of oddsList) {
    if (typeof odd.Odd !== "number" || odd.Odd <= 0) continue;

    const rawCategory = (odd.BetCategory || "").trim();
    const upperCat = rawCategory.toUpperCase();
    const lineStr = odd.Line !== null && odd.Line !== undefined ? String(odd.Line).trim() : "";

    let marketId = rawCategory.toLowerCase();
    let marketName = rawCategory;

    if (upperCat === "1X2") {
      marketId = "1x2";
      marketName = "1X2";
    } else if (upperCat === "BTS" || upperCat === "BTTS") {
      marketId = "btts";
      marketName = "Both teams to score";
    } else if (upperCat === "DC") {
      marketId = "dc";
      marketName = "Double chance";
    } else if (upperCat === "DNB") {
      marketId = "dnb";
      marketName = "Draw no bet";
    } else if (upperCat === "1X2_H1") {
      marketId = "1x2_h1";
      marketName = "1st Half 1X2";
    } else if (upperCat === "OU" || upperCat.startsWith("OU_") || upperCat === "TOTAL GOALS") {
      if (lineStr === "2.5" || (!lineStr && upperCat === "OU")) {
        marketId = "ou25";
        marketName = "Total goals 2.5";
      } else if (lineStr === "1.5") {
        marketId = "ou15";
        marketName = "Total goals 1.5";
      } else if (lineStr === "3.5") {
        marketId = "ou35";
        marketName = "Total goals 3.5";
      } else {
        marketId = `ou_${lineStr ? lineStr.replace(".", "_") : "2_5"}`;
        marketName = `Total goals ${lineStr || "2.5"}`;
      }
    }

    let group = marketMap.get(marketId);
    if (!group) {
      group = { id: marketId, name: marketName, outcomes: [] };
      marketMap.set(marketId, group);
    }

    const outcomeId = String(odd.BetOption).trim();
    // Avoid duplicates
    if (!group.outcomes.some((o) => o.id === outcomeId)) {
      group.outcomes.push({
        id: outcomeId,
        label: outcomeId,
        odds: Number(odd.Odd.toFixed(2)),
        matchOddId: odd.MatchOddId,
        bookMakerId: odd.BookMakerId,
        line: odd.Line,
        betCategory: odd.BetCategory,
      });
    }
  }

  // Sort outcomes in each market according to standard sports betting conventions
  marketMap.forEach((market, id) => {
    const order = OUTCOME_ORDER[id];
    if (order) {
      market.outcomes.sort((a, b) => {
        const ia = order.indexOf(a.id);
        const ib = order.indexOf(b.id);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.label.localeCompare(b.label);
      });
    }
  });

  // Prioritize primary markets in fixed display order:
  const PRIORITY_ORDER = ["1x2", "ou25", "btts", "dc", "dnb", "ou15", "ou35", "1x2_h1"];
  const sortedMarkets: Market[] = [];

  for (const prioId of PRIORITY_ORDER) {
    const m = marketMap.get(prioId);
    if (m && m.outcomes.length > 0) {
      sortedMarkets.push({
        id: m.id,
        name: m.name,
        outcomes: m.outcomes,
      });
      marketMap.delete(prioId);
    }
  }

  // Append remaining markets
  marketMap.forEach((m) => {
    if (m.outcomes.length > 0) {
      sortedMarkets.push({
        id: m.id,
        name: m.name,
        outcomes: m.outcomes,
      });
    }
  });

  return sortedMarkets;
}

/**
 * Adapts a raw PrematchGame from the SmartBet gamesBaseUrl feed to a standard Match.
 */
export function adaptPrematchGame(game: PrematchGame): Match {
  const { country, league } = parseCountryAndLeague(game.League, game.Country);
  const { display: startsAt, day } = formatStartsAt(game.StartTime);
  const markets = groupMatchOddsIntoMarkets(game.MatchOdds || []);
  const popular = isPopularLeague(game.League || "");

  return {
    id: String(game.OriginalMatchId || game.MatchNo),
    sport: game.Sport || "Football",
    league,
    country,
    home: game.HomeTeamName || "Home Team",
    away: game.AwayTeamName || "Away Team",
    startsAt,
    day,
    popular,
    marketCount: markets.length > 0 ? markets.length : 18,
    markets,
  };
}

/**
 * Live game entry shape from Socket.IO buffers event
 */
export interface LiveSocketGameRaw {
  std: number | string; // match ID
  cd?: string | number; // short code
  t1?: { n?: string }; // home team
  t2?: { n?: string }; // away team
  inf?: string; // league
  sc?: { goal?: string | number[] }; // score
  tm?: number; // match clock
  tss?: string | number;
  st?: string; // status
  stn?: string;
  bt?: Array<{
    id?: string | number;
    n?: string;
    b?: number;
    h?: number;
    o?: Array<{ id?: string | number; n?: string; v?: number; b?: number }>;
    items?: Array<{ id?: string | number; n?: string; p?: number; b?: number }>;
  }>;
}

/**
 * Adapts a LiveSocketGameRaw into a live Match.
 */
export function adaptLiveGame(raw: LiveSocketGameRaw, previousMatch?: Match): Match {
  let homeScore = 0;
  let awayScore = 0;

  if (raw.sc?.goal) {
    if (typeof raw.sc.goal === "string" && raw.sc.goal.includes(":")) {
      const parts = raw.sc.goal.split(":");
      homeScore = parseInt(parts[0] ?? "0", 10) || 0;
      awayScore = parseInt(parts[1] ?? "0", 10) || 0;
    } else if (Array.isArray(raw.sc.goal) && raw.sc.goal.length >= 2) {
      homeScore = Number(raw.sc.goal[0]) || 0;
      awayScore = Number(raw.sc.goal[1]) || 0;
    }
  } else if (previousMatch?.live) {
    homeScore = previousMatch.live.homeScore;
    awayScore = previousMatch.live.awayScore;
  }

  const { country, league } = parseCountryAndLeague(raw.inf);

  const rawMarkets = raw.bt || [];
  let markets: Market[] = rawMarkets.map((m, idx) => {
    const rawOdds = m.o || m.items || [];
    const isMarketBlocked = Boolean(m.b && m.b > 0);

    const rawName = (m.n || "").trim();
    let marketName = rawName || "1X2";
    let marketId = marketName.toLowerCase();

    const upperName = rawName.toUpperCase();
    if (upperName === "1X2" || upperName === "MAIN 1X2") {
      marketId = "1x2";
      marketName = "1X2";
    } else if (upperName === "BTS" || upperName === "BTTS" || upperName === "BOTH TEAMS TO SCORE") {
      marketId = "btts";
      marketName = "Both teams to score";
    } else if (upperName === "DC" || upperName === "DOUBLE CHANCE") {
      marketId = "dc";
      marketName = "Double chance";
    } else if (upperName === "DNB" || upperName === "DRAW NO BET") {
      marketId = "dnb";
      marketName = "Draw no bet";
    } else if (upperName === "1X2_H1" || upperName === "1ST HALF 1X2") {
      marketId = "1x2_h1";
      marketName = "1st Half 1X2";
    } else if (upperName === "OU" || upperName === "OVER/UNDER" || upperName.startsWith("OU_")) {
      const lineStr = m.h !== undefined && m.h !== null ? String(m.h) : "2.5";
      marketId = `ou${lineStr.replace(".", "")}`;
      marketName = `Total goals ${lineStr}`;
    }

    const prevMarket = previousMatch?.markets.find((pm) => pm.id === marketId);

    const outcomes: Outcome[] = rawOdds.map((item, i) => {
      let oddVal = 0;
      if ("v" in item && typeof item.v === "number" && item.v > 0) {
        oddVal = item.v;
      } else if ("p" in item && typeof item.p === "number" && item.p > 0) {
        oddVal = item.p > 50 ? item.p / 100 : item.p;
      }

      const isOutcomeBlocked = Boolean(item.b && item.b > 0);

      // If missing in an incremental delta update, fall back to previous market outcome
      if (oddVal <= 0 && prevMarket && !isMarketBlocked && !isOutcomeBlocked) {
        const prevOutcome = prevMarket.outcomes.find(
          (po) =>
            po.id === String(item.id || item.n || i) || po.label === (item.n || String(i + 1)),
        );
        if (prevOutcome && prevOutcome.odds > 0) {
          oddVal = prevOutcome.odds;
        }
      }

      const locked = isMarketBlocked || isOutcomeBlocked || oddVal <= 0;

      return {
        id: String(item.id || item.n || i),
        label: item.n || String(i + 1),
        odds: oddVal > 0 ? Number(oddVal.toFixed(2)) : 0,
        locked,
        betCategory: m.n,
      };
    });

    // Sort outcomes according to standard betting order
    const order = OUTCOME_ORDER[marketId];
    if (order) {
      outcomes.sort((a, b) => {
        const ia = order.indexOf(a.label);
        const ib = order.indexOf(b.label);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.label.localeCompare(b.label);
      });
    }

    return {
      id: marketId,
      name: marketName,
      outcomes,
    };
  });

  // If new packet had no markets but previous match did, retain previous markets
  if (markets.length === 0 && previousMatch && previousMatch.markets.length > 0) {
    markets = previousMatch.markets;
  }

  // Sort markets to prioritize 1X2, OU 2.5, BTTS, DC, DNB
  const PRIORITY_ORDER = ["1x2", "ou25", "btts", "dc", "dnb", "ou15", "ou35", "1x2_h1"];
  const sortedMarkets: Market[] = [];
  const marketMap = new Map(markets.map((m) => [m.id, m]));

  for (const prioId of PRIORITY_ORDER) {
    const m = marketMap.get(prioId);
    if (m && m.outcomes.length > 0) {
      sortedMarkets.push(m);
      marketMap.delete(prioId);
    }
  }
  marketMap.forEach((m) => {
    if (m.outcomes.length > 0) sortedMarkets.push(m);
  });

  let minute = previousMatch?.live?.minute || 45;
  if (typeof raw.tss === "string" && raw.tss.includes(":")) {
    minute = parseInt(raw.tss.split(":")[0] ?? "45", 10) || 45;
  } else if (typeof raw.tm === "number" && raw.tm > 0) {
    minute = Math.min(90, Math.max(1, Math.floor(raw.tm / 60)));
  }

  return {
    id: String(raw.std || raw.cd || previousMatch?.id || Math.random().toString(36).slice(2, 8)),
    sport: "Football",
    league: league && league !== "Live" ? league : previousMatch?.league || "Live In-Play",
    country: country || previousMatch?.country || "International",
    home: raw.t1?.n || previousMatch?.home || "Home FC",
    away: raw.t2?.n || previousMatch?.away || "Away FC",
    startsAt: "Live",
    day: "today",
    popular: true,
    live: {
      minute,
      homeScore,
      awayScore,
    },
    marketCount: sortedMarkets.length > 0 ? sortedMarkets.length : 12,
    markets: sortedMarkets,
  };
}
