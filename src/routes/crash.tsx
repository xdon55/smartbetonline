/**
 * routes/crash.tsx — CRASH lobby. Thin wrapper around the shared
 * GameLobby component with category="crash". Game data: lib/casino-data.ts.
 */
import { createFileRoute } from "@tanstack/react-router";
import { GameLobby } from "@/components/game-lobby";

export const Route = createFileRoute("/crash")({
  head: () => ({
    meta: [
      { title: "Crash games · SMARTBET" },
      {
        name: "description",
        content: "Fast crash and instant win games with multipliers, playable in UGX at SMARTBET.",
      },
      { property: "og:title", content: "Crash games · SMARTBET" },
      {
        property: "og:description",
        content: "Fast crash and instant win games with big multipliers in UGX.",
      },
    ],
  }),
  component: () => (
    <GameLobby
      category="crash"
      title="Crash"
      tagline="Ride the multiplier and cash out in time."
    />
  ),
});
