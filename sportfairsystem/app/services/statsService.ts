import { currentTeamName } from "@/app/config/teamConfig";
import { supabase } from "./supabaseClient";
import { getOpponentName } from "@/app/utils/matchOpponent";

type MatchRow = {
  id: string;
  result: string | null;
};

type InningsRow = {
  id: string;
  match_id: string;
  team_name: string | null;
  runs: number | null;
  wickets: number | null;
  matches?: Array<{
    team_a: string | null;
    team_b: string | null;
    match_date: string | null;
  }> | null;
};

type BattingStatRow = {
  player_name: string | null;
  runs: number | null;
};

type BowlingStatRow = {
  player_name: string | null;
  wickets: number | null;
};

type TeamMatchContext = {
  matchIds: string[];
  battingInnings: InningsRow[];
  bowlingInnings: InningsRow[];
};

function getMatchMeta(innings: InningsRow) {
  return Array.isArray(innings.matches) ? innings.matches[0] : null;
}

async function getCurrentTeamId() {
  const { data: teamData, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("name", currentTeamName)
    .single();

  if (teamError || !teamData) {
    throw new Error("Could not load the current team.");
  }

  return teamData.id as string;
}

async function getCurrentTeamMatches() {
  const teamId = await getCurrentTeamId();

  const { data, error } = await supabase
    .from("matches")
    .select("id, result")
    .eq("team_id", teamId);

  if (error) {
    throw new Error("Could not load team matches.");
  }

  return (data ?? []) as MatchRow[];
}

async function getTeamMatchContext(): Promise<TeamMatchContext> {
  const teamId = await getCurrentTeamId();

  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select("id")
    .eq("team_id", teamId);

  if (matchError) {
    throw new Error("Could not load team matches.");
  }

  const matchIds = (matchData ?? []).map((match) => match.id as string);

  if (matchIds.length === 0) {
    return {
      matchIds: [],
      battingInnings: [],
      bowlingInnings: []
    };
  }

  const { data: inningsData, error: inningsError } = await supabase
    .from("innings")
    .select(`
      id,
      match_id,
      team_name,
      runs,
      wickets,
      matches (
        team_a,
        team_b,
        match_date
      )
    `)
    .in("match_id", matchIds);

  if (inningsError) {
    throw new Error("Could not load innings context.");
  }

  const innings = (inningsData ?? []) as InningsRow[];

  return {
    matchIds,
    battingInnings: innings.filter((row) => row.team_name === currentTeamName),
    bowlingInnings: innings.filter((row) => row.team_name !== currentTeamName)
  };
}

async function getAggregatedBattingTotals() {
  const { battingInnings } = await getTeamMatchContext();
  const inningsIds = battingInnings.map((innings) => innings.id);

  if (inningsIds.length === 0) {
    return [] as Array<{ player: string; runs: number }>;
  }

  const { data, error } = await supabase
    .from("batting_stats")
    .select("player_name, runs")
    .in("innings_id", inningsIds);

  if (error) {
    throw new Error("Could not load batting statistics.");
  }

  const totals: Record<string, number> = {};

  ((data ?? []) as BattingStatRow[]).forEach((row) => {
    const player = row.player_name?.trim();

    if (!player) {
      return;
    }

    totals[player] = (totals[player] ?? 0) + (row.runs ?? 0);
  });

  return Object.entries(totals)
    .map(([player, runs]) => ({ player, runs }))
    .sort((left, right) => right.runs - left.runs);
}

async function getAggregatedBowlingTotals() {
  const { bowlingInnings } = await getTeamMatchContext();
  const inningsIds = bowlingInnings.map((innings) => innings.id);

  if (inningsIds.length === 0) {
    return [] as Array<{ player: string; wickets: number }>;
  }

  const { data, error } = await supabase
    .from("bowling_stats")
    .select("player_name, wickets")
    .in("innings_id", inningsIds);

  if (error) {
    throw new Error("Could not load bowling statistics.");
  }

  const totals: Record<string, number> = {};

  ((data ?? []) as BowlingStatRow[]).forEach((row) => {
    const player = row.player_name?.trim();

    if (!player) {
      return;
    }

    totals[player] = (totals[player] ?? 0) + (row.wickets ?? 0);
  });

  return Object.entries(totals)
    .map(([player, wickets]) => ({ player, wickets }))
    .sort((left, right) => right.wickets - left.wickets);
}

export async function getMatchesPlayed() {
  try {
    const matches = await getCurrentTeamMatches();
    return matches.length;
  } catch (error) {
    console.error(error);
    return 0;
  }
}

export async function getWinRate() {
  try {
    const matches = await getCurrentTeamMatches();
    const total = matches.length;

    if (total === 0) {
      return 0;
    }

    const wins = matches.filter((match) => match.result === "Won").length;
    return Math.round((wins / total) * 100);
  } catch (error) {
    console.error(error);
    return 0;
  }
}

export async function getTopRunScorer() {
  try {
    const totals = await getAggregatedBattingTotals();

    if (totals.length === 0) {
      return null;
    }

    return totals[0];
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function getTopWicketTaker() {
  try {
    const totals = await getAggregatedBowlingTotals();

    if (totals.length === 0) {
      return null;
    }

    return totals[0];
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function getTopRunLeaders(limit = 5) {
  try {
    const totals = await getAggregatedBattingTotals();
    return totals.slice(0, limit);
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getTopWicketLeaders(limit = 5) {
  try {
    const totals = await getAggregatedBowlingTotals();
    return totals.slice(0, limit);
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getRunsPerMatch(teamName: string) {
  try {
    void teamName;
    const { battingInnings } = await getTeamMatchContext();

    return [...battingInnings]
      .sort((left, right) =>
        (getMatchMeta(left)?.match_date ?? "").localeCompare(getMatchMeta(right)?.match_date ?? "")
      )
      .slice(-5)
      .map((item) => ({
        match: getOpponentName(
          getMatchMeta(item)?.team_a,
          getMatchMeta(item)?.team_b,
          currentTeamName
        ) || "Unknown",
        runs: item.runs ?? 0
      }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getWicketsPerMatch(teamName: string) {
  try {
    void teamName;
    const { bowlingInnings } = await getTeamMatchContext();

    return [...bowlingInnings]
      .sort((left, right) =>
        (getMatchMeta(left)?.match_date ?? "").localeCompare(getMatchMeta(right)?.match_date ?? "")
      )
      .slice(-5)
      .map((item) => ({
        match: getOpponentName(
          getMatchMeta(item)?.team_a,
          getMatchMeta(item)?.team_b,
          currentTeamName
        ) || "Unknown",
        wickets: item.wickets ?? 0
      }));
  } catch (error) {
    console.error(error);
    return [];
  }
}
