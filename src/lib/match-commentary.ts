/**
 * match-commentary.ts
 * Generates minute-by-minute live match commentary items.
 */
export interface CommentaryItem {
  id: string;
  minute: number;
  type: "goal" | "card" | "substitution" | "corner" | "shot" | "fouls" | "whistle" | "attack";
  team?: "home" | "away";
  text: string;
}

export function generateMatchCommentary(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  currentMinute = 45,
): CommentaryItem[] {
  // Deterministic seed based on matchId string
  let seed = 0;
  for (let i = 0; i < matchId.length; i++) {
    seed = (seed << 5) - seed + matchId.charCodeAt(i);
    seed |= 0;
  }
  const random = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  const items: CommentaryItem[] = [];
  const maxMin = Math.max(5, Math.min(90, currentMinute));

  items.push({
    id: `${matchId}-1`,
    minute: 1,
    type: "whistle",
    text: `Referee blows the whistle and the match between ${homeTeam} and ${awayTeam} gets underway!`,
  });

  if (maxMin >= 12) {
    items.push({
      id: `${matchId}-12`,
      minute: 12,
      type: "attack",
      team: "home",
      text: `Dangerous build-up from ${homeTeam} down the left flank, cleared for a corner.`,
    });
  }

  if (maxMin >= 24) {
    items.push({
      id: `${matchId}-24`,
      minute: 24,
      type: "shot",
      team: "away",
      text: `${awayTeam} fires a long range shot testing the goalkeeper who gathers comfortably.`,
    });
  }

  if (maxMin >= 34) {
    items.push({
      id: `${matchId}-34`,
      minute: 34,
      type: "card",
      team: "home",
      text: `Yellow card! A tactical foul by ${homeTeam}'s midfielder halts a sharp counter-attack.`,
    });
  }

  if (maxMin >= 41) {
    items.push({
      id: `${matchId}-41`,
      minute: 41,
      type: "goal",
      team: "home",
      text: `GOAL! Incredible finish! ${homeTeam} takes the lead with a clinical strike into the bottom corner!`,
    });
  }

  if (maxMin >= 45) {
    items.push({
      id: `${matchId}-45`,
      minute: 45,
      type: "whistle",
      text: `Half-time whistle sounds. Scoreline: ${homeTeam} 1 - 0 ${awayTeam}.`,
    });
  }

  if (maxMin >= 55) {
    items.push({
      id: `${matchId}-55`,
      minute: 55,
      type: "substitution",
      team: "away",
      text: `Substitution for ${awayTeam}: fresh legs brought on in midfield to inject creative pace.`,
    });
  }

  if (maxMin >= 68) {
    items.push({
      id: `${matchId}-68`,
      minute: 68,
      type: "attack",
      team: "away",
      text: `Close call! ${awayTeam} hits the crossbar from a well-executed header!`,
    });
  }

  if (maxMin >= 82) {
    items.push({
      id: `${matchId}-82`,
      minute: 82,
      type: "goal",
      team: "away",
      text: `GOAL! Equalizer! ${awayTeam} breaks through the defensive line and scores!`,
    });
  }

  if (maxMin >= 90) {
    items.push({
      id: `${matchId}-90`,
      minute: 90,
      type: "whistle",
      text: `Full-time whistle blows. A thrilling encounter concludes with honours even!`,
    });
  }

  return items.reverse(); // Newest first
}
