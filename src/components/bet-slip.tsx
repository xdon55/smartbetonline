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
import { Trash2, X, Ticket, Copy } from "lucide-react";
import { toast } from "sonner";
import { useBetSlip } from "@/lib/betslip";
import { formatUgx } from "@/lib/betting-data";

/** One-tap stake shortcuts (UGX). */
const quickStakes = [1000, 2000, 5000, 10000];

/** Shared slip content: selections list, stake controls, totals, actions. */
function SlipBody() {
  const { selections, remove, clear, stake, setStake, totalOdds, potentialWin, placeBet } =
    useBetSlip();
  const [bookingCode, setBookingCode] = useState<string | null>(null);

  if (!selections.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <Ticket className="h-8 w-8 text-muted-foreground" />
        <p className="text-[0.7rem] font-semibold">Your bet slip is empty</p>
        <p className="text-[0.6rem] text-muted-foreground">Tap any odds to add a selection.</p>
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
                stake === v ? "bg-odds-active text-odds-active-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              {v / 1000}k
            </button>
          ))}
        </div>

        <label className="flex items-center justify-between gap-3 rounded-md border border-input px-3 py-2">
          <span className="text-[0.6rem] font-semibold text-muted-foreground">Stake (UGX)</span>
          <input
            type="number"
            min={500}
            step={500}
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-28 bg-transparent text-right text-[0.7rem] font-bold tabular-nums outline-none"
          />
        </label>

        <div className="flex items-center justify-between text-[0.6rem] font-semibold text-muted-foreground">
          <span>Total odds</span>
          <span className="text-[0.7rem] font-bold tabular-nums text-foreground">{totalOdds.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-[0.6rem] font-semibold text-muted-foreground">
          <span>Potential win</span>
          <span className="text-[0.7rem] font-bold tabular-nums text-accent">{formatUgx(potentialWin)}</span>
        </div>

        {bookingCode && (
          <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2">
            <span className="font-display text-[0.8rem] font-bold tracking-widest">{bookingCode}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(bookingCode);
                toast.success("Booking code copied");
              }}
              className="inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            const code = `SB${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
            setBookingCode(code);
            navigator.clipboard?.writeText(code);
            toast.success(`Booking code ${code} created and copied`);
          }}
          className="w-full rounded-md border border-input py-2.5 text-[0.6rem] font-bold uppercase tracking-wide transition-colors hover:bg-muted"
        >
          Create booking code
        </button>

        <button
          type="button"
          onClick={() => {
            const bet = placeBet();
            if (bet) {
              setBookingCode(null);
              toast.success(`Bet placed · code ${bet.code}`);
            }
          }}
          className="w-full rounded-md bg-accent py-3 text-[0.7rem] font-bold uppercase tracking-wide text-accent-foreground transition-opacity hover:opacity-90"
        >
          Place bet
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
        <div className="brand-gradient border-b border-surface-foreground/10 px-4 py-3 font-display text-[0.7rem] font-semibold text-surface-foreground">
          Bet slip
        </div>
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
            <span className="font-display text-[0.7rem] font-bold uppercase tracking-wide">Bet slip</span>
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

