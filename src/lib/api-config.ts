/**
 * api-config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Base configuration and endpoints for SmartBet Online.
 *
 * Configured URLs:
 * - gamesBaseUrl: https://api-games.smbet.net/
 *   Provides prematch games, odds, top matches, and country/league structures.
 * - backendUrl: Same-origin in browser ("") routing via server proxy, or
 *   https://online.smartbet.ug/ during direct server calls.
 * - liveGamesBaseUrl: wss://socket.smbet.net
 *   Provides real-time Socket.IO live game events, scores, and odds.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const API_CONFIG = {
  gamesBaseUrl:
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_GAMES_BASE_URL) ||
    "https://api-games.smbet.net",
  backendUrl:
    (typeof window !== "undefined"
      ? ""
      : typeof import.meta !== "undefined" && import.meta.env?.VITE_BACKEND_URL) ||
    "https://online.smartbet.ug",
  liveGamesBaseUrl:
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_LIVE_GAMES_BASE_URL) ||
    "wss://socket.smbet.net",
  defaultTimeoutMs: 20000,
  paymentTimeoutMs: 35000,
} as const;
