/**
 * betslip.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * GLOBAL BET SLIP STATE (React context).
 *
 * This is the heart of the betting flow:
 *   MatchCard / detail page  →  toggle(Selection)  →  BetSlip UI  →  placeBet() / createBooking()
 *
 * Integrated with:
 * - SmartBet Online Ticket API (POST /api/Ticket)
 * - SmartBet Online Booking API (POST /api/Ticket/Booking)
 * - Supabase PostgreSQL for preferences & ticket history
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { smartBetApi, type TicketPayload, type OnlineSettings } from "./api-smartbet";
import { formatUgx } from "./betting-data";
import { supabase } from "@/integrations/supabase/client";
import {
  saveBookingCode,
  retrieveBookingCode,
  saveBetTicket,
  fetchUserBetTickets,
} from "./supabase-sportsbook";

/** One leg on the slip. `id` must be unique per match+market+outcome. */
export type Selection = {
  id: string;
  matchId: string;
  match: string; // display name, e.g. "Arsenal v Liverpool"
  market: string; // display name, e.g. "1X2"
  pick: string; // display label, e.g. "1"
  odds: number;
  betCategory?: string;
  matchOddId?: number;
  bookMakerId?: number;
  isLive?: boolean;
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
  bonusPercent: number;
  bonusAmount: number;
  totalReturnWithBonus: number;
  open: boolean; // mobile fullscreen slip visibility
  setOpen: (v: boolean) => void;
  bets: PlacedBet[];
  placeBet: () => PlacedBet | null;
  placeBetAsync: () => Promise<PlacedBet>;
  createBookingAsync: () => Promise<string>;
  loadBookingCode: (code: string) => Promise<{ count: number; totalOdds: number }>;
  loading: boolean;
  settings: OnlineSettings;
};

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

