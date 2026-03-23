import { currentTeamName, currentTeamPrefix } from "@/app/config/teamConfig";
import { getCurrentUserAccess } from "@/app/services/accessControlService";
import { supabase } from "@/app/services/supabaseClient";

type TeamRow = {
  id: string;
  name: string | null;
};

export type ActiveTeamContext = {
  teamId: string;
  teamName: string;
  teamCode: string;
};

function getFallbackTeamName(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : currentTeamName;
}

function getFallbackTeamCode(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : currentTeamPrefix;
}

export async function getActiveTeamContext(): Promise<ActiveTeamContext> {
  const access = await getCurrentUserAccess();

  if (!access.teamId) {
    throw new Error("Could not load the current team.");
  }

  const { data, error } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", access.teamId)
    .single();

  if (error || !data) {
    return {
      teamId: access.teamId,
      teamName: currentTeamName,
      teamCode: currentTeamPrefix
    };
  }

  const team = data as TeamRow;

  return {
    teamId: team.id,
    teamName: getFallbackTeamName(team.name),
    teamCode: getFallbackTeamCode(null)
  };
}

export async function getActiveTeamName() {
  const context = await getActiveTeamContext();
  return context.teamName;
}

export async function getActiveTeamCode() {
  const context = await getActiveTeamContext();
  return context.teamCode;
}
