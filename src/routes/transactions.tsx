/**
 * routes/transactions.tsx — TRANSACTIONS page.
 *
 * Lists every wallet movement for the signed-in user: deposits, withdrawals,
 * stakes and payouts. Data comes from the real `transactions` table and is
 * kept in sync with the double-entry ledger.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpFromLine, Receipt } from "lucide-react";
import { formatUgx } from "@/lib/betting-data";
import { useWallet } from "@/hooks/use-wallet";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions · SMARTBET" },
      {
        name: "description",
        content: "Review your SMARTBET deposits, withdrawals and bet stakes with running balances in UGX.",
      },
      { property: "og:title", content: "Transactions · SMARTBET" },
      { property: "og:description", content: "Every deposit, withdrawal and stake in one place." },
    ],
  }),
  component: TransactionsPage,
});

const icons = {
  internal_deposit: ArrowDownToLine,
  deposit: ArrowDownToLine,
  payout: ArrowDownToLine,
  internal_withdrawal: ArrowUpFromLine,
  withdraw: ArrowUpFromLine,
  stake: Receipt,
} as const;

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-UG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelFor(tx: { type: string; reference: string | null }) {
  switch (tx.type) {
    case "internal_deposit":
      return `Deposit${tx.reference ? ` · ${tx.reference}` : ""}`;
    case "internal_withdrawal":
      return `Withdrawal${tx.reference ? ` · ${tx.reference}` : ""}`;
    case "stake":
      return `Bet stake${tx.reference ? ` · ${tx.reference}` : ""}`;
    case "payout":
      return `Payout${tx.reference ? ` · ${tx.reference}` : ""}`;
    default:
      return tx.reference ?? tx.type;
  }
}

function TransactionsPage() {
  const { transactions, loading } = useWallet();

  return (
    <main className="mx-auto max-w-2xl px-3 py-6">
      <h1 className="mb-4 font-display text-2xl font-bold uppercase tracking-wide">Transactions</h1>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading transactions…</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border">
          {transactions.map((tx) => {
            const Icon = icons[tx.type as keyof typeof icons] ?? Receipt;
            const isCredit = tx.direction === "credit";
            return (
              <li
                key={tx.id}
                className="flex items-center gap-3 border-b border-border bg-card px-3 py-3 last:border-b-0"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{labelFor(tx)}</p>
                  <p className="text-[11px] text-muted-foreground">{formatWhen(tx.created_at)}</p>
                </div>
                <span
                  className={`text-sm font-bold tabular-nums ${isCredit ? "text-accent" : "text-foreground"}`}
                >
                  {isCredit ? "+" : "-"}
                  {formatUgx(tx.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
