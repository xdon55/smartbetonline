/**
 * routes/aviator.tsx — AVIATOR lobby. Thin wrapper around the shared
 * GameLobby component with category="aviator". Game data: lib/casino-data.ts.
 */
import { createFileRoute } from "@tanstack/react-router";
import { GameLobby } from "@/components/game-lobby";

export const Route = createFileRoute("/aviator")({
  head: () => ({
    meta: [
      { title: "Aviator · SMARTBET" },
      {
        name: "description",
        content: "Cash out before the plane flies away. Play Aviator and other flight games in UGX at SMARTBET.",
      },
      { property: "og:title", content: "Aviator · SMARTBET" },
      {
        property: "og:description",
        content: "Cash out before the plane flies away. Flight games in UGX.",
      },
    ],
  }),
  component: () => (
    <GameLobby
      category="aviator"
      title="Aviator"
      tagline="Cash out before the plane flies away."
    />
  ),
});
