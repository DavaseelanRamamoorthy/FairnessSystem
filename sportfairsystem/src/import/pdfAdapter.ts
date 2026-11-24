import { normalizeLooseTextKey } from "./legacy/matchTextNormalization";
import type { ParsedMatch } from "./legacy/match.types";
import { parseMatchFromBase64 } from "./legacy/pdfParser";
import { scorecardSchema, type Scorecard, type ScorecardInput } from "./scorecardSchema";

/** Converts the old parser's output into the shared scorecard format. */
export function parsedMatchToScorecard(parsed: ParsedMatch, ourTeam: string, matchOvers = 20): Scorecard {
  const ourKey = normalizeLooseTextKey(ourTeam);
  // CricHeroes showed the club as "Moonwalkers Cricket Club" for part of 2025.
  const ourKeys = new Set([ourKey, normalizeLooseTextKey(`${ourTeam} Cricket Club`), normalizeLooseTextKey(`${ourTeam} CC`)]);
  const isOurs = (team: string | null) => Boolean(team) && ourKeys.has(normalizeLooseTextKey(team!));
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
      // Some CricHeroes PDFs print the extras figure with stray digits
      // ("00230" for 5). When it doesn't add up, use total minus the batters.
      extras: (() => {
        const batted = (inn.battingStats ?? []).reduce((sum, b) => sum + (b.runs ?? 0), 0);
        const printed = inn.extras ?? 0;
        const derived = (inn.runs ?? 0) - batted;
        return batted + printed === (inn.runs ?? 0) || derived < 0 ? printed : derived;
      })(),
      // Players in the XI who never came in to bat ("To Bat") still played.
      batting: [
        ...(inn.battingStats ?? []),
        ...(inn.playing11 ?? [])
          // The list can run into the fall-of-wickets text ("21-2 Naveen", "0.4 ov").
          .map((name) => name.replace(/^fall of wickets\s*/i, "").replace(/^\d+-\d+\s*/, "").trim())
          .filter((name) => name && !/\d/.test(name) && !/^fall of wickets/i.test(name))
          .filter((name, index, all) => all.indexOf(name) === index)
          .filter((name) => !(inn.battingStats ?? []).some((b) => normalizeLooseTextKey(b.player_name) === normalizeLooseTextKey(name)))
          .map((name) => ({ player_name: name, batting_position: undefined as number | undefined, dismissal: "did not bat", runs: 0, balls: 0, fours: 0, sixes: 0, strike_rate: 0 }))
      ].slice(0, 15).map((b, i) => {
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
