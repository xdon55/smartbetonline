/**
 * sports-filters.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Filter bar for the sports page: sport / league / market dropdowns plus
 * kickoff-time chips. `filterMatches()` applies a SportsFilterState to a
 * fixture list — keep it in sync with the Match type in lib/betting-data.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { kickoffOptions, marketOptions, matches, sports } from "@/lib/betting-data";

export type SportsFilterState = {
  sport: string;
  league: string;
  market: string;
  kickoff: string;
};

export const defaultFilters: SportsFilterState = {
  sport: "all",
  league: "all",
  market: "1x2",
  kickoff: "all",
};

export function SportsFilters({
  value,
  onChange,
  showKickoff = true,
  matchesList,
}: {
  value: SportsFilterState;
  onChange: (v: SportsFilterState) => void;
  showKickoff?: boolean;
  matchesList?: typeof matches;
}) {
  const activeMatches =
    Array.isArray(matchesList) && matchesList.length > 0
      ? matchesList
      : Array.isArray(matches)
        ? matches
        : [];
  const leagues = Array.from(
    new Set(
      activeMatches
        .filter(
          (m) =>
            m &&
            (value.sport === "all" || (m.sport || "").toLowerCase() === value.sport.toLowerCase()),
        )
        .map((m) => m.league || "Unknown"),
    ),
  ).sort();

  return (
    <div className="space-y-3 border-b border-border bg-card px-3 py-3">
      <div className="grid grid-cols-3 gap-2.5">
        <Select
          value={value.sport}
          onValueChange={(v) => onChange({ ...value, sport: v, league: "all" })}
        >
          <SelectTrigger className="h-10 rounded-md bg-background text-xs font-medium">
            <SelectValue placeholder="Sport" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sports</SelectItem>
            {sports.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={value.league} onValueChange={(v) => onChange({ ...value, league: v })}>
          <SelectTrigger className="h-10 rounded-md bg-background text-xs font-medium">
            <SelectValue placeholder="League" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All leagues</SelectItem>
            {leagues.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={value.market} onValueChange={(v) => onChange({ ...value, market: v })}>
          <SelectTrigger className="h-10 rounded-md bg-background text-xs font-medium">
            <SelectValue placeholder="Market" />
          </SelectTrigger>
          <SelectContent>
            {marketOptions.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showKickoff && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {kickoffOptions.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => onChange({ ...value, kickoff: k.id })}
              className={`shrink-0 rounded-md border px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                value.kickoff === k.id
                  ? "border-odds-active bg-odds-active text-odds-active-foreground"
                  : "border-border bg-secondary text-secondary-foreground hover:border-accent/50"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function filterMatches(all: typeof matches, f: SportsFilterState) {
  if (!Array.isArray(all)) return [];
  return all.filter((m) => {
    if (!m) return false;
    if (f.sport !== "all" && (m.sport || "").toLowerCase() !== f.sport.toLowerCase()) {
      return false;
    }
    if (f.league !== "all" && (m.league || "").toLowerCase() !== f.league.toLowerCase()) {
      return false;
    }
    if (f.kickoff !== "all" && m.day !== f.kickoff) {
      return false;
    }
    if (
      f.market !== "all" &&
      (!Array.isArray(m.markets) || !m.markets.some((mk) => mk.id === f.market))
    ) {
      return false;
    }
    return true;
  });
}
