/**
 * match-commentary-widget.tsx
 * Renders minute-by-minute text commentary timeline for live fixtures.
 */
import { Radio, Goal, Flag, RefreshCw, AlertCircle } from "lucide-react";
import { generateMatchCommentary, type CommentaryItem } from "@/lib/match-commentary";

export function MatchCommentaryWidget({
  matchId,
  homeTeam,
  awayTeam,
  currentMinute = 45,
}: {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  currentMinute?: number;
}) {
  const items: CommentaryItem[] = generateMatchCommentary(
    matchId,
    homeTeam,
    awayTeam,
    currentMinute,
  );

  const getIcon = (type: CommentaryItem["type"]) => {
    switch (type) {
      case "goal":
        return <Goal className="h-4 w-4 text-emerald-400" />;
      case "card":
        return <div className="h-3.5 w-2.5 rounded-sm bg-amber-400 shadow-sm" />;
      case "substitution":
        return <RefreshCw className="h-3.5 w-3.5 text-blue-400" />;
      case "whistle":
        return <Radio className="h-3.5 w-3.5 text-accent animate-pulse" />;
      default:
        return <Flag className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-card-foreground flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-live animate-pulse" /> Live Match Commentary
        </h3>
        <span className="text-[10px] font-mono text-muted-foreground">
          Minute-by-minute timeline
        </span>
      </div>

      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 text-xs border-b border-border/40 pb-2.5 last:border-b-0 last:pb-0"
          >
            <span className="shrink-0 inline-flex items-center justify-center rounded bg-secondary px-2 py-0.5 font-mono text-[11px] font-bold text-secondary-foreground">
              {item.minute}&apos;
            </span>
            <div className="shrink-0 mt-0.5">{getIcon(item.type)}</div>
            <p className="flex-1 text-muted-foreground leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
