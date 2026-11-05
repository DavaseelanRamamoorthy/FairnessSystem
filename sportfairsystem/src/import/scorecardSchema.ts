import { z } from "zod";

/** "19.4" -> 118 balls. Accepts numbers or strings; the digit after the dot is balls (0-5). */
export function oversToBalls(overs: string | number): number {
  const [whole, part = "0"] = String(overs).trim().split(".");
  const balls = Number(part);
  if (!/^\d+$/.test(whole) || !/^\d$/.test(part) || balls > 5) {
    throw new Error(`"${overs}" is not a valid overs value`);
  }
  return Number(whole) * 6 + balls;
}

const oversValue = z.union([z.string(), z.number()]).transform((value, ctx) => {
  try {
    return oversToBalls(value);
  } catch (error) {
    ctx.addIssue({ code: "custom", message: (error as Error).message });
    return z.NEVER;
  }
});

const battingRow = z.object({
  name: z.string().min(1),
  cricheroes_player_id: z.string().optional(),
  position: z.number().int().min(1).max(11),
  runs: z.number().int().min(0).default(0),
  balls: z.number().int().min(0).default(0),
  fours: z.number().int().min(0).default(0),
  sixes: z.number().int().min(0).default(0),
  how_out: z.string().optional(),
  not_out: z.boolean().default(false),
  did_bat: z.boolean().default(true)
});

const bowlingRow = z.object({
  name: z.string().min(1),
  cricheroes_player_id: z.string().optional(),
  overs: oversValue,
  maidens: z.number().int().min(0).default(0),
  runs: z.number().int().min(0),
  wickets: z.number().int().min(0).max(10),
  wides: z.number().int().min(0).default(0),
  no_balls: z.number().int().min(0).default(0)
});

const innings = z.object({
  innings_no: z.number().int().min(1).max(4),
  team_name: z.string().min(1),
  ours: z.boolean(),
  runs: z.number().int().min(0),
  wickets: z.number().int().min(0).max(10),
  overs: oversValue,
  extras: z.number().int().min(0).default(0),
  /** Batters of the team batting in this innings (all 11 if DNB players are listed). */
  batting: z.array(battingRow),
  /** Bowlers of the fielding side in this innings. */
  bowling: z.array(bowlingRow)
});

/**
 * The one format every scorecard source is converted into: CricHeroes pages
 * (read by Claude), PDF uploads, or manual entry.
 */
export const scorecardSchema = z.object({
  source: z.enum(["cricheroes", "pdf", "manual"]),
  cricheroes_match_ref: z.string().optional(),
  match_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  our_team: z.string().min(1),
  opponent: z.string().min(1),
  overs: z.number().int().min(1).max(50),
  result: z.enum(["won", "lost", "tied", "no_result"]).optional(),
  result_summary: z.string().optional(),
  innings: z.array(innings).min(1).max(4)
});

export type Scorecard = z.output<typeof scorecardSchema>;
export type ScorecardInput = z.input<typeof scorecardSchema>;

/** Arithmetic checks a scorer would do. Returns human-readable problems. */
export function checkScorecard(card: Scorecard): string[] {
  const problems: string[] = [];
  const oursCount = card.innings.filter((i) => i.ours).length;
  if (oursCount === 0) problems.push(`No innings is marked as ${card.our_team}'s (ours: true).`);

  for (const inn of card.innings) {
    const label = `Innings ${inn.innings_no} (${inn.team_name})`;
    const positions = inn.batting.map((b) => b.position);
    if (new Set(positions).size !== positions.length) problems.push(`${label}: duplicate batting positions.`);

    const batRuns = inn.batting.reduce((sum, b) => sum + b.runs, 0);
    if (batRuns + inn.extras !== inn.runs) {
      problems.push(`${label}: batters' runs ${batRuns} + extras ${inn.extras} = ${batRuns + inn.extras}, but total is ${inn.runs}.`);
    }

    const bowledBalls = inn.bowling.reduce((sum, b) => sum + b.overs, 0);
    if (inn.bowling.length > 0 && bowledBalls !== inn.overs) {
      problems.push(`${label}: bowlers bowled ${bowledBalls} balls, but the innings lasted ${inn.overs}.`);
    }

    const bowlerWickets = inn.bowling.reduce((sum, b) => sum + b.wickets, 0);
    if (bowlerWickets > inn.wickets) {
      problems.push(`${label}: bowlers took ${bowlerWickets} wickets, more than the ${inn.wickets} that fell.`);
    }

    const dismissed = inn.batting.filter((b) => b.did_bat && !b.not_out).length;
    if (dismissed !== inn.wickets) {
      problems.push(`${label}: ${dismissed} batters are out, but ${inn.wickets} wickets fell.`);
    }
  }
  return problems;
}
