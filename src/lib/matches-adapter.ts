/**
 * matches-adapter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Adapts raw SmartBet prematch games and live socket updates into the
 * application's standard Match, Market, and Outcome data types.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  filterLiveMarkets,
  type Match,
  type Market,
  type Outcome,
  type KickoffDay,
} from "./betting-data";
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
  b?: number; // game-level blocked/suspended flag
  t1?: { n?: string }; // home team
  t2?: { n?: string }; // away team
  inf?: string; // league
  sc?: {
    goal?: string | number[];
    h1?: string | number[];
    corner?: string | number[];
    yellowCard?: string | number[];
    redCard?: string | number[];
  }; // score
  tm?: number; // match clock
  tss?: string | number;
  st?: string; // status
  stn?: string;
  p?: number; // period
  bt?: Array<{
    id?: string | number;
    n?: string;
    b?: number;
    h?: number | null;
    o?: Array<{ id?: string | number; n?: string; v?: number; b?: number }>;
    items?: Array<{ id?: string | number; n?: string; p?: number; b?: number }>;
  }>;
}

function parseScorePair(val?: string | number[]): [number, number] | undefined {
  if (!val) return undefined;
  if (typeof val === "string" && val.includes(":")) {
    const parts = val.split(":");
    return [parseInt(parts[0] ?? "0", 10) || 0, parseInt(parts[1] ?? "0", 10) || 0];
  }
  if (Array.isArray(val) && val.length >= 2) {
    return [Number(val[0]) || 0, Number(val[1]) || 0];
  }
  return undefined;
}

function formatOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

/**
 * Adapts a LiveSocketGameRaw into a live Match.
 */
