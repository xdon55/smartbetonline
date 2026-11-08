/**
 * routes/live.tsx — LIVE betting page.
 * Streams real-time in-play fixtures via Socket.IO (wss://socket.smbet.net)
 * with automatic fallback to HTTP games feed polling.
 */
import { createFileRoute } from "@tanstack/react-router";
import { MatchCard } from "@/components/match-card";
import { BetSlip } from "@/components/bet-slip";
import { useLiveGames } from "@/hooks/use-live-games";
import { RotateCw, Radio } from "lucide-react";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live betting · SMARTBET" },
      {
        name: "description",
        content:
          "In-play odds updating real-time via live stream on football, basketball and tennis at SMARTBET.",
      },
      { property: "og:title", content: "Live betting · SMARTBET" },
      {
        property: "og:description",
        content: "In-play odds updating real-time across football, basketball and tennis.",
      },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  const { matches: live, status, loading, refresh, isRealTime } = useLiveGames();

  return (
    <main className="relative mx-auto flex w-full max-w-[968px] gap-2 px-0 py-3 md:grid md:h-[calc(100vh-7.5rem)] md:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] md:overflow-hidden md:px-3">
      <div className="no-scrollbar min-w-0 flex-1 md:h-full md:overflow-y-auto md:py-3">
        <section className="overflow-hidden md:rounded-lg md:border md:border-border">
          <header className="flex items-center justify-between bg-secondary px-3 py-2 font-display text-sm font-bold uppercase tracking-wide text-secondary-foreground">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-live" />
              <span>Live in-play</span>
              {isRealTime && (
                <span className="inline-flex items-center gap-1 rounded bg-accent/20 px-1.5 py-0.5 text-[0.6rem] font-bold text-accent normal-case">
                  <Radio className="h-3 w-3 animate-pulse" /> Live Socket
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono tabular-nums opacity-70">{live.length} GAMES</span>
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                aria-label="Refresh live matches"
                className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
              >
                <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </header>

          {live.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {status === "connecting"
                ? "Connecting to live match stream..."
                : "No in-play games active right now. Check back shortly!"}
            </div>
          ) : (
            live.map((m) => <MatchCard key={m.id} match={m} />)
          )}
        </section>
      </div>
      <BetSlip />
    </main>
  );
}
