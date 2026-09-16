# SMARTBET — Phase roadmap from the master specification

## Where we are today

We have a complete **mock front end**: no accounts, no money, no server. Everything
lives in the browser from `src/lib/betting-data.ts` and `src/lib/casino-data.ts`.

Done (spec sections 6-12, 17, 72-73, 93-95):
- Brand, light/dark themes, persisted theme, typography, fixed header + product menu
- Home (banner, big games carousel, multiple of the day, sports list, trending games)
- Sports, Live, match detail with extra markets, search, country flags
- Bet slip (singles/accumulator display, total odds, booking code generation, mobile fullscreen)
- My Bets list + receipt detail, open/settled filter
- Auth, Deposit, Withdraw, Transactions, Booking code screens — all visual only
- Casino, Aviator, Crash lobbies with filters and sorting
- Footer, responsible-gaming 25+ notice, social links

Not started: everything server-side. That is the whole remainder of the spec.

## Architecture decision (differs from the spec, deliberately)

The spec proposes NestJS + self-hosted PostgreSQL + Redis + BullMQ + Docker.
This project runs on TanStack Start with Lovable Cloud (managed Postgres, auth,
storage, background functions). I will keep the spec's **domain boundaries** and
**server-authority rules** exactly, and map its infrastructure onto our stack:

| Spec | Here |
|---|---|
| NestJS modules | `src/modules/<domain>/` — each with types, service, server functions |
| API gateway | TanStack server functions; webhooks under `src/routes/api/public/*` |
| PostgreSQL | Lovable Cloud database with row-level security |
| Redis locks | Postgres row locks + unique idempotency keys |
| BullMQ | queue table + scheduled worker endpoints |
| WebSockets | Cloud realtime channels for odds, scores, crash rounds |
| S3 | Cloud storage buckets for KYC and receipts |

Non-negotiables carried over from the spec:
- The browser is never trusted for odds, stake, payout, balance, cash-out value or game result.
- Money moves only through a double-entry ledger; balance is derived, never edited directly.
- Every external provider (odds, mobile money, game studio) sits behind an adapter interface with a mock implementation we can swap out.
- Every state-changing call is idempotent.

## Phases

Phases follow the spec's order, compressed where our stack removes work.

**Phase 1 — Foundation.** Enable Lovable Cloud. Accounts (phone/email + password,
sessions, password reset). Roles in a separate `user_roles` table with a
`has_role()` check — never a column on the profile. Profile, audit log table,
error handling, config table. Front end: real login/register replacing the mock
auth screen, protected routes, account state in the header.

**Phase 2 — Wallet.** `wallets`, `ledger_entries`, `transactions`. Every credit
and debit is two ledger rows; balance is a derived view. Idempotency keys on
every write. Manual deposit/withdraw as internal test operations so the wallet is
provable before real payments. Front end: real balance, real transaction history.

**Phase 3 — Sportsbook core.** Tables for sport, country, competition, event,
market, selection, odds. `OddsProvider` adapter interface with our current mock
data as the first implementation plus a normalization layer mapping provider
market names to canonical types (`MATCH_RESULT`, `OVER_UNDER`, ...). Betting
engine: server re-reads authoritative odds, validates account/stake/limits,
reserves funds, writes bet + ledger atomically, returns a receipt. The bet slip
then talks to the server instead of local state.

**Phase 4 — Betting features.** Accumulators, system bets, server-side booking
codes (the current client-generated code becomes a stored record), bet builder,
full and partial cash-out with a server-computed value.

**Phase 5 — Live.** Live event feed, scores, odds changes pushed over realtime,
market suspension, bet acceptance rules when a price moves, live cash-out.

**Phase 6 — Payments.** `PaymentProvider` abstraction. Mobile money first (MTN,
Airtel) with signed webhooks under `/api/public/*`, pending/confirmed/failed
states and reconciliation. Then cards/bank. Then shop deposits/withdrawals,
cashier shifts, agent network.

**Phase 7 — RGS.** Game sessions, rounds, and a game wallet that debits and
credits through the same ledger. Provider interface so third-party studios and
our own games use one contract.

**Phase 8 — Gaming.** Our own crash/aviator engine with provably-fair seeds and a
server-driven round loop; slots, live casino and virtual sports via provider
adapters; jackpots. The existing lobbies get wired to real sessions.

**Phase 9 — Commercial.** Bonus engine (free bets, deposit bonus, wagering
requirements), promotions, referrals.

**Phase 10 — Control.** Risk limits, fraud rules, KYC with document upload and
review, responsible gaming (limits, self-exclusion, 25+ enforcement), trading
tools, settlement engine, reconciliation runs.

**Phase 11 — Admin.** Admin app: users, bets, payments, events/odds, reports,
analytics, audit trail, configuration. Shop and agent apps.

**Phase 12 — Production.** Security review, load and concurrency testing
(especially double-spend on the wallet), payment and settlement testing,
monitoring, launch.

## How each phase runs

Same loop every time, per the spec's methodology: agree the architecture, define
the tables, define the API contract, build the server side, build or rewire the
screens, test (including concurrency tests for anything touching money), review
security, then move on. No phase starts before the one below it is working.

## Suggested next step

Phase 1 + Phase 2 together — accounts and the wallet ledger. They are the
foundation every other phase writes against, and they turn the current demo into
something with real state behind it.
