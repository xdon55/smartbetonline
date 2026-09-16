/**
 * bottom-nav.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixed mobile bottom tab bar (Home, Sports, Live, Casino, My Bets).
 * Intentionally always dark in both themes. Hidden on md+ screens.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Link } from "@tanstack/react-router";
import { Home, Radio, Receipt, Ticket, Dice5, Trophy } from "lucide-react";
import { useBetSlip } from "@/lib/betslip";

const items = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/sports", label: "Sports", icon: Trophy, exact: false },
  { to: "/live", label: "Live", icon: Radio, exact: false },
  { to: "/my-bets", label: "My bets", icon: Receipt, exact: false },
];

export function BottomNav() {
  const { selections, setOpen } = useBetSlip();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-foreground/10 bg-surface md:hidden">
      <div className="mx-auto grid w-full max-w-[968px] grid-cols-6">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact }}
            activeProps={{ className: "text-accent" }}
            className="flex flex-col items-center gap-1 py-2 text-[11px] font-semibold text-surface-foreground/70"
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative flex flex-col items-center gap-1 py-2 text-[11px] font-semibold text-surface-foreground/70"
        >
          <Ticket className="h-5 w-5" />
          Bet slip
          {selections.length > 0 && (
            <span className="absolute right-4 top-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
              {selections.length}
            </span>
          )}
        </button>
        <span className="flex flex-col items-center gap-1 py-2 text-[11px] font-semibold text-surface-foreground/40">
          <Dice5 className="h-5 w-5" />
          Casino
        </span>
      </div>
    </nav>
  );
}
