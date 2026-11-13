/**
 * routes/transactions.tsx — TRANSACTIONS, OFFICIAL STATEMENTS & BONUSES page.
 *
 * Displays:
 * - Official Account Statement (GET /api/Statement/User?userid=...)
 * - Internal Wallet Ledger Activity (Supabase PostgreSQL ledger)
 * - Bonus Wallets & Transactions (GET /api/Account/Bonuses)
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpFromLine, Receipt, RotateCw, FileText, Gift } from "lucide-react";
import { useState, useMemo } from "react";
import { formatUgx } from "@/lib/betting-data";
import { useWallet } from "@/hooks/use-wallet";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions & Statements · SMARTBET" },
      {
        name: "description",
        content:
          "Review your SMARTBET deposits, withdrawals, stakes, bonuses and official account statements in UGX.",
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
  withdrawal: ArrowUpFromLine,
  stake: Receipt,
} as const;

type CategoryFilter = "all" | "deposit" | "withdrawal" | "bet";

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
    case "deposit":
      return `Deposit${tx.reference ? ` · ${tx.reference}` : ""}`;
    case "internal_withdrawal":
    case "withdrawal":
    case "withdraw":
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
  const { transactions, statement, bonuses, balance, bonusBalance, loading, refresh } = useWallet();
  const [activeTab, setActiveTab] = useState<"statement" | "wallet" | "bonuses">("statement");
  const [typeFilter, setTypeFilter] = useState<CategoryFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const filteredStatement = useMemo(() => {
    if (typeFilter === "all") return statement;
    return statement.filter((row) => {
      const t = row.Type.toLowerCase();
      if (typeFilter === "deposit") return t.includes("deposit");
      if (typeFilter === "withdrawal") return t.includes("withdraw");
      return t.includes("bet") || t.includes("stake") || t.includes("payout");
    });
  }, [statement, typeFilter]);

  const filteredTransactions = useMemo(() => {
    if (typeFilter === "all") return transactions;
    return transactions.filter((tx) => {
      const t = tx.type.toLowerCase();
      if (typeFilter === "deposit") return t.includes("deposit");
      if (typeFilter === "withdrawal") return t.includes("withdraw");
      return t.includes("stake") || t.includes("payout");
    });
  }, [transactions, typeFilter]);

  const isBusy = loading || refreshing;

  return (
    <main className="mx-auto max-w-2xl px-3 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Transactions</h1>
          <p className="text-xs text-muted-foreground">
            Wallet Balance:{" "}
            <span className="font-bold text-foreground">
              {balance !== null ? formatUgx(balance) : "—"}
            </span>
            {bonusBalance > 0 && (
              <span className="ml-2 font-semibold text-accent">
                · Bonus {formatUgx(bonusBalance)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isBusy}
            aria-label="Refresh transactions"
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <RotateCw className={`h-4 w-4 ${isBusy ? "animate-spin" : ""}`} />
          </button>
          <Link
            to="/deposit"
            className="rounded bg-accent px-3 py-1.5 text-xs font-bold uppercase text-accent-foreground hover:opacity-90"
          >
            Deposit
          </Link>
          <Link
            to="/withdraw"
            className="rounded border border-border bg-card px-3 py-1.5 text-xs font-bold uppercase hover:bg-muted"
          >
            Withdraw
          </Link>
        </div>
      </div>

      {/* Primary Section Tabs */}
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1">
        <button
          type="button"
          onClick={() => setActiveTab("statement")}
          className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
            activeTab === "statement"
              ? "bg-odds-active text-odds-active-foreground"
              : "text-secondary-foreground"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Statement
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("wallet")}
          className={`rounded-md py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
            activeTab === "wallet"
              ? "bg-odds-active text-odds-active-foreground"
              : "text-secondary-foreground"
          }`}
        >
          Ledger
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("bonuses")}
          className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
            activeTab === "bonuses"
              ? "bg-odds-active text-odds-active-foreground"
              : "text-secondary-foreground"
          }`}
        >
          <Gift className="h-3.5 w-3.5" />
          Bonuses
        </button>
      </div>

      {/* Category Filter */}
      {activeTab !== "bonuses" && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(
            [
              { id: "all", label: "All" },
              { id: "deposit", label: "Deposits" },
              { id: "withdrawal", label: "Withdrawals" },
              { id: "bet", label: "Bets & Payouts" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTypeFilter(f.id)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                typeFilter === f.id
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "statement" ? (
        isBusy && statement.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Loading official statement…
          </p>
        ) : filteredStatement.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No statement entries recorded for this filter.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="divide-y divide-border">
              {filteredStatement.map((row) => {
                const isCredit = row.Amount > 0;
                return (
                  <div key={row.TransactionId} className="flex items-center gap-3 px-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{row.Description}</p>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          #{row.TransactionId}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{row.Type}</span>
                        <span>·</span>
                        <span>{formatWhen(row.Date)}</span>
                        <span>·</span>
                        <span>Balance: {formatUgx(row.Balance)}</span>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-bold tabular-nums ${isCredit ? "text-accent" : "text-foreground"}`}
                    >
                      {isCredit ? "+" : ""}
                      {formatUgx(row.Amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : activeTab === "wallet" ? (
        isBusy && transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading ledger…</p>
        ) : filteredTransactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No ledger entries yet.</p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border">
            {filteredTransactions.map((tx) => {
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
                    <p className="text-[11px] text-muted-foreground">
                      {formatWhen(tx.created_at)} · <span className="uppercase">{tx.status}</span>
                    </p>
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
        )
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg brand-gradient p-4 text-surface-foreground">
            <p className="text-xs uppercase tracking-wide opacity-80">Bonus Wallet Balance</p>
            <p className="font-display text-2xl font-bold tabular-nums">
              {formatUgx(bonuses?.BonusBalance ?? bonusBalance)}
            </p>
          </div>

          {bonuses?.ActiveBonuses && bonuses.ActiveBonuses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Active Bonuses
              </p>
              {bonuses.ActiveBonuses.map((b) => (
                <div
                  key={b.Id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                >
                  <div>
                    <p className="text-sm font-bold">{b.Name}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: <span className="font-semibold text-accent">{b.Status}</span>
                    </p>
                  </div>
                  <span className="font-bold tabular-nums text-accent">{formatUgx(b.Amount)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Bonus Transactions
            </p>
            {bonuses?.Transactions && bonuses.Transactions.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-border bg-card divide-y divide-border">
                {bonuses.Transactions.map((bt) => (
                  <div key={bt.Id} className="flex items-center justify-between px-3 py-3">
                    <div>
                      <p className="text-sm font-semibold">{bt.Description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {bt.Type} · {formatWhen(bt.Date)}
                      </p>
                    </div>
                    <span className="font-bold tabular-nums text-accent">
                      +{formatUgx(bt.Amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No bonus transactions recorded yet.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
