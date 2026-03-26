import { getCurrentUserAccess } from "@/app/services/accessControlService";
import { supabase } from "@/app/services/supabaseClient";
import { resolveActiveTeamCode, resolveActiveTeamName } from "@/app/utils/teamBranding";

type TeamRow = {
  id: string;
  name: string | null;
  join_code: string | null;
};

export type ActiveTeamContext = {
  teamId: string;
  teamName: string;
  teamCode: string;
};

export async function getActiveTeamContext(): Promise<ActiveTeamContext> {
  const access = await getCurrentUserAccess();

  if (!access.teamId) {
    throw new Error("Could not load the current team.");
  }

  const { data, error } = await supabase
    .from("teams")
    .select("id, name, join_code")
    .eq("id", access.teamId)
    .single();

  if (error || !data) {
    return {
      teamId: access.teamId,
      teamName: resolveActiveTeamName(null),
      teamCode: resolveActiveTeamCode(null, null)
    };
  }

  const team = data as TeamRow;

  return {
    teamId: team.id,
    teamName: resolveActiveTeamName(team.name),
    teamCode: resolveActiveTeamCode(team.name, team.join_code)
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
