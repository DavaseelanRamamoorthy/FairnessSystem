import { supabase } from "@/app/services/supabaseClient";

export type TeamOnboardingResult = {
  teamId: string;
  memberId: string;
  teamName: string;
  joinCode: string;
  createdTeam: boolean;
  createdMember: boolean;
};

type RawTeamOnboardingRow = {
  team_id?: unknown;
  member_id?: unknown;
  team_name?: unknown;
  join_code?: unknown;
  created_team?: unknown;
  created_member?: unknown;
};

function normalizeOptionalText(value: string | null | undefined) {
  const normalizedValue = value?.trim() ?? "";
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function mapTeamOnboardingResult(row: RawTeamOnboardingRow | null | undefined): TeamOnboardingResult {
  const teamId = typeof row?.team_id === "string" ? row.team_id : "";
  const memberId = typeof row?.member_id === "string" ? row.member_id : "";
  const teamName = typeof row?.team_name === "string" ? row.team_name : "";
  const joinCode = typeof row?.join_code === "string" ? row.join_code : "";

  if (!teamId || !memberId || !teamName || !joinCode) {
    throw new Error("The team onboarding response was incomplete.");
  }

  return {
    teamId,
    memberId,
    teamName,
    joinCode,
    createdTeam: row?.created_team === true,
    createdMember: row?.created_member === true
  };
}

export function normalizeJoinCodeInput(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
}

export async function createTeamWorkspace(teamName: string, preferredMemberName?: string | null) {
  const normalizedTeamName = normalizeOptionalText(teamName);

  if (!normalizedTeamName) {
    throw new Error("Enter a team name before creating the team.");
  }

  const { data, error } = await supabase.rpc("create_team_workspace", {
    next_team_name: normalizedTeamName,
    preferred_member_name: normalizeOptionalText(preferredMemberName)
  });

  if (error) {
    throw new Error(error.message || "Could not create the team.");
  }

  return mapTeamOnboardingResult(Array.isArray(data) ? (data[0] as RawTeamOnboardingRow | undefined) : null);
}

export async function joinTeamWithCode(joinCode: string, preferredMemberName?: string | null) {
  const normalizedJoinCode = normalizeJoinCodeInput(joinCode);

  if (normalizedJoinCode.length !== 6) {
    throw new Error("Enter the 6-character Team ID before joining.");
  }

  const { data, error } = await supabase.rpc("join_team_with_code", {
    raw_join_code: normalizedJoinCode,
    preferred_member_name: normalizeOptionalText(preferredMemberName)
  });

  if (error) {
    throw new Error(error.message || "Could not join the team.");
  }

  return mapTeamOnboardingResult(Array.isArray(data) ? (data[0] as RawTeamOnboardingRow | undefined) : null);
}
