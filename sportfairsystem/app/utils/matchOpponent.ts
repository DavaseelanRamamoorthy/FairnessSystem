export function getOpponentName(
  teamA: string | null | undefined,
  teamB: string | null | undefined,
  currentTeamName: string
) {
  if (teamA === currentTeamName) {
    return teamB ?? null;
  }

  if (teamB === currentTeamName) {
    return teamA ?? null;
  }

  return teamB ?? teamA ?? null;
}
