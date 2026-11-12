import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpFromLine, Receipt, RotateCw, FileText } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { formatUgx } from "@/lib/betting-data";
import { useWallet } from "@/hooks/use-wallet";
import { useAuth } from "@/hooks/use-auth";
import { smartBetApi } from "@/lib/api-smartbet";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions & Statements · SMARTBET" },
      {
        name: "description",
        content:
          "Review your SMARTBET deposits, withdrawals, stakes and official account statements in UGX.",
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

interface StatementRow {
  TransactionId: string;
  Date: string;
  Type: string;
  Amount: number;
  Balance: number;
  Description: string;
}

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
  const { transactions, balance, loading: walletLoading, refresh: refreshWallet } = useWallet();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"wallet" | "statement">("wallet");
  const [statement, setStatement] = useState<StatementRow[]>([]);
  const [loadingStatement, setLoadingStatement] = useState(false);

  const loadStatement = useCallback(async () => {
    setLoadingStatement(true);
    try {
      const userId = user?.id || "demo_user";
      const rows = (await smartBetApi.getStatement(userId)) as StatementRow[];
      if (Array.isArray(rows)) {
        setStatement(rows);
      }
    } catch (err) {
      console.warn("[Transactions] Failed to load statement:", err);
    } finally {
      setLoadingStatement(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === "statement") {
      loadStatement();
    }
  }, [activeTab, loadStatement]);

  const handleRefresh = () => {
    if (activeTab === "wallet") refreshWallet();
    else loadStatement();
  };

  const loading = activeTab === "wallet" ? walletLoading : loadingStatement;

  return (
    <main className="mx-auto max-w-2xl px-3 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Transactions</h1>
          <p className="text-xs text-muted-foreground">
            Wallet Balance:{" "}
            <span className="font-bold text-foreground">
              {balance !== null ? formatUgx(balance) : "—"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Refresh transactions"
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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

      {/* Tabs */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
        <button
          type="button"
          onClick={() => setActiveTab("wallet")}
          className={`rounded-md py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
            activeTab === "wallet"
              ? "bg-odds-active text-odds-active-foreground"
              : "text-secondary-foreground"
          }`}
        >
          Wallet Activity
        </button>
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
          Official Statement
        </button>
      </div>

      {activeTab === "wallet" ? (
        loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading transactions…</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No transactions yet.</p>
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
        )
      ) : loadingStatement ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Loading official statement…
        </p>
      ) : statement.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No statement entries recorded.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="divide-y divide-border">
            {statement.map((row) => {
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
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
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
      )}
    </main>
  );
}
