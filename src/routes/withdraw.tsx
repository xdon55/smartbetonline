/**
 * routes/withdraw.tsx — WITHDRAW page.
 *
 * Presents amount selection and mobile-money style payout options in UGX.
 * For Phase 1/2 this wires to an internal wallet debit so we can prove the
 * ledger before a real payout provider (MTN/Airtel) is integrated.
 * Real withdrawals later will call the same `wallet_transact` RPC once a provider
 * webhook confirms the payout.
 */
import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatUgx } from "@/lib/betting-data";
import { useWallet } from "@/hooks/use-wallet";
import { internalWithdraw } from "@/modules/wallet/wallet.functions";

export const Route = createFileRoute("/withdraw")({
  head: () => ({
    meta: [
      { title: "Withdraw · SMARTBET" },
      {
        name: "description",
        content: "Cash out your SMARTBET winnings to MTN MoMo or Airtel Money in minutes.",
      },
      { property: "og:title", content: "Withdraw · SMARTBET" },
      { property: "og:description", content: "Fast payouts to mobile money in UGX." },
    ],
  }),
  component: WithdrawPage,
});

const methods = [
  { id: "mtn", name: "MTN MoMo", note: "Payout in 2-5 minutes" },
  { id: "airtel", name: "Airtel Money", note: "Payout in 2-5 minutes" },
];

function WithdrawPage() {
  const router = useRouter();
  const { balance, loading, refresh } = useWallet();
  const [method, setMethod] = useState("mtn");
  const [amount, setAmount] = useState(10000);
  const [pending, setPending] = useState(false);
  const fee = Math.round(amount * 0.01);
  const available = balance ?? 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (amount > available) {
      toast.error("Insufficient balance");
      return;
    }
    setPending(true);
    try {
      // Phase 1/2: internal ledger debit. Real payouts will later call the same
      // wallet_transact RPC after a provider webhook confirms the payout.
      await (internalWithdraw as any)({ data: { amount, reference: method } });
      toast.success(`Withdrawal of ${formatUgx(amount)} requested`);
      refresh();
      router.navigate({ to: "/transactions" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-3 py-6">
      <h1 className="mb-1 font-display text-2xl font-bold uppercase tracking-wide">Withdraw</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Withdrawable balance {loading ? "—" : formatUgx(available)}
      </p>

      <div className="space-y-2">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id)}
            className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left ${
              method === m.id ? "border-accent bg-accent/10" : "border-border bg-card"
            }`}
          >
            <span>
              <span className="block text-sm font-semibold">{m.name}</span>
              <span className="block text-xs text-muted-foreground">{m.note}</span>
            </span>
            <span
              className={`h-4 w-4 rounded-full border-2 ${method === m.id ? "border-accent bg-accent" : "border-muted-foreground"}`}
            />
          </button>
        ))}
      </div>

      <form className="mt-4 space-y-4 rounded-lg border border-border bg-card p-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="wd-phone">Phone number</Label>
          <Input id="wd-phone" inputMode="tel" placeholder="0772 000 000" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wd-amount">Amount (UGX)</Label>
          <Input
            id="wd-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
          />
        </div>
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Fee (1%)</dt>
            <dd className="font-semibold tabular-nums">{formatUgx(fee)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">You receive</dt>
            <dd className="font-semibold tabular-nums">{formatUgx(Math.max(amount - fee, 0))}</dd>
          </div>
        </dl>
        <Button
          type="submit"
          className="w-full"
          disabled={pending || amount < 5000 || amount > available}
        >
          Withdraw {formatUgx(amount)}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Minimum withdrawal UGX 5,000. Account must be verified before payouts.
        </p>
      </form>
    </main>
  );
}
