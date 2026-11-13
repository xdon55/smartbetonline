/**
 * account-menu.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Right slide-in account panel (wallet links, balance card, theme toggle).
 * Balance now comes from the server-side ledger. Locks page scroll while open
 * and scrolls internally on overflow. Authentication links adjust to sign-in or
 * sign-out based on the current session.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Gift,
  LogIn,
  LogOut,
  Receipt,
  Settings,
  Ticket,
  UserRound,
  Wallet,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatUgx } from "@/lib/betting-data";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/hooks/use-wallet";
import { useOpenBets } from "@/hooks/use-open-bets";
import { toast } from "sonner";

const guestLinks = [{ to: "/auth" as const, label: "Sign in / Register", icon: LogIn }];

const authLinks = [
  { to: "/deposit" as const, label: "Deposit", icon: ArrowDownToLine },
  { to: "/withdraw" as const, label: "Withdraw", icon: ArrowUpFromLine },
  { to: "/my-bets" as const, label: "My bets", icon: Receipt },
  { to: "/booking-code" as const, label: "Booking code", icon: Ticket },
  { to: "/transactions" as const, label: "Transactions", icon: Wallet },
];

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [bonusesOpen, setBonusesOpen] = useState(false);

  const { isAuthenticated, user, signOut, loading: authLoading } = useAuth();
  const {
    balance,
    bonusBalance,
    bonuses,
    accountId,
    loading: walletLoading,
    refresh,
  } = useWallet();
  const { openCount } = useOpenBets();

  const openBonuses = () => {
    setBonusesOpen(true);
    void refresh();
  };

  useEffect(() => {
    if (open) {
      document.documentElement.classList.add("overflow-hidden");
    } else {
      document.documentElement.classList.remove("overflow-hidden");
    }
    return () => document.documentElement.classList.remove("overflow-hidden");
  }, [open]);

  const links = isAuthenticated ? authLinks : guestLinks;
  const effectiveBonusBalance = bonuses?.BonusBalance ?? bonusBalance;
  const activeBonuses = bonuses?.ActiveBonuses ?? [];
  const bonusTransactions = bonuses?.Transactions ?? [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Account"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-surface-foreground/80 transition-colors hover:bg-surface-foreground/10"
      >
        <UserRound className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full p-0 sm:w-80 flex flex-col">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-left font-display text-lg uppercase tracking-wide">
            My account
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3">
            <div className="rounded-lg brand-gradient p-3 text-surface-foreground">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wide opacity-80">Balance</p>
                {accountId && (
                  <span className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide opacity-90">
                    ID #{accountId}
                  </span>
                )}
              </div>
              <p className="font-display text-2xl font-bold tabular-nums">
                {authLoading || walletLoading ? "—" : formatUgx(balance ?? 0)}
              </p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums opacity-90">
                Bonus: {authLoading || walletLoading ? "—" : formatUgx(effectiveBonusBalance)}
              </p>
              {isAuthenticated && user?.email && (
                <p className="mt-1 truncate text-xs opacity-80">{user.email}</p>
              )}
            </div>
          </div>

          <nav className="px-2 pb-4">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <l.icon className="h-4 w-4 text-muted-foreground" />
                  {l.label}
                </div>
                {l.to === "/my-bets" && openCount > 0 && (
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                    {openCount} open
                  </span>
                )}
              </Link>
            ))}
            <button
              type="button"
              onClick={openBonuses}
              className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              <div className="flex items-center gap-3">
                <Gift className="h-4 w-4 text-accent" />
                Bonuses & Rewards
              </div>
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold tabular-nums text-accent">
                {effectiveBonusBalance > 0 ? formatUgx(effectiveBonusBalance) : "Active"}
              </span>
            </button>

            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              Settings
            </button>

            {isAuthenticated && (
              <Button
                variant="ghost"
                onClick={async () => {
                  setOpen(false);
                  await signOut();
                  await refresh();
                  toast.success("Signed out");
                }}
                className="flex w-full items-center justify-start gap-3 rounded-md px-3 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
                Sign out
              </Button>
            )}

            <div className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold">
              <span>Appearance</span>
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </SheetContent>

      <Dialog open={bonusesOpen} onOpenChange={setBonusesOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wide">
              Bonuses & Promotions
            </DialogTitle>
          </DialogHeader>
          {walletLoading && !bonuses ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading bonuses...</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg brand-gradient p-4 text-surface-foreground">
                <p className="text-xs uppercase tracking-wide opacity-80">
                  Available Bonus Balance
                </p>
                <p className="font-display text-2xl font-bold tabular-nums">
                  {formatUgx(effectiveBonusBalance)}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Active Promotions
                </p>
                {activeBonuses.length === 0 ? (
                  <p className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                    No active bonus promotions right now. Enter a promo code on deposit to claim.
                  </p>
                ) : (
                  activeBonuses.map((b) => (
                    <div
                      key={b.Id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                    >
                      <div>
                        <p className="text-sm font-bold">{b.Name}</p>
                        <p className="text-xs text-muted-foreground">
                          Status: <span className="font-semibold text-emerald-400">{b.Status}</span>
                          {b.ExpiresAt ? ` · Exp ${b.ExpiresAt}` : ""}
                        </p>
                      </div>
                      <span className="font-bold tabular-nums text-accent">
                        {formatUgx(b.Amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Bonus Transactions
                </p>
                {bonusTransactions.length === 0 ? (
                  <p className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                    No bonus transactions recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {bonusTransactions.map((tx) => (
                      <div
                        key={tx.Id}
                        className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="truncate font-semibold text-foreground">{tx.Description}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {tx.Type} · {new Date(tx.Date).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 font-bold tabular-nums ${
                            tx.Amount >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {tx.Amount >= 0 ? "+" : ""}
                          {formatUgx(tx.Amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
