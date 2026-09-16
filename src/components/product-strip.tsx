/**
 * product-strip.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixed product navigation bar pinned under the header on every page.
 * Items with `to: null` are placeholders shown with a "Soon" badge until
 * those products (Slots, Virtuals) are built.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Link } from "@tanstack/react-router";
import { Dice5, Gamepad2, House, Plane, Radio, Rocket, Spade, Trophy } from "lucide-react";

const products = [
  { id: "home", name: "Home", icon: House, to: "/" as const, exact: true },
  { id: "sports", name: "Sports", icon: Trophy, to: "/sports" as const, exact: false },
  { id: "live", name: "Live", icon: Radio, to: "/live" as const, exact: false },
  { id: "casino", name: "Casino", icon: Spade, to: "/casino" as const, exact: false },
  { id: "aviator", name: "Aviator", icon: Plane, to: "/aviator" as const, exact: false },
  { id: "crash", name: "Crash", icon: Rocket, to: "/crash" as const, exact: false },
  { id: "slots", name: "Slots", icon: Dice5, to: null },
  { id: "virtuals", name: "Virtuals", icon: Gamepad2, to: null },
];

export function ProductStrip() {
  return (
    <>
      <div className="no-scrollbar fixed inset-x-0 top-16 z-30 overflow-x-auto border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-[968px] gap-1 px-3 py-2.5">
          {products.map((p) =>
            p.to ? (
              <Link
                key={p.id}
                to={p.to}
                activeOptions={{ exact: p.exact }}
                activeProps={{ className: "border-accent text-accent" }}
                inactiveProps={{ className: "border-transparent text-muted-foreground hover:text-foreground" }}
                className="inline-flex h-9 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition-colors"
              >
                <p.icon className="h-3.5 w-3.5" />
                {p.name}
              </Link>
            ) : (
              <button
                key={p.id}
                type="button"
                className="inline-flex h-9 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-xs font-semibold text-muted-foreground/60"
              >
                <p.icon className="h-3.5 w-3.5" />
                {p.name}
                <span className="text-[9px] font-medium opacity-70">Soon</span>
              </button>
            ),
          )}
        </div>
      </div>
      
    </>
  );
}
