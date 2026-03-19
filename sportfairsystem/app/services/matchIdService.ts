export function buildMatchId(
  teamPrefix: string,
  matchDate: string | null,
  sameDayMatchCount = 0
) {

  if (!matchDate) return teamPrefix;

  const [year, month, day] = matchDate.split("-");

  if (!year || !month || !day) return teamPrefix;

  const shortYear = year.slice(-2);
  const baseId = `${teamPrefix}${day}${month}${shortYear}`;

  return sameDayMatchCount > 0
    ? `${baseId}+${sameDayMatchCount}`
    : baseId;

}
