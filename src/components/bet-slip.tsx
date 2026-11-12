/**
 * bet-slip.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The bet slip UI. Renders three variants from the same SlipBody:
 *   1. Desktop docked sidebar (stationary column in the page grid).
 *   2. Mobile floating summary bar (selections count, total odds, potential).
 *   3. Mobile fullscreen overlay.
 * State lives in lib/betslip.tsx; this component only reads/writes it.
 * "Create booking code" generates a shareable code for the current
 * selections; "Place bet" calls placeBet() (mock — wire to bets API).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Trash2, X, Ticket, Copy, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useBetSlip } from "@/lib/betslip";
import { formatUgx } from "@/lib/betting-data";

/** One-tap stake shortcuts (UGX). */
const quickStakes = [1000, 2000, 5000, 10000];

/** Shared slip content: selections list, stake controls, totals, actions. */
function SlipBody() {
  const {
    selections,
    remove,
    clear,
    stake,
    setStake,
    totalOdds,
    potentialWin,
    bonusPercent,
    bonusAmount,
    totalReturnWithBonus,
    placeBetAsync,
    createBookingAsync,
    loadBookingCode,
    loading,
    settings,
  } = useBetSlip();
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  const handleLoadCode = async (codeToLoad: string) => {
    if (!codeToLoad.trim()) return;
    setLoadingCode(true);
    try {
      const res = await loadBookingCode(codeToLoad);
      toast.success(`Loaded ${res.count} selections with total odds @${res.totalOdds.toFixed(2)}`);
      setInputCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load booking code");
    } finally {
      setLoadingCode(false);
    }
  };

  if (!selections.length) {
    return (
      <div className="flex h-full flex-col justify-between p-4 text-center">
        <div className="flex flex-col items-center justify-center gap-2 py-8">
          <Ticket className="h-8 w-8 text-muted-foreground" />
          <p className="text-[0.75rem] font-bold">Your bet slip is empty</p>
          <p className="text-[0.65rem] text-muted-foreground">
            Tap any odds to add a selection, or load a saved booking code.
          </p>
          <Link
            to="/my-bets"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/80 px-3 py-1.5 text-xs font-bold text-secondary-foreground transition-all hover:border-accent/60 hover:bg-secondary hover:text-foreground"
          >
            <Receipt className="h-3.5 w-3.5 text-accent" />
            View my bets
          </Link>
        </div>

        {/* Load Booking Code Widget */}
        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-left">
          <label
            htmlFor="empty-slip-code"
            className="block text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground mb-1.5"
          >
            Load Booking Code
          </label>
          <div className="flex gap-1.5">
            <input
              id="empty-slip-code"
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="e.g. SB7HQ21"
              className="min-w-0 flex-1 rounded border border-input bg-card px-2.5 py-1.5 font-mono text-xs uppercase tracking-wider outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              disabled={loadingCode || !inputCode.trim()}
              onClick={() => handleLoadCode(inputCode)}
              className="rounded bg-primary dark:bg-accent px-3 py-1.5 text-xs font-bold uppercase text-primary-foreground dark:text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loadingCode ? "Loading..." : "Load"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <p className="text-[0.7rem] font-bold">{selections.length} selections</p>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 text-[0.6rem] font-semibold text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear all
        </button>
      </div>

      <div className="hover-scrollbar">
        {selections.map((s) => (
          <div key={s.id} className="flex items-start gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.7rem] font-bold">{s.match}</p>
              <p className="text-[0.6rem] text-muted-foreground">
                {s.market} · <span className="text-foreground font-semibold">{s.pick}</span>
              </p>
            </div>
            <span className="text-[0.7rem] font-bold tabular-nums">{s.odds.toFixed(2)}</span>
            <button type="button" aria-label="Remove selection" onClick={() => remove(s.id)}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t border-border bg-card px-4 py-3">
        <div className="flex gap-2">
          {quickStakes.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setStake(v)}
              className={`flex-1 rounded-md py-1.5 text-[0.6rem] font-bold tabular-nums transition-colors ${
                stake === v
                  ? "bg-odds-active text-odds-active-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {v / 1000}k
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <label
            className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
              stake < settings.MinStake || stake > settings.MaxStake
                ? "border-destructive/60 bg-destructive/10"
                : "border-input"
            }`}
          >
            <span className="text-[0.6rem] font-semibold text-muted-foreground">Stake (UGX)</span>
            <input
              type="number"
              min={settings.MinStake}
              max={settings.MaxStake}
              step={500}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              className="w-28 bg-transparent text-right text-[0.7rem] font-bold tabular-nums outline-none"
            />
          </label>
          {stake < settings.MinStake && (
            <p className="text-[0.55rem] font-semibold text-destructive">
              Min stake is {formatUgx(settings.MinStake)}
            </p>
          )}
          {stake > settings.MaxStake && (
            <p className="text-[0.55rem] font-semibold text-destructive">
              Max stake is {formatUgx(settings.MaxStake)}
            </p>
          )}
          {totalReturnWithBonus > settings.MaxPayOut && (
            <p className="text-[0.55rem] font-semibold text-destructive">
              Max payout limit is {formatUgx(settings.MaxPayOut)}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-[0.6rem] font-semibold text-muted-foreground">
          <span>Total odds</span>
          <span className="text-[0.7rem] font-bold tabular-nums text-foreground">
            {totalOdds.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[0.6rem] font-semibold text-muted-foreground">
          <span>Potential win</span>
          <span className="text-[0.7rem] font-bold tabular-nums text-foreground">
            {formatUgx(potentialWin)}
          </span>
        </div>

        {bonusPercent > 0 && (
          <div className="flex items-center justify-between text-[0.6rem] font-semibold text-amber-500">
            <span>Multi-bet Boost ({bonusPercent}%)</span>
            <span className="text-[0.7rem] font-bold tabular-nums text-amber-500">
              +{formatUgx(bonusAmount)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-[0.6rem] font-bold text-muted-foreground pt-1 border-t border-border">
          <span>Total Return</span>
          <span className="text-[0.75rem] font-black tabular-nums text-accent">
            {formatUgx(totalReturnWithBonus)}
          </span>
        </div>

        {bookingCode && (
          <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2">
            <span className="font-display text-[0.8rem] font-bold tracking-widest text-primary dark:text-accent">
              {bookingCode}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(bookingCode);
                toast.success("Booking code copied to clipboard");
              }}
              className="inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase hover:opacity-80"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
        )}

        <button
          type="button"
          disabled={actionPending || loading}
          onClick={async () => {
            setActionPending(true);
            try {
              const code = await createBookingAsync();
              setBookingCode(code);
              navigator.clipboard?.writeText(code);
              toast.success(`Booking code ${code} created and copied!`);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to book slip");
            } finally {
              setActionPending(false);
            }
          }}
          className="w-full rounded-md border border-input py-2.5 text-[0.6rem] font-bold uppercase tracking-wide transition-colors hover:bg-muted disabled:opacity-50"
        >
          {actionPending ? "Generating..." : "Create booking code"}
        </button>

        <button
          type="button"
          disabled={
            actionPending ||
            loading ||
            stake < settings.MinStake ||
            stake > settings.MaxStake ||
            totalReturnWithBonus > settings.MaxPayOut
          }
          onClick={async () => {
            setActionPending(true);
            try {
              const bet = await placeBetAsync();
              setBookingCode(null);
              toast.success(`Bet placed successfully! Ticket: ${bet.code}`);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Bet placement failed");
            } finally {
              setActionPending(false);
            }
          }}
          className="w-full rounded-md bg-accent py-3 text-[0.7rem] font-bold uppercase tracking-wide text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {actionPending ? "Submitting bet..." : "Place bet"}
        </button>
      </div>
    </div>
  );
}

export function BetSlip() {
  const { selections, open, setOpen, potentialWin, totalOdds } = useBetSlip();

  return (
    <>
      {/* Desktop docked slip */}
      <aside className="no-scrollbar hidden h-full min-w-0 flex-col overflow-y-auto rounded-md border border-border bg-card shadow-[var(--shadow-card)] md:flex">
        <div className="min-h-0 flex-1">
          <SlipBody />
        </div>
      </aside>

      {/* Mobile floating bar */}
      {selections.length > 0 && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed inset-x-3 bottom-16 z-40 flex items-center justify-between gap-3 rounded-lg bg-accent px-4 py-3 text-accent-foreground shadow-[var(--shadow-lift)] md:hidden"
        >
          <span className="text-[0.7rem] font-bold">
            {selections.length} selection{selections.length > 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-3 text-[0.7rem] font-bold tabular-nums">
            <span className="opacity-80">@ {totalOdds.toFixed(2)}</span>
            {formatUgx(potentialWin)}
          </span>
        </button>
      )}

      {/* Mobile fullscreen slip */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-card md:hidden">
          <div className="flex items-center justify-between brand-gradient px-4 py-3 text-surface-foreground">
            <span className="font-display text-[0.7rem] font-bold uppercase tracking-wide">
              Bet slip
            </span>
            <button type="button" aria-label="Close bet slip" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto hover-scrollbar">
            <SlipBody />
          </div>
        </div>
      )}
    </>
  );
}
