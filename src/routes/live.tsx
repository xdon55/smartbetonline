/**
 * routes/live.tsx — LIVE betting page.
 * Renders every fixture whose `live` field is set (lib/betting-data.ts).
 * Same 60/40 two-column layout as the sports page: matches scroll on the
 * left, the bet slip stays put on the right.
 */
import { createFileRoute } from "@tanstack/react-router";
import { matches } from "@/lib/betting-data";
import { MatchCard } from "@/components/match-card";
import { BetSlip } from "@/components/bet-slip";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live betting · SMARTBET" },
      {
        name: "description",
        content: "In-play odds updating minute by minute on football, basketball and tennis at SMARTBET.",
      },
      { property: "og:title", content: "Live betting · SMARTBET" },
      {
        property: "og:description",
        content: "In-play odds updating minute by minute across football, basketball and tennis.",
      },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  const live = matches.filter((m) => m.live);

  return (
    <>
      <main className="relative mx-auto flex w-full max-w-[968px] gap-2 px-0 py-3 md:grid md:h-[calc(100vh-7.5rem)] md:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] md:overflow-hidden md:px-3">
        <div className="no-scrollbar min-w-0 flex-1 md:h-full md:overflow-y-auto md:py-3">
          <section className="overflow-hidden md:rounded-lg md:border md:border-border">
            <h1 className="flex items-center gap-2 bg-secondary px-3 py-2 font-display text-sm font-bold uppercase tracking-wide text-secondary-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-live" /> Live betting
              <span className="ml-auto text-xs opacity-70">{live.length}&nbsp;GAMES</span>
            </h1>
            {live.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </section>
        </div>
        <BetSlip />
      </main>
    </>
  );
}
