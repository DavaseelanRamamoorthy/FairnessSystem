import { currentTeamName } from "@/app/config/teamConfig";
import { cleanName } from "@/app/services/cleanName";
import { supabase } from "@/app/services/supabaseClient";
import { getOpponentName } from "@/app/utils/matchOpponent";

export type SeasonOption = {
  value: string;
  label: string;
};

type MatchRow = {
  id: string;
  match_date: string | null;
  team_a: string | null;
  team_b: string | null;
  result: string | null;
  result_summary: string | null;
  match_code: string | null;
};

type InningsRow = {
  id: string;
  match_id: string;
  team_name: string | null;
  runs: number | null;
  wickets: number | null;
  overs: number | null;
  extras: number | null;
};

type BattingStatRow = {
  innings_id: string;
  player_id: string | null;
  player_name: string | null;
  runs: number | null;
  balls: number | null;
};

type BowlingStatRow = {
  innings_id: string;
  player_id: string | null;
  player_name: string | null;
  runs: number | null;
  overs: number | null;
  wickets: number | null;
};

type MatchPlayerRow = {
  match_id: string;
  player_id: string | null;
  player_name: string;
  did_bat: boolean | null;
  did_bowl: boolean | null;
};

type TeamPlayerRow = {
  id: string;
  name: string;
};

export type AnalyticsSnapshot = {
  seasons: SeasonOption[];
  metrics: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number;
    totalRuns: number;
    totalWickets: number;
    averageScore: number;
  };
  resultBreakdown: Array<{
    label: string;
    value: number;
  }>;
  matchTrend: Array<{
    label: string;
    runs: number;
    wickets: number;
  }>;
  topBatters: Array<{
    player: string;
    runs: number;
    matches: number;
    strikeRate: number | null;
  }>;
  topBowlers: Array<{
    player: string;
    wickets: number;
    matches: number;
    economy: number | null;
  }>;
  benchStats: {
    totalBenchSelections: number;
    uniquePlayers: number;
    topBenchPlayers: Array<{
      player: string;
      benchMatches: number;
      totalSquadMatches: number;
      benchRate: number;
    }>;
  };
};

function getSeasonValue(matchDate: string | null) {
  return matchDate?.slice(0, 4) ?? null;
}

function buildSeasonOptions(matches: MatchRow[]): SeasonOption[] {
  return Array.from(
    new Set(
      matches
        .map((match) => getSeasonValue(match.match_date))
        .filter((season): season is string => Boolean(season))
    )
  )
    .sort((left, right) => right.localeCompare(left))
    .map((season) => ({
      value: season,
      label: season
    }));
}

function oversToBalls(overs: number | null) {
  if (!overs) {
    return 0;
  }

  const completedOvers = Math.trunc(overs);
  const partialBalls = Math.round((overs - completedOvers) * 10);
  return completedOvers * 6 + partialBalls;
}

function getFallbackKey(name: string | null | undefined) {
  const normalizedName = cleanName(name ?? "");
  return normalizedName ? `name:${normalizedName}` : null;
}

