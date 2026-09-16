/**
 * betslip.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * GLOBAL BET SLIP STATE (React context).
 *
 * This is the heart of the betting flow:
 *   MatchCard / detail page  →  toggle(Selection)  →  BetSlip UI  →  placeBet()
 *
 * INTEGRATION NOTES:
 * - `placeBet()` currently records bets locally in state. Replace its body
 *   with a call to your bet-placement API, then refresh `bets` from the
 *   backend (or keep the optimistic prepend).
 * - Selection ids are `${matchId}-${marketId}-${outcomeId}` — stable keys that
 *   let the UI highlight active odds buttons via `has(id)`.
 * - One pick per (match, market): adding another outcome of the same market
 *   on the same match replaces the previous one.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/** One leg on the slip. `id` must be unique per match+market+outcome. */
export type Selection = {
  id: string;
  matchId: string;
  match: string; // display name, e.g. "Arsenal v Liverpool"
  market: string; // display name, e.g. "1X2"
  pick: string; // display label, e.g. "1"
  odds: number;
};

/** A submitted bet ("receipt") shown on the My Bets pages. */
export type PlacedBet = {
  id: string;
  code: string; // booking-style reference shown to the user
  placedAt: string;
  stake: number; // UGX
  totalOdds: number; // combined accumulator odds
  potential: number; // potential payout in UGX
  status: "open" | "won" | "lost";
  selections: Selection[];
};

/** Everything the context exposes to consumers via useBetSlip(). */
type BetSlipContextValue = {
  selections: Selection[];
  stake: number;
  setStake: (v: number) => void;
  toggle: (s: Selection) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
  totalOdds: number;
  potentialWin: number;
  open: boolean; // mobile fullscreen slip visibility
  setOpen: (v: boolean) => void;
  bets: PlacedBet[];
  placeBet: () => PlacedBet | null;
};

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

/* ── Seed bet history ───────────────────────────────────────────────────────
 * Demo receipts so My Bets isn't empty. TODO(integration): fetch the user's
 * real bet history and drop this constant.
 * ──────────────────────────────────────────────────────────────────────── */
const initialBets: PlacedBet[] = [
  {
    id: "b-201",
    code: "SB4KQ7X",
    placedAt: "Yesterday 19:12",
    stake: 5000,
    totalOdds: 4.42,
    potential: 22100,
    status: "won",
    selections: [
      {
        id: "x1",
        matchId: "m9",
        match: "Express FC v SC Villa",
        market: "1X2",
        pick: "1",
        odds: 2.1,
      },
      {
        id: "x2",
        matchId: "m10",
        match: "Chelsea v Everton",
        market: "Total goals 2.5",
        pick: "Over",
        odds: 2.1,
      },
    ],
  },
  {
    id: "b-202",
    code: "SB9WM2D",
    placedAt: "Today 12:04",
    stake: 10000,
    totalOdds: 3.18,
    potential: 31800,
    status: "open",
    selections: [
      {
        id: "x3",
        matchId: "m11",
        match: "Inter v Napoli",
        market: "Both teams to score",
        pick: "Yes",
        odds: 1.88,
      },
      {
        id: "x4",
        matchId: "m12",
        match: "Bayern München v RB Leipzig",
        market: "1X2",
        pick: "1",
        odds: 1.69,
      },
    ],
  },
];

/** Provider mounted once in src/routes/__root.tsx around the whole app. */
export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<Selection[]>([]);
  const [stake, setStake] = useState(2000); // default stake in UGX
  const [open, setOpen] = useState(false);
  const [bets, setBets] = useState<PlacedBet[]>(initialBets);

  /**
   * Add/remove a selection. Tapping the same odds button again removes it;
   * tapping a different outcome in the same market on the same match swaps it.
   */
  const toggle = useCallback((s: Selection) => {
    setSelections((prev) => {
      if (prev.some((p) => p.id === s.id)) return prev.filter((p) => p.id !== s.id);
      return [...prev.filter((p) => p.matchId !== s.matchId || p.market !== s.market), s];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setSelections((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clear = useCallback(() => setSelections([]), []);

  // Accumulator odds: multiply all leg odds (empty slip = 1).
  const totalOdds = useMemo(
    () => selections.reduce((acc, s) => acc * s.odds, 1),
    [selections],
  );

  const potentialWin = selections.length ? Math.round(stake * totalOdds) : 0;

  /**
   * Submits the current slip as a bet. Uses a functional state update so it
   * always reads the latest selections. TODO(integration): POST to the bets
   * API here; handle insufficient balance / rejected legs from the response.
   */
  const placeBet = useCallback(() => {
    let placed: PlacedBet | null = null;
    setSelections((current) => {
      if (!current.length) return current;
      const odds = current.reduce((acc, s) => acc * s.odds, 1);
      placed = {
        id: `b-${Math.floor(Math.random() * 9000) + 1000}`,
        code: `SB${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        placedAt: "Just now",
        stake,
        totalOdds: Number(odds.toFixed(2)),
        potential: Math.round(stake * odds),
        status: "open",
        selections: current,
      };
      setBets((prev) => [placed as PlacedBet, ...prev]);
      return []; // empty the slip after placing
    });
    setOpen(false); // close the mobile fullscreen slip
    return placed;
  }, [stake]);

  const value: BetSlipContextValue = {
    selections,
    stake,
    setStake,
    toggle,
    remove,
    clear,
    has: (id) => selections.some((s) => s.id === id),
    totalOdds,
    potentialWin,
    open,
    setOpen,
    bets,
    placeBet,
  };

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
}

/** Hook for all bet slip reads/writes. Must be used under BetSlipProvider. */
export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used inside BetSlipProvider");
  return ctx;
}
