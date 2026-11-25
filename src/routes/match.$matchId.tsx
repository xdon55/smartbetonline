/**
 * routes/match.$matchId.tsx — MATCH DETAIL page (/match/:matchId).
 * Header banner with fixture info plus the full market list from
 * real SmartBet feeds. Every outcome button toggles a bet slip selection.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Star } from "lucide-react";
import {
  matches as fallbackMatches,
  detailMarkets,
  flagFor,
  formatLiveClock,
  type Match,
  type Market,
  type Outcome,
} from "@/lib/betting-data";
import { useBetSlip } from "@/lib/betslip";
import { useFavorites } from "@/lib/favorites";
import { BetSlip } from "@/components/bet-slip";
import { usePrematchGames, getCachedMatchById } from "@/hooks/use-prematch-games";
import { useLiveGames } from "@/hooks/use-live-games";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/match/$matchId")({
  head: ({ params }) => {
    const m = getCachedMatchById(params.matchId);
    const title = m ? `${m.home} v ${m.away} odds · SMARTBET` : "Match odds · SMARTBET";
    const description = m
      ? `All betting markets for ${m.home} v ${m.away} in the ${m.league}. Stake in UGX on SMARTBET.`
      : "Browse all betting markets for this fixture on SMARTBET.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: MatchDetail,
});

type GoalLineGroup = {
  line: string;
  over?: { outcome: Outcome; marketId: string; marketName: string };
  under?: { outcome: Outcome; marketId: string; marketName: string };
};

type AccordionSection =
  | { key: string; title: string; type: "goals_table"; lines: GoalLineGroup[] }
  | { key: string; title: string; type: "standard"; market: Market };

/**
 * Extracts line string (e.g. "1.5", "2.5") while ignoring 1st/2nd half prefixes.
 */
function extractGoalLine(market: Market): string | null {
  for (const o of market.outcomes) {
    if (o.line !== undefined && o.line !== null && o.line !== "") {
      const s = String(o.line).trim();
      if (s) return s;
    }
  }

  const cleanName = market.name
    .replace(/\b1st\b/gi, "")
    .replace(/\b2nd\b/gi, "")
    .replace(/\bhalf\b/gi, "")
    .replace(/\bht\b/gi, "");

  const numMatch = cleanName.match(/\d+(?:\.\d+)?/);
  return numMatch ? numMatch[0] : null;
}

/**
 * Groups total goals markets into sorted line rows.
 * STRICT FILTER: Only displays lines ending in .5 (e.g. 0.5, 1.5, 2.5, 3.5, 4.5).
 */
function buildGoalLineGroups(markets: Market[]): GoalLineGroup[] {
  const goalLineMap = new Map<string, GoalLineGroup>();

  for (const m of markets) {
    const lineStr = extractGoalLine(m);
    if (!lineStr) continue;

    const numVal = parseFloat(lineStr);
    if (isNaN(numVal)) continue;

    // Decimal portion must be strictly 0.5 (e.g. 0.5, 1.5, 2.5, 3.5)
    const decimalPart = Math.round(Math.abs(numVal % 1) * 100);
    if (decimalPart !== 50) {
      continue;
    }

    let group = goalLineMap.get(lineStr);
    if (!group) {
      group = { line: lineStr };
      goalLineMap.set(lineStr, group);
    }

    for (const o of m.outcomes) {
      const lbl = o.label.toLowerCase();
      if (lbl.includes("over") || o.id.toLowerCase() === "over") {
        group.over = { outcome: o, marketId: m.id, marketName: m.name };
      } else if (lbl.includes("under") || o.id.toLowerCase() === "under") {
        group.under = { outcome: o, marketId: m.id, marketName: m.name };
      }
    }
  }

  return Array.from(goalLineMap.values()).sort((a, b) => parseFloat(a.line) - parseFloat(b.line));
}

