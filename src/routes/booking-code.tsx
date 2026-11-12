/**
 * routes/booking-code.tsx — BOOKING CODE page.
 * Lets a user load a shared bet slip from a SmartBet booking code or receipt.
 * Integrated with SmartBet Ticket & Receipt APIs:
 * - GET /api/Bet/Receipt/{receiptId}
 * - GET /api/Receipt/GetById/{receiptId}
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Ticket, ArrowRight, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useBetSlip } from "@/lib/betslip";
import { formatUgx, matches } from "@/lib/betting-data";
import { smartBetApi } from "@/lib/api-smartbet";

export const Route = createFileRoute("/booking-code")({
  head: () => ({
    meta: [
      { title: "Booking code · SMARTBET" },
      {
        name: "description",
        content:
          "Load a SMARTBET booking code to your bet slip, or share your own code with friends.",
      },
      { property: "og:title", content: "Booking code · SMARTBET" },
      { property: "og:description", content: "Load or share a SMARTBET booking code in seconds." },
    ],
  }),
  component: BookingCodePage,
});

function BookingCodePage() {
  const { loadBookingCode, selections, totalOdds, stake } = useBetSlip();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const myCode = "SB7HQ21";

  const load = async () => {
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length < 3) {
      toast.error("Enter a valid booking code");
      return;
    }

    setLoading(true);
    try {
      const res = await loadBookingCode(cleanCode);
      toast.success(
        `Booking code ${cleanCode} loaded ${res.count} selections (@${res.totalOdds.toFixed(2)})!`,
      );
      setCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load booking code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-3 py-6">
      <h1 className="mb-4 font-display text-2xl font-bold uppercase tracking-wide">Booking code</h1>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <Label htmlFor="code">Load a code</Label>
        <div className="flex gap-2">
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. SB7HQ21"
            className="uppercase font-mono tracking-wider"
          />
          <Button type="button" onClick={load} disabled={loading || !code.trim()}>
            {loading ? "Loading..." : "Load"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Enter a booking code created on SMARTBET to load all selections to your slip.
        </p>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Share your slip
        </p>
        <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2.5">
          <span className="flex items-center gap-2 font-display text-lg font-bold tracking-widest text-primary dark:text-accent">
            <Ticket className="h-4 w-4" />
            {myCode}
          </span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(myCode);
              setCopied(true);
              toast.success("Booking code copied to clipboard");
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1 text-xs font-bold uppercase hover:opacity-80"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-accent" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Anyone with this code can instantly load your exact selections.
        </p>
      </section>

      {selections.length > 0 && (
        <section className="mt-4 rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Current Slip Preview
          </p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Selections</span>
              <span className="font-semibold">{selections.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Combined Odds</span>
              <span className="font-bold tabular-nums text-foreground">{totalOdds.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1">
              <span className="text-muted-foreground">Potential Return ({formatUgx(stake)})</span>
              <span className="font-bold tabular-nums text-accent">
                {formatUgx(Math.round(stake * totalOdds))}
              </span>
            </div>
          </div>
          <div className="mt-3">
            <a
              href="/"
              className="inline-flex w-full items-center justify-center gap-1 rounded bg-secondary py-2 text-xs font-semibold hover:bg-secondary/80 transition-colors"
            >
              View on main sportsbook <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </section>
      )}
    </main>
  );
}
