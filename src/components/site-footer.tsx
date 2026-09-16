/**
 * site-footer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Site-wide footer: link columns, social icons, and the responsible-gaming
 * notice (players must be 25+). Update legal/licensing copy before launch.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Send, Twitter, Youtube } from "lucide-react";

const socials = [
  { label: "Facebook", icon: Facebook },
  { label: "X", icon: Twitter },
  { label: "Instagram", icon: Instagram },
  { label: "YouTube", icon: Youtube },
  { label: "Telegram", icon: Send },
];

const columns = [
  {
    title: "Betting",
    links: [
      { label: "Sports", to: "/" as const },
      { label: "Live betting", to: "/live" as const },
      { label: "My bets", to: "/my-bets" as const },
    ],
  },
];

const info = [
  "How to place a bet",
  "Deposits & withdrawals",
  "Bonus terms",
  "Responsible gaming",
  "Terms & conditions",
  "Privacy policy",
];

export function SiteFooter() {
  return (
    <footer className="mt-6 border-t border-border bg-card">
      <div className="mx-auto grid w-full max-w-[968px] gap-6 px-4 py-8 sm:grid-cols-3">
        <div>
          <p className="font-display text-xl font-bold leading-none">SMARTBET</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            SMARTBET is a sports betting brand offering football odds, live betting and instant
            mobile money payouts in Ugandan shillings.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Support: support@smartbet.example · Toll free 0800 123 456
          </p>
          <div className="mt-3 flex gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href="#"
                aria-label={s.label}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide">{col.title}</p>
            <ul className="space-y-1.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide">Help & legal</p>
          <ul className="space-y-1.5">
            {info.map((l) => (
              <li key={l} className="text-xs text-muted-foreground">
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border px-4 py-4">
        <p className="mx-auto w-full max-w-[968px] text-[11px] leading-relaxed text-muted-foreground">
          You must be 25 years or older to open an account and place a bet. Gambling can be
          addictive — please play responsibly and only stake what you can afford to lose. Odds and
          markets shown are for demonstration purposes.
          <br />© {new Date().getFullYear()} SMARTBET. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
