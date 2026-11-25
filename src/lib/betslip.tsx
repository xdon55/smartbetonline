/**
 * betslip.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * GLOBAL BET SLIP STATE (React context).
 *
 * Integrated with:
 * - SmartBet Online Ticket API (POST /api/Ticket)
 * - SmartBet Online Booking API (POST /api/Ticket/Booking)
 * - SmartBet Online Bet History API (GET /api/Online/MyBets)
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
import { ApiError, smartBetApi, type TicketPayload, type OnlineSettings } from "./api-smartbet";
import { formatUgx, type Match } from "./betting-data";
import { useWalletContext } from "./wallet-context";
import { useAuth } from "@/hooks/use-auth";
import { saveBookingCode, retrieveBookingCode } from "./supabase-sportsbook";

/** One leg on the slip. `id` must be unique per match+market+outcome. */
export type Selection = {
  id: string;
  matchId: string;
  match: string;
  market: string;
  pick: string;
  odds: number;
  betCategory?: string;
  line?: number | string | null;
  matchOddId?: number;
  bookMakerId?: number;
  isLive?: boolean;
};

/** A submitted bet ("receipt") returned by the SmartBet API. */
export type PlacedBet = {
  id: string;
  code: string;
  placedAt: string;
  stake: number;
  totalOdds: number;
  potential: number;
  status: "open" | "won" | "lost";
  selections: Selection[];
};

export function mapSelectionLeg(leg: Record<string, unknown>, fallbackId: string): Selection {
  const matchId = String(
    leg["matchId"] ?? leg["MatchId"] ?? leg["originalMatchId"] ?? leg["OriginalMatchId"] ?? "",
  ).trim();
  return {
    id: String(leg["id"] ?? fallbackId),
    matchId,
    match: String(
      leg["match"] ??
        leg["matchName"] ??
        leg["MatchName"] ??
        (matchId ? `Match #${matchId}` : "Fixture"),
    ),
    market: String(leg["market"] ?? leg["betCategory"] ?? leg["BetCategory"] ?? "1X2"),
    pick: String(leg["pick"] ?? leg["betOption"] ?? leg["BetOption"] ?? ""),
    odds: Number(leg["odds"] ?? leg["odd"] ?? leg["Odd"] ?? 1),
    isLive: Boolean(leg["isLive"] ?? leg["IsLive"]),
  };
}

function normalizeFixtureTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+vs\.?\s+|\s+v\s+|\s+-\s+/g, " v ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createLiveMatchLookup(
  liveMatches: Match[],
): (selection: Selection) => Match | undefined {
  const byId = new Map<string, Match>();
  const byTitle = new Map<string, Match>();

  for (const m of liveMatches) {
    if (!m.live) continue;
    byId.set(String(m.id).trim(), m);
    byTitle.set(normalizeFixtureTitle(`${m.home} v ${m.away}`), m);
  }

  return (selection: Selection) => {
    const cleanId = String(selection.matchId || "").trim();
    if (cleanId) {
      const idHit = byId.get(cleanId);
      if (idHit) return idHit;
    }
    const normalized = normalizeFixtureTitle(selection.match || "");
    if (normalized) {
      return byTitle.get(normalized);
    }
    return undefined;
  };
}

export function mapApiBetToPlacedBet(row: Record<string, unknown>): PlacedBet {
  const id = String(row["ReceiptId"] ?? row["receiptId"] ?? row["BookingCode"] ?? row["id"] ?? "");
  const code = String(row["BookingCode"] ?? row["bookingCode"] ?? row["ReceiptId"] ?? id);
  const rawSelections = Array.isArray(row["selections"])
    ? (row["selections"] as Array<Record<string, unknown>>)
    : Array.isArray(row["Selections"])
      ? (row["Selections"] as Array<Record<string, unknown>>)
      : [];

  const selections: Selection[] = rawSelections.map((leg, idx) =>
    mapSelectionLeg(leg, `leg-${id}-${idx}`),
  );

  const rawDate = row["Date"] ?? row["date"] ?? row["createdAt"];
  const formattedDate = rawDate
    ? new Date(String(rawDate)).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const rawStatus = String(row["Status"] ?? row["status"] ?? "open").toLowerCase();
  const status: "open" | "won" | "lost" =
    rawStatus === "won" ? "won" : rawStatus === "lost" ? "lost" : "open";

  return {
    id,
    code,
    placedAt: formattedDate,
    stake: Number(row["Stake"] ?? row["stake"] ?? row["TotalStake"] ?? 0),
    totalOdds: Number(row["Odds"] ?? row["odds"] ?? row["TotalOdds"] ?? 1),
    potential: Number(row["Payout"] ?? row["payout"] ?? row["PotentialPayout"] ?? 0),
    status,
    selections,
  };
}

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
  open: boolean;
  setOpen: (v: boolean) => void;
  bets: PlacedBet[];
  betsLoading: boolean;
  refreshBets: () => Promise<PlacedBet[]>;
  placeBetAsync: () => Promise<PlacedBet>;
  createBookingAsync: () => Promise<string>;
  loadBookingCode: (code: string) => Promise<{ count: number; totalOdds: number }>;
  loading: boolean;
  settings: OnlineSettings;
};

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