function getResultBucket(match: Pick<MatchRow, "result" | "result_summary">) {
  const normalizedResult = (match.result ?? "").trim().toLowerCase();
  const normalizedSummary = (match.result_summary ?? "").trim().toLowerCase();

  if (normalizedResult === "won") {
    return "Won";
  }

  if (normalizedResult === "lost") {
    return "Lost";
  }

  if (normalizedResult === "draw" || normalizedSummary.includes("draw")) {
    return "Draw";
  }

  if (normalizedResult === "tie" || normalizedSummary.includes("tie")) {
    return "Tie";
  }

  return "Unknown";
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

export async function getAnalyticsSnapshot(season?: string): Promise<AnalyticsSnapshot> {
  const teamId = await getCurrentTeamId();

  const [
    { data: matchData, error: matchError },
    { data: teamPlayersData, error: teamPlayersError }
  ] = await Promise.all([
    supabase
      .from("matches")
      .select("id, match_date, team_a, team_b, result, result_summary, match_code")
      .eq("team_id", teamId)
      .order("match_date", { ascending: false }),
    supabase
      .from("players")
      .select("id, name")
      .eq("team_id", teamId)
  ]);

  if (matchError) {
    throw new Error("Could not load team matches.");
  }

  if (teamPlayersError) {
    throw new Error("Could not load team players.");
  }

  const allMatches = (matchData ?? []) as MatchRow[];
  const teamPlayers = (teamPlayersData ?? []) as TeamPlayerRow[];
  const playerNameById = new Map(teamPlayers.map((player) => [player.id, player.name]));
  const seasons = buildSeasonOptions(allMatches);
  const matches = season
    ? allMatches.filter((match) => getSeasonValue(match.match_date) === season)
    : allMatches;

  if (matches.length === 0) {
    return {
      seasons,
      metrics: {
        matches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalRuns: 0,
        totalWickets: 0,
        averageScore: 0
      },
      resultBreakdown: [
        { label: "Won", value: 0 },
        { label: "Lost", value: 0 },
        { label: "Unknown", value: 0 }
      ],
      matchTrend: [],
      topBatters: [],
      topBowlers: [],
      benchStats: {
        totalBenchSelections: 0,
        uniquePlayers: 0,
        topBenchPlayers: []
      }
    };
  }

  const matchIds = matches.map((match) => match.id);

  const { data: inningsData, error: inningsError } = await supabase
    .from("innings")
    .select("id, match_id, team_name, runs, wickets, overs, extras")
    .in("match_id", matchIds)

  if (inningsError) {
    throw new Error("Could not load innings analytics.");
  }

  const inningsRows = (inningsData ?? []) as InningsRow[];
  const battingInningsRows = inningsRows.filter((innings) => innings.team_name === currentTeamName);
  const bowlingInningsRows = inningsRows.filter((innings) => innings.team_name !== currentTeamName);
  const battingInningsIds = battingInningsRows.map((innings) => innings.id);
  const bowlingInningsIds = bowlingInningsRows.map((innings) => innings.id);

  let battingStats: BattingStatRow[] = [];
  let bowlingStats: BowlingStatRow[] = [];
  let matchPlayers: MatchPlayerRow[] = [];

  if (battingInningsIds.length > 0 || bowlingInningsIds.length > 0 || matchIds.length > 0) {
    const [
      { data: battingData, error: battingError },
      { data: bowlingData, error: bowlingError },
      { data: matchPlayersData, error: matchPlayersError }
    ] = await Promise.all([
      battingInningsIds.length > 0
        ? supabase
            .from("batting_stats")
            .select("innings_id, player_id, player_name, runs, balls")
            .in("innings_id", battingInningsIds)
        : Promise.resolve({ data: [], error: null }),
      bowlingInningsIds.length > 0
        ? supabase
            .from("bowling_stats")
            .select("innings_id, player_id, player_name, runs, overs, wickets")
            .in("innings_id", bowlingInningsIds)
        : Promise.resolve({ data: [], error: null }),
      matchIds.length > 0
        ? supabase
            .from("match_players")
            .select("match_id, player_id, player_name, did_bat, did_bowl")
            .in("match_id", matchIds)
            .eq("team_name", currentTeamName)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (battingError) {
      throw new Error("Could not load batting analytics.");
    }

    if (bowlingError) {
      throw new Error("Could not load bowling analytics.");
    }

    if (matchPlayersError) {
      throw new Error("Could not load bench analytics.");
    }

    battingStats = (battingData ?? []) as BattingStatRow[];
    bowlingStats = (bowlingData ?? []) as BowlingStatRow[];
    matchPlayers = (matchPlayersData ?? []) as MatchPlayerRow[];
  }

  const resultCounts = matches.reduce((counts, match) => {
    const bucket = getResultBucket(match);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const wins = resultCounts.get("Won") ?? 0;
  const losses = resultCounts.get("Lost") ?? 0;
  const draws = resultCounts.get("Draw") ?? 0;
  const ties = resultCounts.get("Tie") ?? 0;
  const unknown = resultCounts.get("Unknown") ?? 0;

  const totalRuns = battingInningsRows.reduce((sum, innings) => sum + (innings.runs ?? 0), 0);
  const averageScore =
    battingInningsRows.length > 0 ? Math.round(totalRuns / battingInningsRows.length) : 0;
  const totalWickets = bowlingStats.reduce((sum, row) => sum + (row.wickets ?? 0), 0);

  const runsByMatch = new Map<string, number>();
  battingInningsRows.forEach((innings) => {
    runsByMatch.set(innings.match_id, innings.runs ?? 0);
  });

  const wicketsByMatch = new Map<string, number>();
  bowlingStats.forEach((row) => {
    const innings = bowlingInningsRows.find((item) => item.id === row.innings_id);

    if (!innings) {
      return;
    }

    wicketsByMatch.set(
      innings.match_id,
      (wicketsByMatch.get(innings.match_id) ?? 0) + (row.wickets ?? 0)
    );
  });

  const matchTrend = [...matches]
    .sort((left, right) => (left.match_date ?? "").localeCompare(right.match_date ?? ""))
    .map((match) => ({
      label: match.match_code ?? getOpponentName(match.team_a, match.team_b, currentTeamName) ?? "Match",
      runs: runsByMatch.get(match.id) ?? 0,
      wickets: wicketsByMatch.get(match.id) ?? 0
    }));

  const battingTotals = new Map<string, { player: string; runs: number; balls: number; innings: Set<string> }>();
  battingStats.forEach((row) => {
    const key = row.player_id ?? getFallbackKey(row.player_name);
    const player = row.player_id
      ? (playerNameById.get(row.player_id) ?? row.player_name?.trim() ?? "Unknown")
      : row.player_name?.trim();

    if (!key || !player) {
      return;
    }

    const existing = battingTotals.get(key) ?? {
      player,
      runs: 0,
      balls: 0,
      innings: new Set<string>()
    };

    existing.runs += row.runs ?? 0;
    existing.balls += row.balls ?? 0;
    existing.innings.add(row.innings_id);
    battingTotals.set(key, existing);
  });

  const bowlingTotals = new Map<string, { player: string; wickets: number; runs: number; balls: number; innings: Set<string> }>();
  bowlingStats.forEach((row) => {
    const key = row.player_id ?? getFallbackKey(row.player_name);
    const player = row.player_id
      ? (playerNameById.get(row.player_id) ?? row.player_name?.trim() ?? "Unknown")
      : row.player_name?.trim();

    if (!key || !player) {
      return;
    }

    const existing = bowlingTotals.get(key) ?? {
      player,
      wickets: 0,
      runs: 0,
      balls: 0,
      innings: new Set<string>()
    };

    existing.wickets += row.wickets ?? 0;
    existing.runs += row.runs ?? 0;
    existing.balls += oversToBalls(row.overs);
    existing.innings.add(row.innings_id);
    bowlingTotals.set(key, existing);
  });

  const topBatters = Array.from(battingTotals.values())
    .map((totals) => ({
      player: totals.player,
      runs: totals.runs,
      matches: totals.innings.size,
      strikeRate: totals.balls > 0 ? (totals.runs / totals.balls) * 100 : null
    }))
    .sort((left, right) => right.runs - left.runs)
    .slice(0, 5);

  const topBowlers = Array.from(bowlingTotals.values())
    .map((totals) => ({
      player: totals.player,
      wickets: totals.wickets,
      matches: totals.innings.size,
      economy: totals.balls > 0 ? totals.runs / (totals.balls / 6) : null
    }))
    .sort((left, right) => right.wickets - left.wickets)
    .slice(0, 5);

  const benchTotals = new Map<string, { player: string; benchMatches: number; totalSquadMatches: Set<string> }>();
  matchPlayers.forEach((row) => {
    const key = row.player_id ?? getFallbackKey(row.player_name);
    const player = row.player_id
      ? (playerNameById.get(row.player_id) ?? row.player_name?.trim() ?? "Unknown")
      : row.player_name?.trim();

    if (!key || !player) {
      return;
    }

    const existing = benchTotals.get(key) ?? {
      player,
      benchMatches: 0,
      totalSquadMatches: new Set<string>()
    };

    existing.totalSquadMatches.add(row.match_id);

    if (!row.did_bat && !row.did_bowl) {
      existing.benchMatches += 1;
    }

    benchTotals.set(key, existing);
  });

  const benchPlayers = Array.from(benchTotals.values())
    .map((totals) => ({
      player: totals.player,
      benchMatches: totals.benchMatches,
      totalSquadMatches: totals.totalSquadMatches.size,
      benchRate:
        totals.totalSquadMatches.size > 0
          ? Math.round((totals.benchMatches / totals.totalSquadMatches.size) * 100)
          : 0
    }))
    .filter((player) => player.benchMatches > 0)
    .sort((left, right) => {
      if (right.benchMatches !== left.benchMatches) {
        return right.benchMatches - left.benchMatches;
      }

      return right.benchRate - left.benchRate;
    });

  const topBenchPlayers = benchPlayers;

  return {
    seasons,
    metrics: {
      matches: matches.length,
      wins,
      losses,
      winRate: matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0,
      totalRuns,
      totalWickets,
      averageScore
    },
    resultBreakdown: [
      { label: "Won", value: wins },
      { label: "Lost", value: losses },
      { label: "Draw", value: draws },
      { label: "Tie", value: ties },
      { label: "Unknown", value: unknown }
    ],
    matchTrend,
    topBatters,
    topBowlers,
    benchStats: {
      totalBenchSelections: benchPlayers.reduce((sum, player) => sum + player.benchMatches, 0),
      uniquePlayers: benchPlayers.length,
      topBenchPlayers
    }
  };
}
