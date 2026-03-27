import { getActiveTeamContext } from "@/app/services/teamContextService";
import { supabase } from "@/app/services/supabaseClient";
import { getOpponentName } from "@/app/utils/matchOpponent";

type DashboardMatchRow = {
  id: string;
  match_date: string | null;
  team_a: string | null;
  team_b: string | null;
  result: string | null;
  result_summary: string | null;
  match_code: string | null;
};

export type DashboardRecentMatch = {
  id: string;
  matchDate: string | null;
  opponentName: string | null;
  result: string | null;
  resultSummary: string | null;
  matchCode: string | null;
};

export async function getDashboardRecentMatches(limit = 5): Promise<DashboardRecentMatch[]> {
  const { teamId, teamName } = await getActiveTeamContext();
  const { data, error } = await supabase
    .from("matches")
    .select("id, match_date, team_a, team_b, result, result_summary, match_code")
    .eq("team_id", teamId)
    .order("match_date", { ascending: false })
    .order("match_code", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error("Could not load recent team matches.");
  }

  return ((data ?? []) as DashboardMatchRow[]).map((match) => ({
    id: match.id,
    matchDate: match.match_date,
    opponentName: getOpponentName(match.team_a, match.team_b, teamName),
    result: match.result,
    resultSummary: match.result_summary,
    matchCode: match.match_code
  }));
}

