# Explanation & Implementation Plan — Live Games Odds & Locked States

## 1. Why Live Games Appear Locked

In live sports betting feeds, odds are locked (`🔒 Locked`) under two specific conditions:

1. **Bookmaker Market Suspension**: During active matches, live bookmakers automatically suspend/lock betting markets (`b: 1` or `m.b: 1`) during key match events (e.g. goals, VAR checks, red cards, penalties, dangerous attacks, or half-time breaks).
2. **Zero / Unpriced Odds**: When a market outcome has no active price or `v <= 0` in the live Socket.IO buffer payload, the system marks the selection as `locked: true` to protect players from staking on invalid zero prices.
3. **HTTP Fallback Fixtures**: When live socket matches are connecting or falling back to HTTP prematch fixtures, missing live market streams previously defaulted to `odds: 0, locked: true`.

---

## 2. User Review & Confirmed Strategy

> [!IMPORTANT]
> Based on your confirmed choices:
> - **Suspended Market Handling**: Maintain the `🔒 Locked` indicator whenever the bookmaker socket transmits `b > 0` or `v <= 0`, ensuring players are notified when markets are temporarily closed by the provider.
> - **Raw Odds Decoding**: Strictly use raw odd values directly from `item.v` or `item.p / 100` without artificial odds synthesis.
> - **Fallback Odds Enhancement**: Update fallback HTTP live fixtures to carry active prices from the main fixture feed so live preview cards display playable odds prior to live socket packet arrival.

---

## 3. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────┐
│  Socket.IO Stream (wss://socket.smbet.net)│
└────────────────────┬─────────────────────┘
                     │ (Decodes binary buffers)
                     ▼
┌──────────────────────────────────────────┐
│  adaptLiveGame (src/lib/matches-adapter.ts)│
├──────────────────────────────────────────┤
│  - If item.b > 0 or m.b > 0 -> Locked    │
│  - If odd.v <= 0 -> Locked               │
│  - Else -> Playable Odds                 │
└────────────────────┬─────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────┐
│  MatchCard & Match Detail UI             │
│  Display 🔒 Locked or clickable odds    │
└──────────────────────────────────────────┘
```

---

## 4. Proposed Code Adjustments

1. **`src/lib/matches-adapter.ts`**:
   - Refine `adaptLiveGame` fallback markets so fallback HTTP live matches inherit active prematch market odds instead of zeroed locked stubs.
   - Maintain strict `isBlocked = Boolean(item.b || m.b || oddVal <= 0)` check for real-time socket events.
2. **`src/hooks/use-live-games.ts`**:
   - Ensure initial HTTP fallback matches copy full playable markets from `adaptPrematchGame` while awaiting live socket data.

---

## 5. Verification Plan

1. **Build & Lint Check**: Co-execute `compile_applet` and `lint_applet` to ensure zero compilation or linter errors.
2. **Runtime Test**: Verify live matches display active clickable odds when prices are positive, and show `🔒 Locked` when bookmaker markets are suspended or unpriced.