function MatchDetail() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const { toggle, has } = useBetSlip();
  const { isMatchFavorited, isLeagueFavorited, toggleFavoriteMatch, toggleFavoriteLeague } =
    useFavorites();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: "/" });
    }
  };

  const { matches: prematchMatches, loading: loadingPrematch } = usePrematchGames();
  const { matches: liveMatches, loading: loadingLive } = useLiveGames();

  // Find match in live feed first (so live scores/clock take priority), then prematch or local fallback
  const match: Match | undefined =
    liveMatches.find((m) => m.id === matchId) ||
    prematchMatches.find((m) => m.id === matchId) ||
    fallbackMatches.find((m) => m.id === matchId);

  const isLoading = (loadingPrematch || loadingLive) && !match;

  if (isLoading) {
    return (
      <main className="mx-auto max-w-md px-3 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" />
        <p className="mt-4 text-sm font-semibold text-muted-foreground">
          Loading fixture markets...
        </p>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="mx-auto max-w-md px-3 py-12 text-center">
        <p className="text-sm font-semibold">This event is no longer available.</p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-3 inline-block text-sm font-bold text-accent cursor-pointer"
        >
          Back to sports
        </button>
      </main>
    );
  }

  const rawMarkets = detailMarkets(match);

  const isTotalGoalsMarket = (m: Market) => {
    const nameLower = m.name.toLowerCase();
    const idLower = m.id.toLowerCase();
    return (
      idLower.startsWith("ou") ||
      idLower.includes("ou_") ||
      nameLower.includes("total goals") ||
      nameLower.includes("over/under") ||
      nameLower.includes("over / under")
    );
  };

  const isSecondHalfMarket = (m: Market) => {
    const combined = `${m.id.toLowerCase()} ${m.name.toLowerCase()}`;
    return (
      /\b(2nd\s*half|second\s*half|2h|h2)\b/.test(combined) ||
      /(?:^|[_-])h2(?:$|[_-])/.test(m.id.toLowerCase())
    );
  };

  const isHalfTimeMarket = (m: Market) => {
    if (isSecondHalfMarket(m)) return false;
    const combined = `${m.id.toLowerCase()} ${m.name.toLowerCase()}`;
    return (
      /\b(1st\s*half|first\s*half|half\s*time|halftime|h1|1h|ht)\b/.test(combined) ||
      /(?:^|[_-])(h1|1h|ht)(?:$|[_-])/.test(m.id.toLowerCase())
    );
  };

  // Group total goals markets
  const ftTotalGoalsMarkets = rawMarkets.filter(
    (m) => isTotalGoalsMarket(m) && !isHalfTimeMarket(m) && !isSecondHalfMarket(m),
  );

  const htTotalGoalsMarkets = rawMarkets.filter(
    (m) => isTotalGoalsMarket(m) && isHalfTimeMarket(m),
  );

  const h2TotalGoalsMarkets = rawMarkets.filter(
    (m) => isTotalGoalsMarket(m) && isSecondHalfMarket(m),
  );

  const ftGoalLines = buildGoalLineGroups(ftTotalGoalsMarkets);
  const htGoalLines = buildGoalLineGroups(htTotalGoalsMarkets);
  const h2GoalLines = buildGoalLineGroups(h2TotalGoalsMarkets);

  // Classify standard markets into requested fixed slots
  const nonTotalGoalsMarkets = rawMarkets.filter((m) => !isTotalGoalsMarket(m));

  let market1X2_FT: Market | undefined;
  let market1X2_HT: Market | undefined;
  let marketDC_FT: Market | undefined;
  let marketDC_HT: Market | undefined;
  let marketDNB: Market | undefined;
  let marketBTTS: Market | undefined;
  let marketHandicap: Market | undefined;

  const remainingMarkets: Market[] = [];

  for (const m of nonTotalGoalsMarkets) {
    const nameLower = m.name.toLowerCase();
    const idLower = m.id.toLowerCase();
    const isHT = isHalfTimeMarket(m);
    const isH2 = isSecondHalfMarket(m);

    if (!market1X2_FT && (idLower === "1x2" || (nameLower === "1x2" && !isHT && !isH2))) {
      market1X2_FT = m;
    } else if (!market1X2_HT && (idLower === "1x2_h1" || (nameLower.includes("1x2") && isHT))) {
      market1X2_HT = m;
    } else if (
      !marketDC_FT &&
      (idLower === "dc" || (nameLower.includes("double chance") && !isHT && !isH2))
    ) {
      marketDC_FT = m;
    } else if (
      !marketDC_HT &&
      (idLower === "dc_h1" || (nameLower.includes("double chance") && isHT))
    ) {
      marketDC_HT = m;
    } else if (!marketDNB && (idLower === "dnb" || nameLower.includes("draw no bet"))) {
      marketDNB = m;
    } else if (
      !marketBTTS &&
      (idLower === "btts" || (nameLower === "both teams to score" && !isHT && !isH2))
    ) {
      marketBTTS = m;
    } else if (
      !marketHandicap &&
      (idLower === "handicap" || idLower === "hc" || nameLower.includes("handicap"))
    ) {
      marketHandicap = m;
    } else {
      remainingMarkets.push(m);
    }
  }

  // Construct sections in exact order requested by user:
  // 1. 1x2 fulltime
  // 2. 1x2 halftime
  // 3. Double chance
  // 4. double chance halttime
  // 5. draw no bet
  // 6. total goals
  // 7. total goals halftime
  // 8. both teams to score
  // 9. handcap
  // 10+. rest of the markets
  const sections: AccordionSection[] = [];

  if (market1X2_FT) {
    sections.push({
      key: market1X2_FT.id,
      title: market1X2_FT.name,
      type: "standard",
      market: market1X2_FT,
    });
  }
  if (market1X2_HT) {
    sections.push({
      key: market1X2_HT.id,
      title: market1X2_HT.name,
      type: "standard",
      market: market1X2_HT,
    });
  }
  if (marketDC_FT) {
    sections.push({
      key: marketDC_FT.id,
      title: marketDC_FT.name,
      type: "standard",
      market: marketDC_FT,
    });
  }
  if (marketDC_HT) {
    sections.push({
      key: marketDC_HT.id,
      title: marketDC_HT.name,
      type: "standard",
      market: marketDC_HT,
    });
  }
  if (marketDNB) {
    sections.push({
      key: marketDNB.id,
      title: marketDNB.name,
      type: "standard",
      market: marketDNB,
    });
  }
  if (ftGoalLines.length > 0) {
    sections.push({
      key: "ft_total_goals",
      title: "Total goals",
      type: "goals_table",
      lines: ftGoalLines,
    });
  }
  if (htGoalLines.length > 0) {
    sections.push({
      key: "ht_total_goals",
      title: "1st Half total goals",
      type: "goals_table",
      lines: htGoalLines,
    });
  }
  if (h2GoalLines.length > 0) {
    sections.push({
      key: "h2_total_goals",
      title: "2nd Half total goals",
      type: "goals_table",
      lines: h2GoalLines,
    });
  }
  if (marketBTTS) {
    sections.push({
      key: marketBTTS.id,
      title: marketBTTS.name,
      type: "standard",
      market: marketBTTS,
    });
  }
  if (marketHandicap) {
    sections.push({
      key: marketHandicap.id,
      title: marketHandicap.name,
      type: "standard",
      market: marketHandicap,
    });
  }

  for (const m of remainingMarkets) {
    sections.push({ key: m.id, title: m.name, type: "standard", market: m });
  }

  // Open first 10 markets by default
  const defaultOpenMarkets = sections.map((s) => s.key).slice(0, 10);

  const renderOutcomeBtn = (o: Outcome, marketId: string, marketName: string) => {
    const id = `${match.id}-${marketId}-${o.id}`;
    const active = has(id);
    const isLocked = Boolean(o.locked || o.odds <= 0);

    if (isLocked) {
      return (
        <div
          key={o.id}
          title="Odds temporarily locked by live bookmaker"
          className="flex h-10 flex-col items-center justify-center rounded-md border border-border/50 bg-muted/30 px-1 text-muted-foreground"
        >
          <span className="max-w-full truncate px-1 text-[9px] font-semibold uppercase opacity-70">
            {o.label}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground/80 leading-none">
            <span className="text-[9px]">🔒</span> Locked
          </span>
        </div>
      );
    }

    return (
      <button
        key={o.id}
        type="button"
        onClick={() =>
          toggle({
            id,
            matchId: match.id,
            match: `${match.home} v ${match.away}`,
            market: marketName,
            pick: o.label,
            odds: o.odds,
            betCategory: o.betCategory,
            line: o.line,
            matchOddId: o.matchOddId,
            bookMakerId: o.bookMakerId,
            isLive: Boolean(match.live),
          })
        }
        className={`flex h-10 flex-col items-center justify-center rounded-md text-xs font-bold tabular-nums transition-colors ${
          active
            ? "bg-odds-active text-odds-active-foreground"
            : "bg-odds text-odds-foreground hover:bg-muted"
        }`}
      >
        <span className="max-w-full truncate px-1 text-[9px] font-semibold uppercase opacity-70 leading-tight">
          {o.label}
        </span>
        <span className="leading-none">{o.odds.toFixed(2)}</span>
      </button>
    );
  };

  const renderGoalLineTable = (lines: GoalLineGroup[]) => (
    <div className="space-y-2">
      <div className="grid grid-cols-[70px_1fr_1fr] items-center gap-2 px-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <div>Line</div>
        <div>Over</div>
        <div>Under</div>
      </div>
      {lines.map((gl) => (
        <div key={gl.line} className="grid grid-cols-[70px_1fr_1fr] items-center gap-2">
          <div className="flex h-10 items-center justify-center rounded-md border border-border bg-muted/40 text-xs font-bold tabular-nums text-foreground">
            {gl.line}
          </div>
          {gl.over ? (
            renderOutcomeBtn(gl.over.outcome, gl.over.marketId, gl.over.marketName)
          ) : (
            <div className="h-10 rounded-md border border-border/50 bg-muted/20" />
          )}
          {gl.under ? (
            renderOutcomeBtn(gl.under.outcome, gl.under.marketId, gl.under.marketName)
          ) : (
            <div className="h-10 rounded-md border border-border/50 bg-muted/20" />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <main className="relative mx-auto flex w-full max-w-[968px] gap-2 px-0 py-3 md:grid md:h-[calc(100vh-7.5rem)] md:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] md:overflow-hidden md:px-3">
      <div className="no-scrollbar min-w-0 flex-1 space-y-3 md:h-full md:overflow-y-auto md:py-3">
        <section className="brand-gradient px-3 py-4 text-surface-foreground md:rounded-lg">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1 text-xs font-semibold opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  toggleFavoriteLeague({
                    league: match.league,
                    country: match.country,
                    sport: match.sport,
                  })
                }
                aria-pressed={isLeagueFavorited(match.league, match.country)}
                aria-label={
                  isLeagueFavorited(match.league, match.country)
                    ? `Unpin ${match.league}`
                    : `Pin ${match.league} to favorites`
                }
                className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] font-semibold transition-colors ${
                  isLeagueFavorited(match.league, match.country)
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-surface-foreground/20 bg-surface-foreground/10 text-surface-foreground/90 hover:border-surface-foreground/40"
                }`}
              >
                <Star
                  className={`h-3 w-3 ${
                    isLeagueFavorited(match.league, match.country) ? "fill-current" : ""
                  }`}
                />
                <span>
                  {isLeagueFavorited(match.league, match.country) ? "League pinned" : "Pin league"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => toggleFavoriteMatch(match)}
                aria-pressed={isMatchFavorited(match.id)}
                aria-label={
                  isMatchFavorited(match.id)
                    ? `Unpin ${match.home} v ${match.away}`
                    : `Pin ${match.home} v ${match.away} to favorites`
                }
                className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] font-semibold transition-colors ${
                  isMatchFavorited(match.id)
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-surface-foreground/20 bg-surface-foreground/10 text-surface-foreground/90 hover:border-surface-foreground/40"
                }`}
              >
                <Star className={`h-3 w-3 ${isMatchFavorited(match.id) ? "fill-current" : ""}`} />
                <span>{isMatchFavorited(match.id) ? "Pinned" : "Pin match"}</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
            {flagFor(match.country)} {match.country} · {match.league}
          </p>
          <h1 className="mt-1 font-display text-xl font-bold">
            {match.home} v {match.away}
          </h1>
          <p className="mt-1 text-xs opacity-80">
            {match.live ? (
              <span className="font-bold tabular-nums">
                Live {formatLiveClock(match.live)} · {match.live.homeScore}-{match.live.awayScore}
              </span>
            ) : (
              match.startsAt
            )}
          </p>
        </section>

        {sections.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-xs font-semibold text-muted-foreground">
            No live markets are currently open for this match.
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={defaultOpenMarkets} className="space-y-3">
            {sections.map((section) => (
              <AccordionItem
                key={section.key}
                value={section.key}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <AccordionTrigger className="bg-secondary px-3 py-2 text-xs font-bold uppercase tracking-wide text-secondary-foreground hover:no-underline">
                  <span>{section.title}</span>
                </AccordionTrigger>
                <AccordionContent className="p-3">
                  {section.type === "goals_table" ? (
                    renderGoalLineTable(section.lines)
                  ) : (
                    <div
                      className={`grid gap-2 ${
                        section.market.outcomes.length === 2 ? "grid-cols-2" : "grid-cols-3"
                      }`}
                    >
                      {section.market.outcomes.map((o) =>
                        renderOutcomeBtn(o, section.market.id, section.market.name),
                      )}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      <BetSlip />
    </main>
  );
}
