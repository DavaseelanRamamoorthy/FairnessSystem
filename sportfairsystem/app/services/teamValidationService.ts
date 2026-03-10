import { ParsedMatch } from "../types/match.types";

export function normalizeTeamName(name: string | null | undefined) {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function isMatchForCurrentTeam(
  parsedMatch: ParsedMatch,
  teamName: string
) {
  const normalizedCurrentTeam = normalizeTeamName(teamName);

  return [parsedMatch.teamA, parsedMatch.teamB].some(
    (team) => normalizeTeamName(team) === normalizedCurrentTeam
  );
}
