import { currentTeamName } from "@/app/config/teamConfig";
import { cleanName } from "@/app/services/cleanName";
import { supabase } from "@/app/services/supabaseClient";
import { getOpponentName } from "@/app/utils/matchOpponent";

export type SquadPlayer = {
  id: string;
  name: string;
};

export type SeasonOption = {
  value: string;
  label: string;
};

type MatchPlayerRow = {
  match_id: string;
  player_name: string;
  did_bat: boolean | null;
  did_bowl: boolean | null;
};

type InningsRow = {
  id: string;
  match_id: string;
};

type MatchRow = {
  id: string;
  match_date: string | null;
  team_a: string | null;
  team_b: string | null;
  result: string | null;
  match_code: string | null;
};

type BattingStatRow = {
  innings_id: string;
  player_name: string | null;
  runs: number | null;
  balls: number | null;
};

type BowlingStatRow = {
  innings_id: string;
  player_name: string | null;
  runs: number | null;
  overs: number | null;
  wickets: number | null;
};

type AggregatedPlayerStats = {
  matchIds: Set<string>;
  battingMatchIds: Set<string>;
  bowlingMatchIds: Set<string>;
  battingRuns: number;
  battingBalls: number;
  bowlingRuns: number;
  bowlingBalls: number;
  bowlingWickets: number;
};

export type PlayerSummary = {
  id: string;
  name: string;
  matchesPlayed: number;
  role: "Batter" | "Bowler" | "Player";
  performanceLabel: string;
  performanceColor: "primary" | "warning" | "default";
};

export type PlayerProfile = {
  id: string;
  name: string;
  matchesPlayed: number;
  battingMatches: number;
  bowlingMatches: number;
  totalRuns: number;
  strikeRate: number | null;
  totalWickets: number;
  economy: number | null;
  role: "Batter" | "Bowler" | "Player";
  recentMatches: Array<{
    id: string;
    matchDate: string | null;
    opponentName: string | null;
    result: string | null;
    matchCode: string | null;
    runs: number;
    wickets: number;
  }>;
};

function oversToBalls(overs: number) {
  const completedOvers = Math.trunc(overs);
  const partialBalls = Math.round((overs - completedOvers) * 10);
  return completedOvers * 6 + partialBalls;
}

function getSeasonValue(matchDate: string | null) {
  return matchDate?.slice(0, 4) ?? null;
}

function buildSeasonOptions(matches: Array<Pick<MatchRow, "match_date">>): SeasonOption[] {
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
      label: `${season} Season`
    }));
}

function createEmptyStats(): AggregatedPlayerStats {
  return {
    matchIds: new Set<string>(),
    battingMatchIds: new Set<string>(),
    bowlingMatchIds: new Set<string>(),
    battingRuns: 0,
    battingBalls: 0,
    bowlingRuns: 0,
    bowlingBalls: 0,
    bowlingWickets: 0
  };
}

