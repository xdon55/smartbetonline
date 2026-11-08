# SmartBet API Full Integration & Resolution Plan

An end-to-end implementation plan addressing all 7 user requirements: unlocking all 697+ prematch games, enabling real-time live match decoding via Protobuf over Socket.IO, activating dynamic sports filters, powering global search, and implementing a server-side proxy for session-based authentication, deposits, and withdrawals.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been established based on your responses:
>
> 1. **Authentication & Payments Routing**: Server-side proxy (`/api/proxy/*`) hosted in `server.ts` forwarding requests with session cookies to `https://online.smartbet.ug/` while bypassing browser cross-origin restrictions, accompanied by resilient Supabase PostgreSQL authentication and wallet fallback.
> 2. **Live Odds Display**: Display a clear **Locked** badge (`🔒 Locked`) when live bookmaker odds are temporarily zero or unavailable during match halts/var checks, ensuring user trust until updated odds are transmitted.
> 3. **Prematch 12-Game Limitation Cause & Fix**: The browser previously fell back to the 12-item seed array because `credentials: "include"` was being sent to `https://api-games.smbet.net/` (which responds with wildcard `Access-Control-Allow-Origin: *`, causing standard browser CORS rejection). Setting `credentials: "omit"` on games feed requests immediately loads all 697+ prematch games.
> 4. **Live Games Protobuf Decoder**: Decode binary Base64 protobuf messages from `wss://socket.smbet.net` (`buffers` event) using the official `bet720_protocol_buffers.Event` proto definitions, extracting real-time match clocks (`tm/tss`), scores (`sc.goal`), team names, and markets.

---

## Proposed Changes by Requirement

### 1. Fetch All Prematch Games in the API (Resolve 12-Game Cap)
- **Problem**: `fetchJson` was sending `credentials: "include"` for all requests. The browser blocked `https://api-games.smbet.net/` because cross-origin credentialed requests cannot accept wildcard `*` origins. This forced the hook to fall back to the 12 static fixtures.
- **Implementation**:
  - Update `fetchJson` in `src/lib/api-smartbet.ts` to only include credentials when targeting `backendUrl`, while setting `credentials: "omit"` for `gamesBaseUrl`.
  - Update `usePrematchGames` in `src/hooks/use-prematch-games.ts` to load all 697 games directly from `smartBetApi.getPrematchFeed()`.
  - Add virtualized/paginated rendering in `src/routes/sports.tsx` and `src/routes/index.tsx` so rendering hundreds of matches remains instantaneous without DOM lag.

### 2. Fetch All Live Games (Socket.IO + Protobuf Decoder)
- **Problem**: The socket was connected to `wss://socket.smbet.net`, but incoming `buffers` payloads are Base64-encoded protobuf messages from `bet720_protocol_buffers.Event` rather than plain JSON arrays.
- **Implementation**:
  - Save the verified proto definitions in `public/protos/` (`event.proto`, `game.proto`, `market.proto`, `odd.proto`, `scores.proto`, `team.proto`).
  - Update `src/lib/socket-live-games.ts` to decode incoming Base64 `buffers` packets via `protobufjs`, extracting `std` (match ID), `t1.n` (home team), `t2.n` (away team), `inf` (league), `sc.goal` (scores), and `bt` (markets/odds).
  - Handle `expired-key` event to cleanly remove completed or archived matches.
  - When live market odds are 0 or locked, display a styled `Locked` state on the card rather than broken odds.

### 3. Enable All Filters on the Sports Page
- **Problem**: The League dropdown in `src/components/sports-filters.tsx` was reading from the static 12-item list, and sport filtering needed to handle real leagues.
- **Implementation**:
  - Dynamically populate the League dropdown from the actual leagues returned across all 697 games in the prematch feed.
  - Implement full filtering in `filterMatches`:
    - **Sport**: Football, Basketball, Tennis, etc.
    - **League**: Real league selections (Premier League, La Liga, Superleague, Bundesliga, Eredivisie, etc.).
    - **Market**: 1X2, Total goals 2.5 (`ou25`), Both teams to score (`btts`), Double chance (`dc`), Draw no bet (`dnb`).
    - **Kickoff**: All, Today, Tomorrow, Day after, This week.

### 4. Make Search Functional
- **Problem**: Search was querying only the initial 12 seed matches.
- **Implementation**:
  - Update `src/components/search-dialog.tsx` to search in real time across the full prematch games feed and live in-play games.
  - Search matches by home team, away team, league name, country, and match ID.
  - Selecting any search result navigates directly to `/match/$matchId` where all real markets for that event are rendered.

### 5. Enable Authentication (Signup and Login API)
- **Implementation**:
  - Add Express proxy route in `src/server.ts` at `/api/proxy/*` forwarding to `https://online.smartbet.ug/api/*` with cookie management.
  - Update `smartBetApi.login()`, `smartBetApi.checkLogin()`, `smartBetApi.register()`, and `smartBetApi.getOTP()` to route through `/api/proxy/Account/*`.
  - In `src/routes/auth.tsx`, wire both **Login** and **Registration** tabs to the real API with field validation (phone, username, password, NIN, OTP verification) and resilient Supabase account sync.

### 6. Enable Deposits and Withdrawals (Mobile Money API)
- **Implementation**:
  - In `src/routes/deposit.tsx`, route mobile money deposit requests through `/api/proxy/Online/MobileMoneyDepositRequest`.
  - Implement live status polling on `/api/proxy/Online/DepositStatus/{code}` with MTN MoMo / Airtel Money prompt instructions.
  - In `src/routes/withdraw.tsx`, route withdrawal requests through `/api/proxy/Online/WithdrawRequest` with OTP challenge confirmation (`ConfirmWithdrawAlt`).
  - Sync successful balance updates to `useWallet` and audit logging.

---

## Verification Plan

### Automated Build & Lint Verification
1. Run `npm run format` with Prettier.
2. Execute `compile_applet` and `lint_applet` in parallel to ensure 0 TypeScript and ESLint errors.
3. Restart development server (`restart_dev_server`).

### Browser & Runtime Verification
1. **Prematch Feed**: Verify `/` and `/sports` display the full list of 697+ real matches with real Premier League, La Liga, and international odds.
2. **Live Feed**: Verify `/live` and home "Live now" sections display active in-play matches decoded from `wss://socket.smbet.net` with live scores and clocks.
3. **Sports Filters**: Test selecting sport, league, market (1X2, OU, BTS, DC), and kickoff date chips to confirm the list filters accurately.
4. **Search Dialog**: Open search, type "Manchester", "Chelsea", "Madrid", or "Athens", and verify matching real games appear and open `/match/:id`.
5. **Authentication Flow**: Test login and registration dialogs on `/auth`.
6. **Wallet Flow**: Test deposit drawer on `/deposit` with phone number and amount, verifying transaction status tracking.
