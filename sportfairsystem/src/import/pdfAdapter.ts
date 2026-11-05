import { normalizeLooseTextKey } from "./legacy/matchTextNormalization";
import type { ParsedMatch } from "./legacy/match.types";
import { parseMatchFromBase64 } from "./legacy/pdfParser";
import { scorecardSchema, type Scorecard, type ScorecardInput } from "./scorecardSchema";

/** Converts the old parser's output into the shared scorecard format. */
export function parsedMatchToScorecard(parsed: ParsedMatch, ourTeam: string, matchOvers = 20): Scorecard {
  const ourKey = normalizeLooseTextKey(ourTeam);
  const isOurs = (team: string | null) => Boolean(team) && normalizeLooseTextKey(team!) === ourKey;
  const opponent = [parsed.teamA, parsed.teamB].find((team) => team && !isOurs(team)) ?? "Opponent";

  const input: ScorecardInput = {
    source: "pdf",
    match_date: parsed.matchDate ?? "",
    our_team: ourTeam,
    opponent,
    overs: matchOvers,
    result: parsed.matchResult === "Won" ? "won" : parsed.matchResult === "Lost" ? "lost" : undefined,
    result_summary: parsed.resultSummary ?? undefined,
    innings: parsed.innings.map((inn, index) => ({
      innings_no: inn.innings_number ?? index + 1,
      team_name: inn.teamName ?? `Innings ${index + 1}`,
      ours: isOurs(inn.teamName),
      runs: inn.runs ?? 0,
      wickets: inn.wickets ?? 0,
      overs: String(inn.overs ?? 0),
      extras: inn.extras ?? 0,
      batting: (inn.battingStats ?? []).map((b, i) => {
        const dismissal = (b.dismissal ?? "").trim();
        const didNotBat = /did not bat|^dnb$/i.test(dismissal);
        return {
          name: b.player_name,
          position: b.batting_position ?? i + 1,
          runs: b.runs,
          balls: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          how_out: dismissal || undefined,
          not_out: /not out|retired hurt/i.test(dismissal) || (!dismissal && !didNotBat && b.balls > 0),
          did_bat: !didNotBat
        };
      }),
      bowling: (inn.bowlingStats ?? []).map((b) => ({
        name: b.player_name,
        overs: String(b.overs),
        maidens: b.maidens,
        runs: b.runs,
        wickets: b.wickets,
        wides: b.wides ?? 0,
        no_balls: b.no_balls ?? 0
      }))
    }))
  };
  return scorecardSchema.parse(input);
}

export async function scorecardFromPdf(base64: string, ourTeam: string, matchOvers?: number) {
  const parsed = await parseMatchFromBase64(base64, ourTeam);
  return parsedMatchToScorecard(parsed, ourTeam, matchOvers);
}
