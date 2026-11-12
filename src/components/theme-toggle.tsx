/**
 * theme-toggle.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Light/dark switch component. Reads and updates the persisted theme preference.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer",
        className,
      )}
    >
      {isDark ? (
        <Sun className="h-[1.125rem] w-[1.125rem]" />
      ) : (
        <Moon className="h-[1.125rem] w-[1.125rem]" />
      )}
    </button>
  );
}
