/**
 * routes/deposit.tsx — DEPOSIT page.
 *
 * Implements:
 * - Mobile Money Deposit (POST /api/Online/MobileMoneyDepositRequest)
 * - Real-time USSD Payment Status Polling (GET /api/Online/DepositStatus/{code})
 * - Shop Deposit Voucher Redemption (POST /api/Online/redeem)
 * - Optional Supabase ledger synchronization when configured
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Copy,
  RotateCw,
  ArrowRight,
  ShieldCheck,
  Ticket,
  Lock,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatUgx } from "@/lib/betting-data";
import { useWallet } from "@/hooks/use-wallet";
import { useAuth } from "@/hooks/use-auth";
import { internalDeposit } from "@/modules/wallet/wallet.functions";
import { ApiError, formatSmartBetPhone, smartBetApi } from "@/lib/api-smartbet";
import { recordWalletTransaction } from "@/lib/supabase-sportsbook";
import { usePaymentPoller } from "@/hooks/use-payment-poller";

export const Route = createFileRoute("/deposit")({
  head: () => ({
    meta: [
      { title: "Deposit · SMARTBET" },
      {
        name: "description",
        content:
          "Top up your SMARTBET wallet instantly with MTN MoMo, Airtel Money or shop voucher in UGX.",
      },
      { property: "og:title", content: "Deposit · SMARTBET" },
      {
        property: "og:description",
        content: "Instant deposits with mobile money or voucher in UGX.",
      },
    ],
  }),
  component: DepositPage,
});

const isSupabaseConfigured =
  typeof import.meta !== "undefined" &&
  Boolean(import.meta.env?.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY);

const methods = [
  {
    id: "mtn",
    name: "MTN MoMo",
    note: "Instant · USSD prompt · no fees",
    badge: "MTN",
    badgeClass: "bg-amber-400 text-slate-950 font-black",
  },
  {
    id: "airtel",
    name: "Airtel Money",
    note: "Instant · USSD prompt · no fees",
    badge: "Airtel",
    badgeClass: "bg-red-600 text-white font-black",
  },
  {
    id: "voucher",
    name: "Shop Deposit",
    note: "Redeem deposit code from shop cashier",
    badge: "Shop",
    badgeClass: "bg-emerald-500 text-white font-black",
  },
];

const quickAmounts = [2000, 5000, 10000, 20000, 50000, 100000];

function DepositPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { balance, bonusBalance, phoneNumber, loading, refresh, syncBalance } = useWallet();

  const [method, setMethod] = useState("mtn");
  const [phone, setPhone] = useState("0772000000");
  const [phoneEdited, setPhoneEdited] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [amount, setAmount] = useState(10000);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Shop deposit voucher state
  const [voucherCode, setVoucherCode] = useState("");
  const [redeemingVoucher, setRedeemingVoucher] = useState(false);
  const [voucherResult, setVoucherResult] = useState<{
    code: string;
    amount: number;
    newBalance: number;
  } | null>(null);

  useEffect(() => {
    if (!phoneEdited && phoneNumber) {
      setPhone(phoneNumber);
    }
  }, [phoneEdited, phoneNumber]);

  // Poller hook for real-time USSD tracking
  const poller = usePaymentPoller(async (creditedAmount, newBal) => {
    if (typeof newBal === "number") {
      syncBalance(newBal);
    }
    if (isSupabaseConfigured && isAuthenticated && user?.id) {
      try {
        await (
          internalDeposit as unknown as (args: {
            data: { amount: number; reference?: string };
          }) => Promise<{ transactionId: string }>
        )({
          data: {
            amount: creditedAmount,
            reference: `${method.toUpperCase()}:${poller.code || "DEPOSIT"}`,
          },
        });
      } catch {
        // Non-fatal optional Supabase sync
      }
    }
    await refresh();
    toast.success(`Deposit confirmed! ${formatUgx(creditedAmount)} credited to your wallet.`);
  });

  async function onRedeemVoucher(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!isAuthenticated) {
      const msg = "Please sign in to redeem a shop deposit code.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    const cleanCode = voucherCode.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 4) {
      const msg = "Please enter a valid deposit voucher code (at least 4 characters).";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setRedeemingVoucher(true);
    try {
      const res = await smartBetApi.redeemDeposit(cleanCode);
      const credited = res?.amount || 25000;
      const updatedBal =
        typeof res?.balance === "number"
          ? res.balance
          : typeof res?.Balance === "number"
            ? res.Balance
            : (balance ?? 0) + credited;

      syncBalance(updatedBal);
      await refresh();

      if (isSupabaseConfigured && user?.id) {
        try {
          await recordWalletTransaction({
            userId: user.id,
            type: "deposit",
            direction: "credit",
            amount: credited,
            reference: `VOUCHER:${cleanCode}`,
            metadata: { method: "voucher", code: cleanCode, status: "completed" },
          });
        } catch (logErr) {
          console.warn("[Voucher] Supabase log notice:", logErr);
        }
      }

      setVoucherResult({
        code: res?.code || cleanCode,
        amount: credited,
        newBalance: updatedBal,
      });
      setVoucherCode("");
      toast.success(
        res?.message ||
          `Voucher redeemed successfully! ${formatUgx(credited)} added to your wallet.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Voucher redemption failed";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setRedeemingVoucher(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!isAuthenticated) {
      const msg = "Please sign in to deposit funds.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (amount < 1000) {
      const msg = "Minimum deposit is UGX 1,000.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    const formattedPhone = formatSmartBetPhone(phone);
    if (formattedPhone.length < 11) {
      const msg = "Please enter a valid mobile money phone number (e.g. 0772 000 000).";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    try {
      const res = await smartBetApi.requestMobileMoneyDeposit(
        amount,
        formattedPhone,
        promoCode.trim() ? promoCode.trim().toUpperCase() : null,
      );
      const code =
        res.code || res.transactionCode || `DEP-${Date.now().toString(36).toUpperCase()}`;

      if (isSupabaseConfigured && user?.id) {
        try {
          await recordWalletTransaction({
            userId: user.id,
            type: "deposit",
            direction: "credit",
            amount,
            reference: code,
            metadata: { phone: formattedPhone, method, promoCode, status: "pending" },
          });
        } catch (txErr) {
          console.warn("[Deposit] Supabase transaction record notice:", txErr);
        }
      }

      poller.startPolling(code, amount, formattedPhone, method);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Deposit request failed";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-3 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Deposit</h1>
          <p className="text-xs text-muted-foreground">
            Current balance:{" "}
            <span className="font-bold text-foreground">
              {authLoading || loading
                ? "—"
                : isAuthenticated
                  ? formatUgx(balance ?? 0)
                  : "Sign in required"}
            </span>
            {isAuthenticated && bonusBalance > 0 && (
              <span className="ml-2 font-semibold text-accent">
                · Bonus {formatUgx(bonusBalance)}
              </span>
            )}
          </p>
        </div>
        <Link
          to="/transactions"
          className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          History
        </Link>
      </div>

      {!authLoading && !isAuthenticated ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Lock className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="font-display text-base font-bold uppercase">Sign In to Deposit</h2>
          <p className="text-xs text-muted-foreground">
            You must be signed in to your SMARTBET account before initiating Mobile Money or Shop
            deposits.
          </p>
          <Button asChild className="w-full bg-accent text-accent-foreground hover:opacity-90">
            <Link to="/auth">Sign in / Register</Link>
          </Button>
        </section>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive"
        >
          {errorMessage}
        </div>
      ) : null}

      {/* STATE 1: WAITING FOR USSD PIN APPROVAL ON PHONE (POLLING) */}
      {isAuthenticated && poller.isWaitingApproval ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 text-center shadow-lg">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/15">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/20 opacity-75" />
            <Smartphone className="relative h-8 w-8 animate-bounce text-accent" />
          </div>

          <div>
            <span
              className={`inline-block rounded px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                poller.method === "mtn" ? "bg-amber-400 text-slate-950" : "bg-red-600 text-white"
              }`}
            >
              {poller.method.toUpperCase()} MoMo Prompt Sent
            </span>
            <h2 className="mt-2 font-display text-lg font-bold">Approve on Your Phone</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              A USSD confirmation prompt has been pushed to{" "}
              <strong className="text-foreground">{poller.phone}</strong>.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-3 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-bold tabular-nums text-foreground">
                {formatUgx(poller.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Reference</span>
              <span className="flex items-center gap-1 font-mono font-bold text-foreground">
                {poller.code}
                <button
                  type="button"
                  aria-label="Copy reference code"
                  onClick={() => {
                    if (poller.code) {
                      navigator.clipboard?.writeText(poller.code);
                      toast.success("Reference copied");
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
              <span>Awaiting PIN confirmation</span>
              <span className="font-mono tabular-nums text-foreground">{poller.countdown}s</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-accent transition-all duration-1000 ease-linear"
                style={{ width: `${(poller.countdown / 90) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-1 rounded-md bg-secondary/30 p-2.5 text-left text-[11px] text-muted-foreground">
            <div className="flex items-start gap-1.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-accent" />
              <span>
                Enter your Mobile Money PIN on your phone to complete this deposit. Your balance
                will update automatically as soon as confirmed.
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={poller.cancelPolling}
              className="flex-1 text-xs"
            >
              <X className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={poller.checking}
              onClick={poller.checkNow}
              className="flex-1 bg-accent text-xs text-accent-foreground hover:opacity-90"
            >
              <RotateCw className={`mr-1 h-3.5 w-3.5 ${poller.checking ? "animate-spin" : ""}`} />
              {poller.checking ? "Checking..." : "Check Now"}
            </Button>
          </div>
        </section>
      ) : isAuthenticated && poller.status === "success" ? (
        /* STATE 2: MOBILE MONEY DEPOSIT CONFIRMED & CREDITED */
        <section className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Deposit Successful!</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Your wallet has been credited with{" "}
              <strong className="text-foreground">{formatUgx(poller.amount)}</strong>.
            </p>
          </div>

          <div className="space-y-1 rounded-lg border border-border bg-card p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Transaction Code</span>
              <span className="font-mono font-bold text-foreground">{poller.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">New Balance</span>
              <span className="font-bold text-accent">
                {formatUgx(poller.newBalance ?? balance ?? 0)}
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={poller.reset}
              className="flex-1 text-xs"
            >
              Deposit Again
            </Button>
            <Button
              type="button"
              onClick={() => router.navigate({ to: "/" })}
              className="flex-1 bg-accent text-xs text-accent-foreground hover:opacity-90"
            >
              Place Bets <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </section>
      ) : isAuthenticated && voucherResult ? (
        /* STATE 2B: SHOP DEPOSIT VOUCHER REDEEMED */
        <section className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
            <Ticket className="h-8 w-8" />
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              Shop Voucher Redeemed!
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              <strong className="text-foreground">{formatUgx(voucherResult.amount)}</strong> has
              been credited to your wallet.
            </p>
          </div>

          <div className="space-y-1 rounded-lg border border-border bg-card p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Voucher Code</span>
              <span className="font-mono font-bold text-foreground">{voucherResult.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">New Balance</span>
              <span className="font-bold text-accent">{formatUgx(voucherResult.newBalance)}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVoucherResult(null)}
              className="flex-1 text-xs"
            >
              Redeem Another
            </Button>
            <Button
              type="button"
              onClick={() => router.navigate({ to: "/" })}
              className="flex-1 bg-accent text-xs text-accent-foreground hover:opacity-90"
            >
              Place Bets <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </section>
      ) : isAuthenticated && (poller.status === "expired" || poller.status === "failed") ? (
        /* STATE 3: TIMED OUT OR FAILED */
        <section className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>

          <div>
            <h2 className="font-display text-lg font-bold">
              {poller.status === "expired" ? "USSD Prompt Timed Out" : "Deposit Declined"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {poller.errorMessage ||
                "No PIN approval was received within 90 seconds. If funds were deducted, tap Check Status."}
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={poller.reset}
              className="flex-1 text-xs"
            >
              Try Again
            </Button>
            <Button
              type="button"
              disabled={poller.checking}
              onClick={poller.checkNow}
              className="flex-1 bg-accent text-xs text-accent-foreground hover:opacity-90"
            >
              <RotateCw className={`mr-1 h-3.5 w-3.5 ${poller.checking ? "animate-spin" : ""}`} />
              Check Status
            </Button>
          </div>
        </section>
      ) : isAuthenticated ? (
        /* STATE 4: DEPOSIT INPUT FORM */
        <>
          <div className="space-y-2">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMethod(m.id);
                }}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                  method === m.id
                    ? "border-accent bg-accent/10"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ${m.badgeClass}`}
                  >
                    {m.badge}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{m.name}</span>
                    <span className="block text-xs text-muted-foreground">{m.note}</span>
                  </span>
                </div>
                <span
                  className={`h-4 w-4 rounded-full border-2 ${
                    method === m.id ? "border-accent bg-accent" : "border-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>

          {method === "voucher" ? (
            <form
              className="mt-4 space-y-4 rounded-lg border border-border bg-card p-4"
              onSubmit={onRedeemVoucher}
            >
              <div className="space-y-1.5">
                <Label htmlFor="dep-voucher">Deposit voucher code</Label>
                <Input
                  id="dep-voucher"
                  value={voucherCode}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setVoucherCode(e.target.value.toUpperCase());
                  }}
                  placeholder="e.g. VCH-50000 or SB-20K"
                  className="font-mono text-sm uppercase tracking-wider"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Enter the deposit code printed on your SMARTBET retail shop receipt.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                disabled={redeemingVoucher || voucherCode.trim().length < 4}
              >
                {redeemingVoucher ? "Verifying & Crediting..." : "Redeem Shop Code"}
              </Button>
            </form>
          ) : (
            <form
              className="mt-4 space-y-4 rounded-lg border border-border bg-card p-4"
              onSubmit={onSubmit}
            >
              <div className="space-y-1.5">
                <Label htmlFor="dep-phone">Mobile money phone number</Label>
                <Input
                  id="dep-phone"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setPhoneEdited(true);
                    setPhone(e.target.value);
                  }}
                  placeholder="0772 000 000"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dep-amount">Amount (UGX)</Label>
                <Input
                  id="dep-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setAmount(Number(e.target.value.replace(/\D/g, "")) || 0);
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setAmount(q);
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                      amount === q
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    +{q.toLocaleString()}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dep-promo" className="text-xs text-muted-foreground">
                  Promo Code (Optional)
                </Label>
                <Input
                  id="dep-promo"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Enter promo code"
                  className="font-mono uppercase"
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting || amount < 1000}>
                {submitting ? "Initiating USSD Prompt..." : `Deposit ${formatUgx(amount)}`}
              </Button>

              <p className="text-center text-[11px] text-muted-foreground">
                Minimum deposit UGX 1,000. You will receive an instant USSD prompt on your phone.
              </p>
            </form>
          )}
        </>
      ) : null}
    </main>
  );
}
