/**
 * search-dialog.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Header search. Clicking the icon opens a fullscreen top search bar with a
 * back arrow and live results over the mock fixtures (teams, leagues,
 * countries). Results link to the match detail page. When a real feed is
 * connected, swap the local filter for a search API call.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Search, X } from "lucide-react";
import { matches, flagFor } from "@/lib/betting-data";

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return matches
      .filter((m) =>
        [m.home, m.away, m.league, m.country, m.sport].some((v) =>
          v.toLowerCase().includes(term),
        ),
      )
      .slice(0, 12);
  }, [q]);

  const close = () => {
    setOpen(false);
    setQ("");
  };

  return (
    <>
      <button
        type="button"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-surface-foreground/80 transition-colors hover:bg-surface-foreground/10"
      >
        <Search className="h-4.5 w-4.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background">
          {/* Search header bar */}
          <div className="brand-gradient border-b border-surface-foreground/10 px-3 py-3">
            <div className="mx-auto flex w-full max-w-[968px] items-center gap-2">
              <button
                type="button"
                aria-label="Back"
                onClick={close}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-surface-foreground/80 transition-colors hover:bg-surface-foreground/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="flex flex-1 items-center gap-2 rounded-md border border-accent bg-surface-foreground/10 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-surface-foreground/70" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Team or league..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-surface-foreground outline-none placeholder:text-surface-foreground/50"
                />
                {q && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setQ("")}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-surface-foreground/70 transition-colors hover:bg-surface-foreground/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl">
              {!q.trim() && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Start typing to find an event.
                </p>
              )}
              {q.trim() && !results.length && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No events found for "{q}".
                </p>
              )}
              {results.map((m) => (
                <Link
                  key={m.id}
                  to="/match/$matchId"
                  params={{ matchId: m.id }}
                  onClick={close}
                  className="block border-b border-border px-4 py-3 hover:bg-muted"
                >
                  <p className="text-sm font-bold">
                    {m.home} v {m.away}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {flagFor(m.country)} {m.country} · {m.league} · {m.startsAt}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
