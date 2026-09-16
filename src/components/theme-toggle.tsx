/**
 * theme-toggle.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Light/dark switch. Persists the choice in localStorage under
 * "smartbet-theme"; __root.tsx also has a pre-paint inline script reading the
 * same key so the correct theme applies before React hydrates (no flash).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("smartbet-theme");
    const next = stored ? stored === "dark" : true;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }, []);

  const apply = (next: boolean) => {
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("smartbet-theme", next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => apply(!dark)}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted",
        className,
      )}
    >
      {dark ? <Sun className="h-[1.125rem] w-[1.125rem]" /> : <Moon className="h-[1.125rem] w-[1.125rem]" />}
    </button>
  );
}
