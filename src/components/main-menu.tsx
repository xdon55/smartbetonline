/**
 * main-menu.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Left slide-in navigation (hamburger in the header). Contains the product
 * grid plus an expandable Countries & Leagues tree sourced from
 * lib/betting-data.ts. Locks page scroll while open (fullscreen on mobile).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  Dice5,
  Gamepad2,
  Menu,
  Plane,
  Radio,
  Rocket,
  Spade,
  Trophy,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { usePrematchGames } from "@/hooks/use-prematch-games";
import { useLiveGames } from "@/hooks/use-live-games";
import { matches as fallbackMatches, flagFor } from "@/lib/betting-data";

const products = [
  { id: "sports", name: "Sports", icon: Trophy, to: "/sports" as const },
  { id: "live", name: "Live", icon: Radio, to: "/live" as const },
  { id: "casino", name: "Casino", icon: Spade, to: "/casino" as const },
  { id: "aviator", name: "Aviator", icon: Plane, to: "/aviator" as const },
  { id: "crash", name: "Crash", icon: Rocket, to: "/crash" as const },
  { id: "slots", name: "Slots", icon: Dice5, to: null },
  { id: "virtuals", name: "Virtuals", icon: Gamepad2, to: null },
];

export function MainMenu() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { matches: prematchMatches } = usePrematchGames();
  const { matches: liveMatches } = useLiveGames();

  // Combine feeds for full sports coverage
  const allMatches = [
    ...(prematchMatches.length ? prematchMatches : fallbackMatches),
    ...liveMatches,
  ];

  // De-duplicate matches by id
  const uniqueMatchesMap = new Map<string, (typeof allMatches)[0]>();
  for (const m of allMatches) {
    if (m && m.id && !uniqueMatchesMap.has(m.id)) {
      uniqueMatchesMap.set(m.id, m);
    }
  }
  const matchPool = Array.from(uniqueMatchesMap.values());

  // Aggregate real countries and leagues with counts
  type CountryItem = {
    country: string;
    totalGames: number;
    leagues: Array<{ name: string; count: number }>;
  };

  const countriesMap = new Map<string, { totalGames: number; leagues: Map<string, number> }>();

  for (const m of matchPool) {
    const cName = m.country || "International";
    const lName = m.league || "Featured League";

    let cObj = countriesMap.get(cName);
    if (!cObj) {
      cObj = { totalGames: 0, leagues: new Map<string, number>() };
      countriesMap.set(cName, cObj);
    }
    cObj.totalGames++;
    cObj.leagues.set(lName, (cObj.leagues.get(lName) || 0) + 1);
  }

  const realCountriesWithLeagues: CountryItem[] = Array.from(countriesMap.entries())
    .map(([country, data]) => ({
      country,
      totalGames: data.totalGames,
      leagues: Array.from(data.leagues.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.totalGames - a.totalGames);

  // Set default expanded country on first load if not set
  useEffect(() => {
    if (!expanded && realCountriesWithLeagues.length > 0) {
      setExpanded(realCountriesWithLeagues[0].country);
    }
  }, [expanded, realCountriesWithLeagues]);

  // Hide/disable the page scrollbar while the fullscreen menu is open.
  useEffect(() => {
    if (open) {
      document.documentElement.classList.add("overflow-hidden");
    } else {
      document.documentElement.classList.remove("overflow-hidden");
    }
    return () => document.documentElement.classList.remove("overflow-hidden");
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Menu"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-surface-foreground transition-colors hover:bg-surface-foreground/10"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto p-0">
        <SheetHeader className="border-b border-border px-4 py-3 flex flex-row items-center justify-start">
          <SheetTitle className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
            <Link to="/" onClick={() => setOpen(false)} className="hover:opacity-90">
              SMARTBET
            </Link>
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 py-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Products
          </p>
          <div className="grid grid-cols-2 gap-2">
            {products.map((p) =>
              p.to ? (
                <Link
                  key={p.id}
                  to={p.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs font-bold uppercase text-secondary-foreground"
                >
                  <p.icon className="h-4 w-4" />
                  {p.name}
                </Link>
              ) : (
                <span
                  key={p.id}
                  className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs font-bold uppercase text-secondary-foreground/60"
                >
                  <p.icon className="h-4 w-4" />
                  {p.name}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Countries &amp; leagues
            </p>
            <span className="font-mono text-[10px] text-muted-foreground">
              {matchPool.length} games
            </span>
          </div>

          <ul className="space-y-1">
            {realCountriesWithLeagues.map((c) => {
              const isExpanded = expanded === c.country;
              return (
                <li key={c.country}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : c.country)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-2 text-xs font-semibold hover:bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-base leading-none">{flagFor(c.country)}</span>
                      <span className="truncate">{c.country}</span>
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="font-mono text-[11px] font-bold text-muted-foreground">
                        ({c.totalGames})
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>

                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                      isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <ul className="ml-2 border-l border-border pl-3 space-y-0.5 py-1">
                        {c.leagues.map((l) => (
                          <li key={l.name}>
                            <Link
                              to="/sports"
                              search={{ league: l.name }}
                              onClick={() => setOpen(false)}
                              className="flex items-center justify-between rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                              <span className="truncate">{l.name}</span>
                              <span className="ml-2 shrink-0 font-mono text-[10px] font-semibold opacity-70">
                                ({l.count})
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