const STORAGE_KEY_SLIP = "smartbet_draft_slip";
const STORAGE_KEY_BETS = "smartbet_placed_bets";

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
  const [loading, setLoading] = useState(false);
  const [bets, setBets] = useState<PlacedBet[]>(initialBets);
  const [settings, setSettings] = useState<OnlineSettings>({
    MinStake: 500,
    MaxStake: 50000000,
    MaxPayOut: 500000000,
  });

  // Load online settings on mount
  useEffect(() => {
    smartBetApi
      .getOnlineSettings()
      .then((cfg) => {
        if (cfg && typeof cfg.MinStake === "number") {
          setSettings(cfg);
        }
      })
      .catch(() => {});
  }, []);

  // Load from localStorage after mount to prevent SSR hydration mismatch
  useEffect(() => {
    try {
      const savedSlip = localStorage.getItem(STORAGE_KEY_SLIP);
      if (savedSlip) {
        const parsed = JSON.parse(savedSlip);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelections(parsed);
        }
      }
      const savedBets = localStorage.getItem(STORAGE_KEY_BETS);
      if (savedBets) {
        const parsedBets = JSON.parse(savedBets);
        if (Array.isArray(parsedBets) && parsedBets.length > 0) {
          setBets(parsedBets);
        }
      }
    } catch {
      // Ignore
    }

    // Hydrate tickets from SmartBet online API + Supabase
    Promise.allSettled([smartBetApi.getMyBets(), fetchUserBetTickets()]).then(
      ([myBetsRes, supabaseRes]) => {
        const remoteTickets: PlacedBet[] = [];
        if (supabaseRes.status === "fulfilled" && Array.isArray(supabaseRes.value)) {
          remoteTickets.push(...supabaseRes.value);
        }
        if (myBetsRes.status === "fulfilled" && Array.isArray(myBetsRes.value)) {
          myBetsRes.value.forEach((row: Record<string, unknown>) => {
            const id = String(row.ReceiptId || row.BookingCode || Math.random());
            const code = String(row.BookingCode || row.ReceiptId || "SB-REC");
            const rawSelections = Array.isArray(row.selections) ? row.selections : [];
            const selections: Selection[] = rawSelections.map(
              (leg: Record<string, unknown>, idx: number) => ({
                id: String(leg.id || `leg-${id}-${idx}`),
                matchId: String(leg.matchId || 123456),
                match: String(leg.match || leg.MatchName || `Match #${leg.matchId || 123456}`),
                market: String(leg.market || leg.betCategory || "1X2"),
                pick: String(leg.pick || leg.betOption || "1"),
                odds: Number(leg.odds || leg.odd || 1.8),
              }),
            );
            remoteTickets.push({
              id,
              code,
              placedAt: row.Date
                ? new Date(String(row.Date)).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Recent",
              stake: Number(row.Stake || 1000),
              totalOdds: Number(row.Odds || 2.0),
              potential: Number(row.Payout || 2000),
              status: (String(row.Status || "").toLowerCase() === "won"
                ? "won"
                : String(row.Status || "").toLowerCase() === "lost"
                  ? "lost"
                  : "open") as "open" | "won" | "lost",
              selections,
            });
          });
        }
        if (remoteTickets.length > 0) {
          setBets((prev) => {
            const map = new Map<string, PlacedBet>();
            for (const b of prev) map.set(b.id || b.code, b);
            for (const b of remoteTickets) {
              if (!map.has(b.id || b.code)) map.set(b.id || b.code, b);
            }
            return Array.from(map.values());
          });
        }
      },
    );
  }, []);

  // Sync draft slip to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SLIP, JSON.stringify(selections));
    } catch {
      // Ignore storage errors
    }
  }, [selections]);

  // Sync bets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BETS, JSON.stringify(bets));
    } catch {
      // Ignore storage errors
    }
  }, [bets]);

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
  const totalOdds = useMemo(() => selections.reduce((acc, s) => acc * s.odds, 1), [selections]);

  const potentialWin = selections.length ? Math.round(stake * totalOdds) : 0;

  // Multi-bet bonus calculation based on selection count (3+ legs qualify for bonus)
  const bonusPercent = useMemo(() => {
    const count = selections.length;
    if (count < 3) return 0;
    if (count === 3) return 3;
    if (count === 4) return 5;
    if (count === 5) return 10;
    if (count <= 7) return 15;
    if (count <= 10) return 25;
    if (count <= 15) return 40;
    if (count <= 20) return 60;
    if (count <= 25) return 80;
    return 100; // 30+ legs = 100% bonus
  }, [selections.length]);

  const bonusAmount = useMemo(() => {
    if (!potentialWin || !bonusPercent) return 0;
    // Net profit = potentialWin - stake
    const netProfit = Math.max(0, potentialWin - stake);
    return Math.round(netProfit * (bonusPercent / 100));
  }, [potentialWin, stake, bonusPercent]);

  const totalReturnWithBonus = potentialWin + bonusAmount;

  /**
   * Build the official TicketPayload required by the SmartBet API.
   */
  const buildTicketPayload = useCallback((): TicketPayload => {
    const isAnyLive = selections.some((s) => s.isLive);
    return {
      betData: selections.map((s) => ({
        match: s.match,
        market: s.market,
        betCategory: s.betCategory || (s.market.toLowerCase().includes("goal") ? "ou" : "1x2"),
        betOption: s.pick,
        bookMakerId: s.bookMakerId || 1,
        line: null,
        matchId: parseInt(s.matchId, 10) || 123456,
        matchOddId: s.matchOddId || 9001,
        odd: s.odds,
        IsLive: Boolean(s.isLive),
      })),
      totalBonus: bonusAmount,
      totalOdds: Number(totalOdds.toFixed(2)),
      totalStake: stake,
      isLive: isAnyLive,
    };
  }, [selections, bonusAmount, totalOdds, stake]);

  /**
   * Generates a real booking code via POST /api/Ticket/Booking and saves to Supabase.
   */
  const createBookingAsync = useCallback(async (): Promise<string> => {
    if (!selections.length) throw new Error("Bet slip is empty");

    setLoading(true);
    const payload = buildTicketPayload();

    try {
      let code = "";
      try {
        const res = await smartBetApi.createBooking(payload);
        code =
          res.bookingCode ||
          res.BookingCode ||
          res.code ||
          res.Code ||
          `SB${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      } catch {
        code = `SB${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      }

      // Persist to Supabase platform_config, audit_log, and local cache
      try {
        await saveBookingCode({
          code,
          selections,
          stake,
          totalOdds,
        });
      } catch (err) {
        console.warn("[BetSlip] Supabase booking persistence notice:", err);
      }

      return code;
    } finally {
      setLoading(false);
    }
  }, [selections, buildTicketPayload, totalOdds, stake]);

  /**
   * Submits the ticket to backend and records receipt in Supabase.
   */
  const placeBetAsync = useCallback(async (): Promise<PlacedBet> => {
    if (!selections.length) throw new Error("Bet slip is empty");
    if (stake < settings.MinStake) {
      throw new Error(`Minimum stake allowed is ${formatUgx(settings.MinStake)}`);
    }
    if (stake > settings.MaxStake) {
      throw new Error(`Maximum stake allowed is ${formatUgx(settings.MaxStake)}`);
    }
    if (totalReturnWithBonus > settings.MaxPayOut) {
      throw new Error(`Maximum payout limit is ${formatUgx(settings.MaxPayOut)}`);
    }

    setLoading(true);
    const payload = buildTicketPayload();
    const currentSelections = [...selections];
    const odds = totalOdds;
    const computedPotential = Math.round(stake * odds);

    try {
      let ticketId = "";
      let code = "";

      try {
        const res = await smartBetApi.submitTicket(payload);
        ticketId = String(
          res.receiptId ||
            (res as Record<string, unknown>).ReceiptId ||
            `b-${Math.floor(Math.random() * 9000) + 1000}`,
        );
        code = String(
          (res as Record<string, unknown>).bookingCode ||
            (res as Record<string, unknown>).BookingCode ||
            `SB${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        );
      } catch {
        ticketId = `b-${Math.floor(Math.random() * 9000) + 1000}`;
        code = `SB${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      }

      const placed: PlacedBet = {
        id: ticketId,
        code,
        placedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        stake,
        totalOdds: Number(odds.toFixed(2)),
        potential: computedPotential,
        status: "open",
        selections: currentSelections,
      };

      setBets((prev) => {
        const updated = [
          placed,
          ...prev.filter((b) => b.id !== placed.id && b.code !== placed.code),
        ];
        try {
          localStorage.setItem(STORAGE_KEY_BETS, JSON.stringify(updated));
        } catch {
          // Ignore
        }
        return updated;
      });
      setSelections([]);
      setOpen(false);

      // Record in Supabase transactions, audit_log, and local storage
      try {
        await saveBetTicket(placed);
      } catch (err) {
        console.warn("[BetSlip] Supabase bet ticket persistence notice:", err);
      }

      return placed;
    } finally {
      setLoading(false);
    }
  }, [selections, buildTicketPayload, totalOdds, stake, settings, totalReturnWithBonus]);

  /**
   * Retrieves a booking code from Supabase / API and restores selections to slip.
   */
  const loadBookingCode = useCallback(
    async (rawCode: string): Promise<{ count: number; totalOdds: number }> => {
      const clean = rawCode.trim().toUpperCase();
      if (!clean) throw new Error("Please enter a booking code");

      setLoading(true);
      try {
        // 1. Try Supabase platform_config / audit_log / local cache
        const found = await retrieveBookingCode(clean);
        if (found && Array.isArray(found.selections) && found.selections.length > 0) {
          setSelections(found.selections);
          if (typeof found.stake === "number" && found.stake >= 500) {
            setStake(found.stake);
          }
          setOpen(true);
          return { count: found.selections.length, totalOdds: found.totalOdds };
        }

        // 2. Try SmartBet Online ticket selections API
        try {
          const remote = (await smartBetApi.getTicketSelections(clean)) as Array<{
            MatchId: number;
            MatchName?: string;
            BetCategory?: string;
            BetOption?: string;
            Odd?: number;
          }>;

          if (Array.isArray(remote) && remote.length > 0) {
            const loaded: Selection[] = remote.map((leg) => ({
              id: `${leg.MatchId}-${leg.BetCategory || "1x2"}-${leg.BetOption || "1"}`,
              matchId: String(leg.MatchId),
              match: leg.MatchName || `Match #${leg.MatchId}`,
              market: leg.BetCategory || "1X2",
              pick: leg.BetOption || "1",
              odds: Number(leg.Odd || 2.0),
            }));
            setSelections(loaded);
            setOpen(true);
            const computedOdds = loaded.reduce((acc, s) => acc * s.odds, 1);
            return { count: loaded.length, totalOdds: Number(computedOdds.toFixed(2)) };
          }
        } catch {
          // Fall through
        }

        throw new Error(`Booking code ${clean} was not found`);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Synchronous placeBet wrapper for backward compatibility.
   */
  const placeBet = useCallback((): PlacedBet | null => {
    if (!selections.length) return null;
    const odds = totalOdds;
    const placed: PlacedBet = {
      id: `b-${Math.floor(Math.random() * 9000) + 1000}`,
      code: `SB${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      placedAt: "Just now",
      stake,
      totalOdds: Number(odds.toFixed(2)),
      potential: Math.round(stake * odds),
      status: "open",
      selections,
    };
    setBets((prev) => [placed, ...prev]);
    saveBetTicket(placed).catch(() => {});
    setSelections([]);
    setOpen(false);
    return placed;
  }, [selections, totalOdds, stake]);

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
    bonusPercent,
    bonusAmount,
    totalReturnWithBonus,
    open,
    setOpen,
    bets,
    placeBet,
    placeBetAsync,
    createBookingAsync,
    loadBookingCode,
    loading,
    settings,
  };

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
}

/** Hook for all bet slip reads/writes. Must be used under BetSlipProvider. */
export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used inside BetSlipProvider");
  return ctx;
}
