export const FALLBACK_TEAM_NAME = "Team Space";
export const FALLBACK_TEAM_CODE = "TM";

export function normalizeTeamBrandingText(value: string | null | undefined) {
  const normalizedValue = value?.trim() ?? "";
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function resolveStoredTeamJoinCode(value: string | null | undefined) {
  return normalizeTeamBrandingText(value) ?? "";
}

export function resolveActiveTeamName(value: string | null | undefined) {
  return normalizeTeamBrandingText(value) ?? FALLBACK_TEAM_NAME;
}

export function resolveActiveTeamCode(
  teamName: string | null | undefined,
  joinCode: string | null | undefined
) {
  const normalizedJoinCode = normalizeTeamBrandingText(joinCode);

  if (normalizedJoinCode) {
    return normalizedJoinCode.slice(0, 2).toUpperCase();
  }

  const normalizedTeamName = normalizeTeamBrandingText(teamName);

  if (!normalizedTeamName) {
    return FALLBACK_TEAM_CODE;
  }

  const words = normalizedTeamName.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0]?.charAt(0) ?? ""}${words[1]?.charAt(0) ?? ""}`.toUpperCase();
  }

  return normalizedTeamName.slice(0, 2).toUpperCase();
}