function buildPlayerSummary(player: SquadPlayer, stats: AggregatedPlayerStats): PlayerSummary {
  const matchesPlayed = stats.matchIds.size;
  const battingMatches = stats.battingMatchIds.size;
  const bowlingMatches = stats.bowlingMatchIds.size;

  const strikeRate =
    stats.battingBalls > 0
      ? (stats.battingRuns / stats.battingBalls) * 100
      : null;

  const economy =
    stats.bowlingBalls > 0
      ? stats.bowlingRuns / (stats.bowlingBalls / 6)
      : null;

  if (bowlingMatches > battingMatches && economy !== null) {
    return {
      id: player.id,
      name: player.name,
      matchesPlayed,
      role: "Bowler",
      performanceLabel: `Economy ${economy.toFixed(2)}`,
      performanceColor: "warning"
    };
  }

  if (strikeRate !== null) {
    return {
      id: player.id,
      name: player.name,
      matchesPlayed,
      role: "Batter",
      performanceLabel: `Strike Rate ${strikeRate.toFixed(2)}`,
      performanceColor: "primary"
    };
  }

  if (economy !== null) {
    return {
      id: player.id,
      name: player.name,
      matchesPlayed,
      role: "Bowler",
      performanceLabel: `Economy ${economy.toFixed(2)}`,
      performanceColor: "warning"
    };
  }

  return {
    id: player.id,
    name: player.name,
    matchesPlayed,
    role: "Player",
    performanceLabel: "No performance data yet",
    performanceColor: "default"
  };
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

async function loadSharedPlayerData(teamId: string, season?: string) {
  const { data: squadData, error: squadError } = await supabase
    .from("players")
    .select("id, name")
    .eq("team_id", teamId)
    .eq("is_guest", false)
    .order("name", { ascending: true });

  if (squadError) {
    throw new Error("Could not load squad players.");
  }

  const squadPlayers = (squadData ?? []) as SquadPlayer[];

  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select("id, match_date, team_a, team_b, result, match_code")
    .eq("team_id", teamId)
    .order("match_date", { ascending: false });

  if (matchError) {
    throw new Error("Could not load team matches.");
  }

  const allMatches = (matchData ?? []) as MatchRow[];
  const matches = season
    ? allMatches.filter((match) => getSeasonValue(match.match_date) === season)
    : allMatches;
  const matchIds = matches.map((match) => match.id);

  if (matchIds.length === 0) {
    return {
      squadPlayers,
      matches,
      matchPlayers: [] as MatchPlayerRow[],
      inningsRows: [] as InningsRow[],
      battingStats: [] as BattingStatRow[],
      bowlingStats: [] as BowlingStatRow[]
    };
  }

  const { data: matchPlayersData, error: matchPlayersError } = await supabase
    .from("match_players")
    .select("match_id, player_name, did_bat, did_bowl")
    .in("match_id", matchIds)
    .eq("team_name", currentTeamName);

  if (matchPlayersError) {
    throw new Error("Could not load squad appearances.");
  }

  const { data: inningsData, error: inningsError } = await supabase
    .from("innings")
    .select("id, match_id")
    .in("match_id", matchIds);

  if (inningsError) {
    throw new Error("Could not load innings data.");
  }

  const inningsRows = (inningsData ?? []) as InningsRow[];
  const inningsIds = inningsRows.map((innings) => innings.id);

  let battingStats: BattingStatRow[] = [];
  let bowlingStats: BowlingStatRow[] = [];

  if (inningsIds.length > 0) {
    const [
      { data: battingData, error: battingError },
      { data: bowlingData, error: bowlingError }
    ] = await Promise.all([
      supabase
        .from("batting_stats")
        .select("innings_id, player_name, runs, balls")
        .in("innings_id", inningsIds),
      supabase
        .from("bowling_stats")
        .select("innings_id, player_name, runs, overs, wickets")
        .in("innings_id", inningsIds)
    ]);

    if (battingError) {
      throw new Error("Could not load batting statistics.");
    }

    if (bowlingError) {
      throw new Error("Could not load bowling statistics.");
    }

    battingStats = (battingData ?? []) as BattingStatRow[];
    bowlingStats = (bowlingData ?? []) as BowlingStatRow[];
  }

  return {
    squadPlayers,
    matches,
    matchPlayers: (matchPlayersData ?? []) as MatchPlayerRow[],
    inningsRows,
    battingStats,
    bowlingStats
  };
}

function aggregatePlayerStats(
  squadPlayers: SquadPlayer[],
  matchPlayers: MatchPlayerRow[],
  inningsRows: InningsRow[],
  battingStats: BattingStatRow[],
  bowlingStats: BowlingStatRow[]
) {
  const statsByPlayer = new Map<string, AggregatedPlayerStats>();

  squadPlayers.forEach((player) => {
    statsByPlayer.set(cleanName(player.name), createEmptyStats());
  });

  const inningsToMatchId = new Map(
    inningsRows.map((innings) => [innings.id, innings.match_id])
  );

  matchPlayers.forEach((row) => {
    const normalizedName = cleanName(row.player_name);
    const playerStats = statsByPlayer.get(normalizedName);

    if (!playerStats) {
      return;
    }

    playerStats.matchIds.add(row.match_id);

    if (row.did_bat) {
      playerStats.battingMatchIds.add(row.match_id);
    }

    if (row.did_bowl) {
      playerStats.bowlingMatchIds.add(row.match_id);
    }
  });

  battingStats.forEach((row) => {
    const normalizedName = cleanName(row.player_name ?? "");
    const playerStats = statsByPlayer.get(normalizedName);

    if (!playerStats) {
      return;
    }

    const matchId = inningsToMatchId.get(row.innings_id);

    if (matchId) {
      playerStats.matchIds.add(matchId);
      playerStats.battingMatchIds.add(matchId);
    }

    playerStats.battingRuns += row.runs ?? 0;
    playerStats.battingBalls += row.balls ?? 0;
  });

  bowlingStats.forEach((row) => {
    const normalizedName = cleanName(row.player_name ?? "");
    const playerStats = statsByPlayer.get(normalizedName);

    if (!playerStats) {
      return;
    }

    const matchId = inningsToMatchId.get(row.innings_id);

    if (matchId) {
      playerStats.matchIds.add(matchId);
      playerStats.bowlingMatchIds.add(matchId);
    }

    playerStats.bowlingRuns += row.runs ?? 0;
    playerStats.bowlingBalls += oversToBalls(row.overs ?? 0);
    playerStats.bowlingWickets += row.wickets ?? 0;
  });

  return statsByPlayer;
}

export async function getPlayerSeasons() {
  const teamId = await getCurrentTeamId();
  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select("match_date")
    .eq("team_id", teamId)
    .order("match_date", { ascending: false });

  if (matchError) {
    throw new Error("Could not load team seasons.");
  }

  const matches = (matchData ?? []) as Pick<MatchRow, "match_date">[];
  return buildSeasonOptions(matches);
}

export async function getSquadPlayerSummaries(season?: string) {
  const teamId = await getCurrentTeamId();
  const {
    squadPlayers,
    matchPlayers,
    inningsRows,
    battingStats,
    bowlingStats
  } = await loadSharedPlayerData(teamId, season);

  const statsByPlayer = aggregatePlayerStats(
    squadPlayers,
    matchPlayers,
    inningsRows,
    battingStats,
    bowlingStats
  );

  return squadPlayers
    .map((player) => buildPlayerSummary(
      player,
      statsByPlayer.get(cleanName(player.name)) ?? createEmptyStats()
    ))
    .sort((left, right) => {
      if (right.matchesPlayed !== left.matchesPlayed) {
        return right.matchesPlayed - left.matchesPlayed;
      }

      return left.name.localeCompare(right.name);
    });
}

export async function getPlayerProfile(playerId: string, season?: string): Promise<PlayerProfile> {
  const teamId = await getCurrentTeamId();
  const {
    squadPlayers,
    matches,
    matchPlayers,
    inningsRows,
    battingStats,
    bowlingStats
  } = await loadSharedPlayerData(teamId, season);

  const player = squadPlayers.find((item) => item.id === playerId);

  if (!player) {
    throw new Error("Player not found.");
  }

  const statsByPlayer = aggregatePlayerStats(
    squadPlayers,
    matchPlayers,
    inningsRows,
    battingStats,
    bowlingStats
  );

  const normalizedName = cleanName(player.name);
  const stats = statsByPlayer.get(normalizedName) ?? createEmptyStats();
  const summary = buildPlayerSummary(player, stats);
  const matchIdSet = stats.matchIds;
  const inningsToMatchId = new Map(
    inningsRows.map((innings) => [innings.id, innings.match_id])
  );

  const runsByMatch = new Map<string, number>();
  battingStats.forEach((row) => {
    if (cleanName(row.player_name ?? "") !== normalizedName) {
      return;
    }

    const matchId = inningsToMatchId.get(row.innings_id);
    if (!matchId) {
      return;
    }

    runsByMatch.set(matchId, (runsByMatch.get(matchId) ?? 0) + (row.runs ?? 0));
  });

  const wicketsByMatch = new Map<string, number>();
  bowlingStats.forEach((row) => {
    if (cleanName(row.player_name ?? "") !== normalizedName) {
      return;
    }

    const matchId = inningsToMatchId.get(row.innings_id);
    if (!matchId) {
      return;
    }

    wicketsByMatch.set(matchId, (wicketsByMatch.get(matchId) ?? 0) + (row.wickets ?? 0));
  });

  const strikeRate =
    stats.battingBalls > 0
      ? (stats.battingRuns / stats.battingBalls) * 100
      : null;

  const economy =
    stats.bowlingBalls > 0
      ? stats.bowlingRuns / (stats.bowlingBalls / 6)
      : null;

  const recentMatches = matches
    .filter((match) => matchIdSet.has(match.id))
    .map((match) => ({
      id: match.id,
      matchDate: match.match_date,
      opponentName: getOpponentName(match.team_a, match.team_b, currentTeamName),
      result: match.result,
      matchCode: match.match_code,
      runs: runsByMatch.get(match.id) ?? 0,
      wickets: wicketsByMatch.get(match.id) ?? 0
    }))
    .sort((left, right) => {
      return (right.matchDate ?? "").localeCompare(left.matchDate ?? "");
    })
    .slice(0, 8);

  return {
    id: player.id,
    name: player.name,
    matchesPlayed: stats.matchIds.size,
    battingMatches: stats.battingMatchIds.size,
    bowlingMatches: stats.bowlingMatchIds.size,
    totalRuns: stats.battingRuns,
    strikeRate,
    totalWickets: stats.bowlingWickets,
    economy,
    role: summary.role,
    recentMatches
  };
}
