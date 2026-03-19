import { ParsedMatch } from "@/app/types/match.types";
import {
  CricketRuleFinding,
  CricketRulebook,
  inferCricketRulebook
} from "@/app/services/cricketRulebook";
import { normalizeNameKey, normalizeMatchWhitespace } from "@/app/services/matchTextNormalization";

type RuleEvaluationResult = {
  rulebook: CricketRulebook;
  findings: CricketRuleFinding[];
};

function uniqueNames(names: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      names
        .map((name) => normalizeNameKey(name ?? ""))
        .filter(Boolean)
    )
  );
}

function countMarkedPlayers(
  parsedMatch: ParsedMatch,
  teamName: string | null,
  marker: "captain" | "wicketKeeper"
) {
  if (!teamName) {
    return 0;
  }

  const squad = parsedMatch.squads?.find((item) => item.teamName === teamName);

  if (!squad) {
    return 0;
  }

  return squad.players.filter((player) =>
    marker === "captain" ? player.isCaptain : player.isWicketKeeper
  ).length;
}

function buildTwelveManFinding(
  teamName: string,
  playerCount: number,
  rulebook: CricketRulebook
): CricketRuleFinding {
  const extraPlayers = playerCount - rulebook.playingXiSize;
  const playerLabel = extraPlayers === 1 ? "1 extra player" : `${extraPlayers} extra players`;

  return {
    id: `playing-xi-${normalizeNameKey(teamName)}`,
    severity: "warning",
    title: `${teamName} exceeds the standard playing XI`,
    summary: `${teamName} currently shows ${playerCount} listed players, which is above the standard XI size of ${rulebook.playingXiSize}.`,
    recommendation: `Review the extra listing as a likely 12th man or substitute. Keep only ${rulebook.playingXiSize} players in the XI unless match evidence clearly supports a permitted replacement. Found ${playerLabel}.`
  };
}

export function evaluateParsedMatchAgainstCricketRulebook(
  parsedMatch: ParsedMatch
): RuleEvaluationResult {
  const rulebook = inferCricketRulebook(parsedMatch.matchTitle, parsedMatch.competitionName);
  const findings: CricketRuleFinding[] = [];

  parsedMatch.innings.forEach((innings, index) => {
    const teamName = innings.teamName ?? `Innings ${index + 1}`;
    const playingXiCount = uniqueNames(innings.playing11 ?? []).length;
    const activeParticipantCount = uniqueNames([
      ...(innings.battingStats?.map((player) => player.player_name) ?? []),
      ...(innings.bowlingStats?.map((player) => player.player_name) ?? [])
    ]).length;

    if (playingXiCount > rulebook.playingXiSize) {
      findings.push(buildTwelveManFinding(teamName, playingXiCount, rulebook));
    }

    if (
      activeParticipantCount > rulebook.playingXiSize
      && activeParticipantCount >= playingXiCount
    ) {
      findings.push({
        id: `active-participants-${normalizeNameKey(teamName)}`,
        severity: "error",
        title: `${teamName} has more than 11 active participants`,
        summary: `${teamName} shows ${activeParticipantCount} players with batting or bowling involvement, which conflicts with the standard playing XI size of ${rulebook.playingXiSize}.`,
        recommendation: "Review the scorecard for parser duplication, substitute handling, or an incorrect XI merge before saving."
      });
    }

    const captainCount = countMarkedPlayers(parsedMatch, innings.teamName, "captain");
    if (captainCount > 1) {
      findings.push({
        id: `captain-count-${normalizeNameKey(teamName)}`,
        severity: "warning",
        title: `${teamName} has multiple captains marked`,
        summary: `${teamName} currently has ${captainCount} players marked as captain in the parsed squad view.`,
        recommendation: "Keep only one captain in the match context unless the scorecard explicitly records a captain change."
      });
    }

    const wicketKeeperCount = countMarkedPlayers(parsedMatch, innings.teamName, "wicketKeeper");
    if (wicketKeeperCount > 1) {
      findings.push({
        id: `wicket-keeper-count-${normalizeNameKey(teamName)}`,
        severity: "warning",
        title: `${teamName} has multiple wicket keepers marked`,
        summary: `${teamName} currently has ${wicketKeeperCount} players marked as wicket keeper in the parsed squad view.`,
        recommendation: "Confirm whether this is a real mid-match keeping change or a parsing artifact before saving."
      });
    }
  });

  if (parsedMatch.innings.length >= 2) {
    const [firstInnings, secondInnings] = parsedMatch.innings;
    const scoresAreLevel = firstInnings.runs !== null
      && secondInnings.runs !== null
      && firstInnings.runs === secondInnings.runs;
    const resultSummary = normalizeMatchWhitespace(parsedMatch.resultSummary ?? "").toLowerCase();

    if (scoresAreLevel && !resultSummary.includes("tie")) {
      findings.push({
        id: "result-consistency-tie",
        severity: "warning",
        title: "Result summary should be reviewed",
        summary: "The innings totals are level, but the parsed result summary does not explicitly mention a tie.",
        recommendation: "Confirm whether the match was tied, decided by a super over, or saved with an incomplete result line."
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      id: "icc-rulebook-clear",
      severity: "info",
      title: "No rulebook issues detected",
      summary: `The parsed match passed the current ${rulebook.defaultFormat} checks for XI size, captain/wicket-keeper uniqueness, and basic result consistency.`,
      recommendation: "You can still review the scorecard manually if the competition has local playing-condition overrides."
    });
  }

  return {
    rulebook,
    findings
  };
}