const STORAGE_KEY_SLIP = "smartbet_draft_slip";
const LEGACY_BETS_STORAGE_KEY = "smartbet_placed_bets";

const isSupabaseConfigured =
  typeof import.meta !== "undefined" &&
  Boolean(import.meta.env?.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY);

/** Provider mounted once in src/routes/__root.tsx around the whole app. */
export function BetSlipProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { balance, syncBalance, refresh: refreshWallet } = useWalletContext();
  const [selections, setSelections] = useState<Selection[]>([]);
  const [stake, setStake] = useState(2000);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [betsLoading, setBetsLoading] = useState(false);
  const [settings, setSettings] = useState<OnlineSettings>({
    MinStake: 500,
    MaxStake: 50000000,
    MaxPayOut: 500000000,
  });

  // Load online settings on mount & purge any legacy localStorage bets cache
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_BETS_STORAGE_KEY);
      const savedSlip = localStorage.getItem(STORAGE_KEY_SLIP);
      if (savedSlip) {
        const parsed = JSON.parse(savedSlip);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelections(parsed);
        }
      }
    } catch {
      // Ignore storage errors
    }

    smartBetApi
      .getOnlineSettings()
      .then((cfg) => {
        if (cfg && typeof cfg.MinStake === "number") {
          setSettings(cfg);
        }
      })
      .catch(() => {});
  }, []);

  const refreshBets = useCallback(async (): Promise<PlacedBet[]> => {
    if (!isAuthenticated) {
      setBets([]);
      return [];
    }

    setBetsLoading(true);
    try {
      const rows = await smartBetApi.getMyBets();
      if (!Array.isArray(rows)) {
        setBets([]);
        return [];
      }
      const mapped = rows
        .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
        .map(mapApiBetToPlacedBet);
      setBets(mapped);
      return mapped;
    } catch {
      setBets([]);
      return [];
    } finally {
      setBetsLoading(false);
    }
  }, [isAuthenticated]);

  // Hydrate bet history exclusively from API whenever auth state settles
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setBets([]);
      return;
    }
    void refreshBets();
  }, [authLoading, isAuthenticated, refreshBets]);

  // Sync draft slip to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SLIP, JSON.stringify(selections));
    } catch {
      // Ignore storage errors
    }
  }, [selections]);

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

  const totalOdds = useMemo(() => selections.reduce((acc, s) => acc * s.odds, 1), [selections]);
  const potentialWin = selections.length ? Math.round(stake * totalOdds) : 0;

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
    return 100;
  }, [selections.length]);

  const bonusAmount = useMemo(() => {
    if (!potentialWin || !bonusPercent) return 0;
    const netProfit = Math.max(0, potentialWin - stake);
    return Math.round(netProfit * (bonusPercent / 100));
  }, [potentialWin, stake, bonusPercent]);

  const totalReturnWithBonus = potentialWin + bonusAmount;

  const buildTicketPayload = useCallback((): TicketPayload => {
    const isAnyLive = selections.some((s) => s.isLive);
    return {
      betData: selections.map((s) => ({
        match: s.match,
        market: s.market,
        betCategory: s.betCategory || (s.market.toLowerCase().includes("goal") ? "ou" : "1x2"),
        betOption: s.pick,
        bookMakerId: s.bookMakerId || 1,
        line:
          s.line !== undefined &&
          s.line !== null &&
          s.line !== "" &&
          Number.isFinite(Number(s.line))
            ? Number(s.line)
            : null,
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

  const createBookingAsync = useCallback(async (): Promise<string> => {
    if (!selections.length) throw new Error("Bet slip is empty");

    setLoading(true);
    const payload = buildTicketPayload();

    try {
      const res = await smartBetApi.createBooking(payload);
      const code = res.bookingCode || res.BookingCode || res.code || res.Code || "";
      if (!code) {
        throw new Error("Booking code was not returned by server.");
      }

      if (isSupabaseConfigured) {
        try {
          await saveBookingCode({
            code,
            selections,
            stake,
            totalOdds,
          });
        } catch {
          // Optional persistence
        }
      }

      return code;
    } finally {
      setLoading(false);
    }
  }, [selections, buildTicketPayload, totalOdds, stake]);

  const placeBetAsync = useCallback(async (): Promise<PlacedBet> => {
    if (!isAuthenticated) {
      throw new Error("Please sign in to place a bet.");
    }
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
    if (balance !== null && stake > balance) {
      throw new Error(`Insufficient wallet balance (${formatUgx(balance)} available)`);
    }

    setLoading(true);
    const payload = buildTicketPayload();
    const currentSelections = [...selections];
    const odds = totalOdds;
    const computedPotential = Math.round(stake * odds);

    try {
      const res = await smartBetApi.submitTicket(payload);
      const resObj = res as Record<string, unknown>;
      const ticketId = String(res.receiptId || resObj.ReceiptId || "");
      const code = String(res.bookingCode || resObj.BookingCode || ticketId);

      const remoteBalance =
        typeof res.balance === "number"
          ? res.balance
          : typeof resObj.Balance === "number"
            ? (resObj.Balance as number)
            : null;
      if (remoteBalance !== null) {
        syncBalance(remoteBalance);
      } else if (typeof balance === "number") {
        syncBalance(Math.max(0, balance - stake));
      }

      const placed: PlacedBet = {
        id: ticketId || code,
        code: code || ticketId,
        placedAt: new Date().toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        stake,
        totalOdds: Number(odds.toFixed(2)),
        potential: computedPotential,
        status: "open",
        selections: currentSelections,
      };

      setSelections([]);
      setOpen(false);

      await Promise.allSettled([refreshBets(), refreshWallet()]);

      return placed;
    } catch (err) {
      if (err instanceof ApiError && err.status && err.status >= 400 && err.status < 500) {
        throw err;
      }
      throw err instanceof Error ? err : new Error("Failed to submit bet ticket");
    } finally {
      setLoading(false);
    }
  }, [
    isAuthenticated,
    selections,
    buildTicketPayload,
    totalOdds,
    stake,
    balance,
    settings,
    totalReturnWithBonus,
    syncBalance,
    refreshBets,
    refreshWallet,
  ]);

  const loadBookingCode = useCallback(
    async (rawCode: string): Promise<{ count: number; totalOdds: number }> => {
      const clean = rawCode.trim().toUpperCase();
      if (!clean) throw new Error("Please enter a booking code");

      setLoading(true);
      try {
        // 1. Try SmartBet Online ticket selections API
        try {
          const remoteRes = await smartBetApi.getTicketSelections(clean);
          const remoteList = Array.isArray(remoteRes)
            ? remoteRes
            : (remoteRes as { selections?: unknown[] })?.selections;

          if (Array.isArray(remoteList) && remoteList.length > 0) {
            const loaded: Selection[] = remoteList.map((raw, idx) => {
              const leg = raw as Record<string, unknown>;
              const matchId = String(leg.MatchId ?? leg.matchId ?? "");
              const market = String(leg.BetCategory ?? leg.betCategory ?? leg.market ?? "1X2");
              const pick = String(leg.BetOption ?? leg.betOption ?? leg.pick ?? "1");
              return {
                id: String(leg.id ?? `${matchId}-${market}-${pick}-${idx}`),
                matchId,
                match: String(leg.MatchName ?? leg.match ?? `Match #${matchId}`),
                market,
                pick,
                odds: Number(leg.Odd ?? leg.odd ?? leg.odds ?? 1),
              };
            });
            setSelections(loaded);
            setOpen(true);
            const computedOdds = loaded.reduce((acc, s) => acc * s.odds, 1);
            return { count: loaded.length, totalOdds: Number(computedOdds.toFixed(2)) };
          }
        } catch {
          // Fall through to Supabase booking lookup if configured
        }

        if (isSupabaseConfigured) {
          const found = await retrieveBookingCode(clean);
          if (found && Array.isArray(found.selections) && found.selections.length > 0) {
            setSelections(found.selections);
            if (typeof found.stake === "number" && found.stake >= 500) {
              setStake(found.stake);
            }
            setOpen(true);
            return { count: found.selections.length, totalOdds: found.totalOdds };
          }
        }

        throw new Error(`Booking code ${clean} was not found`);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

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
    betsLoading,
    refreshBets,
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
