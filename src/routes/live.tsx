/**
 * routes/live.tsx — LIVE betting page.
 * Streams real-time in-play fixtures via Socket.IO (wss://socket.smbet.net)
 * with automatic fallback to HTTP games feed polling.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MatchCard } from "@/components/match-card";
import { BetSlip } from "@/components/bet-slip";
import { useLiveGames } from "@/hooks/use-live-games";
import { RotateCw, Radio, Loader2, Check } from "lucide-react";

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
  const { matches: live, status, loading, refresh } = useLiveGames();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setJustRefreshed(false);
    await refresh();
    setTimeout(() => {
      setIsRefreshing(false);
      setJustRefreshed(true);
      setTimeout(() => {
        setJustRefreshed(false);
      }, 2500);
    }, 600);
  };

  return (
    <main className="relative mx-auto flex w-full max-w-[968px] gap-2 px-0 py-3 md:grid md:h-[calc(100vh-7.5rem)] md:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] md:overflow-hidden md:px-3">
      <div className="no-scrollbar min-w-0 flex-1 md:h-full md:overflow-y-auto md:py-3">
        <section className="overflow-hidden md:rounded-lg md:border md:border-border">
          <header className="flex items-center justify-between bg-secondary px-3 py-2 font-display text-sm font-bold uppercase tracking-wide text-secondary-foreground">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-live" />
              <span>LIVE</span>
            </div>

            <div className="flex items-center gap-2">
              {justRefreshed && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 animate-in fade-in zoom-in duration-200">
                  <Check className="h-3 w-3" /> Updated
                </span>
              )}
              <span className="text-xs font-mono tabular-nums opacity-70">{live.length} GAMES</span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || isRefreshing}
                aria-label="Refresh live matches"
                title="Refresh live match stream"
                className={`relative rounded p-1 transition-all ${
                  isRefreshing
                    ? "text-accent bg-accent/10"
                    : justRefreshed
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                }`}
              >
                {justRefreshed ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400 animate-in fade-in" />
                ) : (
                  <RotateCw
                    className={`h-3.5 w-3.5 ${isRefreshing || loading ? "animate-spin text-accent" : ""}`}
                  />
                )}
              </button>
            </div>
          </header>

          {loading || (live.length === 0 && status === "connecting") ? (
            <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : live.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No in-play games active right now. Check back shortly!
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
