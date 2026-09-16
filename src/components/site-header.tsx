/**
 * site-header.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixed top bar: main menu trigger, SMARTBET logo, search, wallet balance
 * and the account menu trigger.
 *
 * The wallet balance now comes from the server-side wallet ledger so it is
 * authoritative. While loading it displays “—”.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { MainMenu } from "./main-menu";
import { AccountMenu } from "./account-menu";
import { SearchDialog } from "./search-dialog";
import { formatUgx } from "@/lib/betting-data";
import { useWallet } from "@/hooks/use-wallet";

export function SiteHeader() {
  const { balance, loading } = useWallet();
  const display = loading ? "—" : formatUgx(balance ?? 0);

  return (
    <header className="fixed inset-x-0 top-0 z-50 brand-gradient text-surface-foreground">
      {/** Tight header rail so the logo and controls sit close to the edges. */}
      <div className="mx-auto flex h-16 w-full max-w-[968px] items-center gap-1 px-1.5">
        <MainMenu />
        <Link
          to="/"
          className="font-display text-lg font-bold leading-none text-surface-foreground"
        >
          SMARTBET
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <SearchDialog />

          <Link
            to="/deposit"
            className="ml-1 flex items-center gap-1.5 rounded-md bg-surface-foreground/10 px-1.5 py-1"
          >
            <Wallet className="h-4 w-4 text-accent" />
            <span className="text-xs font-semibold tabular-nums">{display}</span>
          </Link>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
