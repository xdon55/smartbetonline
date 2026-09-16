/**
 * routes/booking-code.tsx — BOOKING CODE page (mock UI only).
 * Lets a user load a shared bet slip from a code. Codes generated in
 * components/bet-slip.tsx are random and not yet resolvable — wire lookup
 * to the booking-code API so codes hydrate real selections.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Ticket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useBetSlip } from "@/lib/betslip";
import { formatUgx, matches } from "@/lib/betting-data";

export const Route = createFileRoute("/booking-code")({
  head: () => ({
    meta: [
      { title: "Booking code · SMARTBET" },
      {
        name: "description",
        content: "Load a SMARTBET booking code to your bet slip, or share your own code with friends.",
      },
      { property: "og:title", content: "Booking code · SMARTBET" },
      { property: "og:description", content: "Load or share a SMARTBET booking code in seconds." },
    ],
  }),
  component: BookingCodePage,
});

function BookingCodePage() {
  const { toggle, selections, totalOdds, stake } = useBetSlip();
  const [code, setCode] = useState("");
  const myCode = "SB7HQ21";

  const load = () => {
    if (code.trim().length < 4) {
      toast.error("Enter a valid booking code");
      return;
    }
    const picks = matches.slice(0, 3);
    picks.forEach((m) => {
      const market = m.markets[0];
      const o = market?.outcomes[0];
      if (!market || !o) return;
      toggle({
        id: `${m.id}-${market.id}-${o.id}`,
        matchId: m.id,
        match: `${m.home} v ${m.away}`,
        market: market.name,
        pick: o.label,
        odds: o.odds,
      });
    });
    toast.success(`Booking code ${code.toUpperCase()} loaded to your bet slip`);
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
            className="uppercase"
          />
          <Button type="button" onClick={load}>
            Load
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Codes expire once any event in the booking has started.
        </p>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Share your slip
        </p>
        <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2.5">
          <span className="flex items-center gap-2 font-display text-lg font-bold tracking-widest">
            <Ticket className="h-4 w-4" />
            {myCode}
          </span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(myCode);
              toast.success("Booking code copied");
            }}
            className="inline-flex items-center gap-1 text-xs font-bold uppercase"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>
        <dl className="mt-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Selections</dt>
            <dd className="font-semibold tabular-nums">{selections.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total odds</dt>
            <dd className="font-semibold tabular-nums">
              {selections.length ? totalOdds.toFixed(2) : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Stake</dt>
            <dd className="font-semibold tabular-nums">{formatUgx(stake)}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