export function adaptLiveGame(raw: LiveSocketGameRaw, previousMatch?: Match): Match {
  let homeScore = 0;
  let awayScore = 0;

  const parsedGoal = parseScorePair(raw.sc?.goal);
  if (parsedGoal) {
    [homeScore, awayScore] = parsedGoal;
  } else if (previousMatch?.live) {
    homeScore = previousMatch.live.homeScore;
    awayScore = previousMatch.live.awayScore;
  }

  const parsedH1 = parseScorePair(raw.sc?.h1);
  const h1HomeScore = parsedH1 ? parsedH1[0] : previousMatch?.live?.h1HomeScore;
  const h1AwayScore = parsedH1 ? parsedH1[1] : previousMatch?.live?.h1AwayScore;
  const corners = parseScorePair(raw.sc?.corner) ?? previousMatch?.live?.corners;
  const yellowCards = parseScorePair(raw.sc?.yellowCard) ?? previousMatch?.live?.yellowCards;
  const redCards = parseScorePair(raw.sc?.redCard) ?? previousMatch?.live?.redCards;

  const { country, league } = parseCountryAndLeague(raw.inf);

  const isGameBlocked = Boolean(raw.b && raw.b > 0);
  const hasSnapshotMarkets = Array.isArray(raw.bt);
  const rawMarkets = raw.bt || [];

  const markets: Market[] = rawMarkets.map((m) => {
    const rawOdds = m.o || m.items || [];
    const isMarketBlocked = isGameBlocked || Boolean(m.b && m.b > 0);

    const rawName = (m.n || "").trim();
    let marketName = rawName || "1X2";
    let marketId = marketName.toLowerCase();

    const upperName = rawName.toUpperCase();
    const isH1Market =
      /\b(1ST\s*HALF|FIRST\s*HALF|H1|1H|HT)\b/.test(upperName) || upperName.includes("_H1");
    const isH2Market =
      /\b(2ND\s*HALF|SECOND\s*HALF|H2|2H)\b/.test(upperName) || upperName.includes("_H2");
    const isOverUnderName =
      upperName === "OU" ||
      upperName === "OVER/UNDER" ||
      upperName === "OVER / UNDER" ||
      upperName === "TOTAL GOALS" ||
      upperName.startsWith("OU_") ||
      upperName.includes("TOTAL GOALS") ||
      upperName.includes("OVER/UNDER");

    const sngMatch = upperName.match(/^S(\d+)G$/);
    const hasNumericLine = m.h !== undefined && m.h !== null && Number.isFinite(Number(m.h));
    const normalizedLine = hasNumericLine ? Number(Number(m.h).toFixed(2)) : undefined;

    if (upperName === "1X2" || upperName === "MAIN 1X2") {
      marketId = "1x2";
      marketName = "1X2";
    } else if (upperName === "BTS" || upperName === "BTTS" || upperName === "BOTH TEAMS TO SCORE") {
      marketId = "btts";
      marketName = "Both teams to score";
    } else if (upperName === "BTS_H1" || upperName === "BTTS_H1") {
      marketId = "btts_h1";
      marketName = "1st Half Both teams to score";
    } else if (upperName === "BTS_H2" || upperName === "BTTS_H2") {
      marketId = "btts_h2";
      marketName = "2nd Half Both teams to score";
    } else if (upperName === "RBTS") {
      marketId = "rbts";
      marketName = "Result & Both teams to score";
    } else if (upperName === "DC" || upperName === "DOUBLE CHANCE") {
      marketId = "dc";
      marketName = "Double chance";
    } else if (upperName === "DC_H1") {
      marketId = "dc_h1";
      marketName = "1st Half Double chance";
    } else if (upperName === "DNB" || upperName === "DRAW NO BET") {
      marketId = "dnb";
      marketName = "Draw no bet";
    } else if (upperName === "1X2_H1" || upperName === "1ST HALF 1X2") {
      marketId = "1x2_h1";
      marketName = "1st Half 1X2";
    } else if (upperName === "CS_H1") {
      marketId = "cs_h1";
      marketName = "1st Half Correct score";
    } else if (upperName === "CS") {
      marketId = "cs";
      marketName = "Correct score";
    } else if (sngMatch) {
      const goalNum = Number(sngMatch[1]);
      marketId = `s${goalNum}g`;
      marketName = `${formatOrdinal(goalNum)} Goal`;
    } else if (isOverUnderName) {
      const extracted = normalizedLine !== undefined ? String(normalizedLine) : null;
      const nameNum = rawName
        .replace(/\b(1st|2nd|first|second|half|ht|h1|h2)\b/gi, "")
        .match(/\d+(?:\.\d+)?/);
      const lineStr = extracted || (nameNum ? nameNum[0] : "2.5");
      const slug = lineStr.replace(".", "_");
      if (isH1Market) {
        marketId = `ou_h1_${slug}`;
        marketName = `1st Half Total goals ${lineStr}`;
      } else if (isH2Market) {
        marketId = `ou_h2_${slug}`;
        marketName = `2nd Half Total goals ${lineStr}`;
      } else {
        marketId = lineStr === "2.5" ? "ou25" : `ou_${slug}`;
        marketName = `Total goals ${lineStr}`;
      }
    }

    const outcomes: Outcome[] = rawOdds.map((item, i) => {
      let oddVal = 0;
      if ("v" in item && typeof item.v === "number" && item.v > 0) {
        oddVal = item.v;
      } else if ("p" in item && typeof item.p === "number" && item.p > 0) {
        oddVal = item.p > 50 ? item.p / 100 : item.p;
      }

      const isOutcomeBlocked = Boolean(item.b && item.b > 0);
      const locked = isMarketBlocked || isOutcomeBlocked || oddVal <= 0;

      return {
        id: String(item.id || item.n || i),
        label: item.n || String(i + 1),
        odds: !locked && oddVal > 0 ? Number(oddVal.toFixed(2)) : 0,
        locked,
        line: normalizedLine,
        betCategory: m.n,
      };
    });

    // Sort outcomes according to standard sports betting conventions
    const liveOutcomeOrder: Record<string, string[]> = {
      ...OUTCOME_ORDER,
      dc_h1: ["1X", "12", "X2"],
      btts_h1: ["Yes", "No"],
      btts_h2: ["Yes", "No"],
      rbts: ["1-Yes", "1-No", "X-Yes", "X-No", "2-Yes", "2-No"],
    };

    const order =
      liveOutcomeOrder[marketId] ||
      (sngMatch ? ["1", "No goal", "2"] : undefined) ||
      (isOverUnderName ? ["Over", "Under"] : undefined);

    if (order) {
      outcomes.sort((a, b) => {
        const ia = order.indexOf(a.label);
        const ib = order.indexOf(b.label);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.label.localeCompare(b.label);
      });
    } else if (marketId === "cs" || marketId === "cs_h1") {
      outcomes.sort((a, b) => {
        const ma = a.label.match(/^(\d+)\s*[-:]\s*(\d+)$/);
        const mb = b.label.match(/^(\d+)\s*[-:]\s*(\d+)$/);
        if (!ma && !mb) return a.label.localeCompare(b.label);
        if (!ma) return 1;
        if (!mb) return -1;
        const ha = Number(ma[1]);
        const aa = Number(ma[2]);
        const hb = Number(mb[1]);
        const ab = Number(mb[2]);
        const ta = ha + aa;
        const tb = hb + ab;
        if (ta !== tb) return ta - tb;
        if (ha !== hb) return ha - hb;
        return aa - ab;
      });
    }

    return {
      id: marketId,
      name: marketName,
      outcomes,
    };
  });

  // Authoritative snapshot replacement: when raw.bt is present, replace markets so closed/suspended
  // lines don't persist with stale odds; only preserve previousMatch.markets if bt is omitted.
  const activeSnapshotMarkets = hasSnapshotMarkets
    ? markets.filter((m) => m.outcomes.length > 0)
    : (previousMatch?.markets ?? []).filter((m) => m.outcomes.length > 0);

  const marketMap = new Map<string, Market>();
  for (const m of activeSnapshotMarkets) {
    marketMap.set(m.id, m);
  }

  // Sort markets to prioritize 1X2, OU 2.5, BTTS, DC, DNB
  const PRIORITY_ORDER = ["1x2", "ou25", "btts", "dc", "dnb", "ou_1_5", "ou_3_5", "1x2_h1"];
  const sortedMarkets: Market[] = [];

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

  let minute = previousMatch?.live?.minute ?? 0;
  if (typeof raw.tss === "string" && raw.tss.includes(":")) {
    const parsedMin = parseInt(raw.tss.split(":")[0] ?? "", 10);
    if (Number.isFinite(parsedMin)) {
      minute = parsedMin;
    }
  } else if (typeof raw.tm === "number" && raw.tm >= 0) {
    minute = Math.min(120, Math.floor(raw.tm / 60));
  }

  const statusStr =
    [raw.st, raw.stn].filter(Boolean).join(" ").trim() || previousMatch?.live?.status;
  const periodVal = typeof raw.p === "number" && raw.p > 0 ? raw.p : previousMatch?.live?.period;

  const adaptedMatch: Match = {
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
      ...(statusStr ? { status: statusStr } : {}),
      ...(periodVal !== undefined ? { period: periodVal } : {}),
      ...(h1HomeScore !== undefined ? { h1HomeScore } : {}),
      ...(h1AwayScore !== undefined ? { h1AwayScore } : {}),
      ...(corners ? { corners } : {}),
      ...(yellowCards ? { yellowCards } : {}),
      ...(redCards ? { redCards } : {}),
    },
    marketCount: sortedMarkets.length,
    markets: sortedMarkets,
  };

  const activeMarkets = filterLiveMarkets(adaptedMatch, sortedMarkets);
  return {
    ...adaptedMatch,
    markets: activeMarkets,
    marketCount: activeMarkets.length,
  };
}
