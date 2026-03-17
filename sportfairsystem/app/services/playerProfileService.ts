import { currentTeamName } from "@/app/config/teamConfig";
import { cleanName } from "@/app/services/cleanName";
import {
  getCurrentTeamId,
  mapSquadPlayerRecord,
  SquadPlayerRecord
} from "@/app/services/squadService";
import { supabase } from "@/app/services/supabaseClient";
import { getOpponentName } from "@/app/utils/matchOpponent";
import { Innings } from "@/app/types/match.types";

export type SquadPlayer = SquadPlayerRecord;

export type SeasonOption = {
  value: string;
  label: string;
};

type MatchPlayerRow = {
  match_id: string;
  player_id: string | null;
  player_name: string;
  did_bat: boolean | null;
  did_bowl: boolean | null;
};

type InningsRow = {
  id: string;
  match_id: string;
  team_name: string | null;
};

type MatchRow = {
  id: string;
  match_date: string | null;
  team_a: string | null;
  team_b: string | null;
  result: string | null;
  result_summary?: string | null;
  match_code: string | null;
};

type MatchPlayerDetailRow = {
  team_name: string | null;
  player_name: string;
};

type MatchDetailRow = MatchRow & {
  winner?: string | null;
  innings?: Array<{
    id?: string;
    team_name: string | null;
    runs: number | null;
    wickets: number | null;
    overs: number | null;
    extras?: number | null;
    batting_stats?: NonNullable<Innings["battingStats"]>;
    bowling_stats?: NonNullable<Innings["bowlingStats"]>;
    fall_of_wickets?: Array<{
      score: number;
      wicket_number: number;
      batsman: string;
      over: number;
    }>;
  }>;
  match_players?: MatchPlayerDetailRow[];
};

type BattingStatRow = {
  innings_id: string;
  player_id: string | null;
  player_name: string | null;
  dismissal: string | null;
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
  battingStyle: string | null;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  roleTags: string[];
};

export type PlayerProfile = {
  id: string;
  name: string;
  matchesPlayed: number;
  totalTeamMatches: number;
  activeMatches: number;
  benchMatches: number;
  battingMatches: number;
  bowlingMatches: number;
  totalRuns: number;
  catches: number;
  strikeRate: number | null;
  totalWickets: number;
  economy: number | null;
  role: "Batter" | "Bowler" | "Player";
  battingStyle: string | null;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  roleTags: string[];
  recentMatches: Array<{
    id: string;
    matchDate: string | null;
    opponentName: string | null;
    result: string | null;
    resultSummary: string | null;
    matchCode: string | null;
    scorecard: MatchDetailRow;
    runs: number;
    wickets: number;
  }>;
};

type SquadPlayerSummaryOptions = {
  includeInactiveForSeason?: boolean;
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
      label: season
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

function resolveSquadPlayerId(
  playerId: string | null | undefined,
  playerName: string | null | undefined,
  squadPlayerIds: Set<string>,
  fallbackNameToId: Map<string, string>
) {
  if (playerId && squadPlayerIds.has(playerId)) {
    return playerId;
  }

  const normalizedName = cleanName(playerName ?? "");
  return fallbackNameToId.get(normalizedName) ?? null;
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
      performanceColor: "warning",
      battingStyle: player.battingStyle,
      isCaptain: player.isCaptain,
      isWicketKeeper: player.isWicketKeeper,
      roleTags: player.roleTags
    };
  }

  if (strikeRate !== null) {
    return {
      id: player.id,
      name: player.name,
      matchesPlayed,
      role: "Batter",
      performanceLabel: `Strike Rate ${strikeRate.toFixed(2)}`,
      performanceColor: "primary",
      battingStyle: player.battingStyle,
      isCaptain: player.isCaptain,
      isWicketKeeper: player.isWicketKeeper,
      roleTags: player.roleTags
    };
  }

  if (economy !== null) {
    return {
      id: player.id,
      name: player.name,
      matchesPlayed,
      role: "Bowler",
      performanceLabel: `Economy ${economy.toFixed(2)}`,
      performanceColor: "warning",
      battingStyle: player.battingStyle,
      isCaptain: player.isCaptain,
      isWicketKeeper: player.isWicketKeeper,
      roleTags: player.roleTags
    };
  }

  return {
    id: player.id,
    name: player.name,
    matchesPlayed,
    role: "Player",
    performanceLabel: "No performance data yet",
    performanceColor: "default",
    battingStyle: player.battingStyle,
    isCaptain: player.isCaptain,
    isWicketKeeper: player.isWicketKeeper,
    roleTags: player.roleTags
  };
}

async function loadSharedPlayerData(teamId: string, season?: string) {
  const { data: squadData, error: squadError } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", teamId)
    .eq("is_guest", false)
    .order("name", { ascending: true });

  if (squadError) {
    throw new Error("Could not load squad players.");
  }

  const squadPlayers = (squadData ?? []).map((row) => {
    return mapSquadPlayerRecord(row as Record<string, unknown>);
  });

  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select("id, match_date, team_a, team_b, result, result_summary, match_code")
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
    .select("match_id, player_id, player_name, did_bat, did_bowl")
    .in("match_id", matchIds)
    .eq("team_name", currentTeamName);

  if (matchPlayersError) {
    throw new Error("Could not load squad appearances.");
  }

  const { data: inningsData, error: inningsError } = await supabase
    .from("innings")
    .select("id, match_id, team_name")
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
        .select("innings_id, player_id, player_name, dismissal, runs, balls")
        .in("innings_id", inningsIds),
      supabase
        .from("bowling_stats")
        .select("innings_id, player_id, player_name, runs, overs, wickets")
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

function countCatchesFromDismissal(
  dismissal: string | null | undefined,
  normalizedPlayerName: string
) {
  const normalizedDismissal = (dismissal ?? "")
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedDismissal) {
    return 0;
  }

  const escapedPlayerName = normalizedPlayerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flexiblePlayerName = `${escapedPlayerName}(?:\\s+[A-Z]+\\.?)*`;

  const catchPatterns = [
    new RegExp(`\\bC\\s*&\\s*B\\s+${flexiblePlayerName}\\b`),
    new RegExp(`\\b(?:C|CAUGHT|CT)\\s+${flexiblePlayerName}\\s+B\\b`),
    new RegExp(`\\b(?:C|CAUGHT|CT)\\s+${flexiblePlayerName}\\b`)
  ];

  if (catchPatterns.some((pattern) => pattern.test(normalizedDismissal))) {
    return 1;
  }

  return 0;
}

function aggregatePlayerStats(
  squadPlayers: SquadPlayer[],
  matchPlayers: MatchPlayerRow[],
  inningsRows: InningsRow[],
  battingStats: BattingStatRow[],
  bowlingStats: BowlingStatRow[]
) {
  const statsByPlayer = new Map<string, AggregatedPlayerStats>();
  const fallbackNameToId = new Map<string, string>();
  const squadPlayerIds = new Set<string>();

  squadPlayers.forEach((player) => {
    statsByPlayer.set(player.id, createEmptyStats());
    squadPlayerIds.add(player.id);
    fallbackNameToId.set(cleanName(player.name), player.id);
  });

  const inningsToMatchId = new Map(
    inningsRows.map((innings) => [innings.id, innings.match_id])
  );
  const inningsById = new Map(
    inningsRows.map((innings) => [innings.id, innings])
  );

  matchPlayers.forEach((row) => {
    const playerId = resolveSquadPlayerId(
      row.player_id,
      row.player_name,
      squadPlayerIds,
      fallbackNameToId
    );
    const playerStats = playerId ? statsByPlayer.get(playerId) : null;

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
    const innings = inningsById.get(row.innings_id);
    const fallbackPlayerId =
      innings?.team_name === currentTeamName
        ? fallbackNameToId.get(cleanName(row.player_name ?? ""))
        : null;
    const playerId = row.player_id && squadPlayerIds.has(row.player_id)
      ? row.player_id
      : fallbackPlayerId;
    const playerStats = playerId ? statsByPlayer.get(playerId) : null;

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
    const innings = inningsById.get(row.innings_id);
    const fallbackPlayerId =
      innings?.team_name && innings.team_name !== currentTeamName
        ? fallbackNameToId.get(cleanName(row.player_name ?? ""))
        : null;
    const playerId = row.player_id && squadPlayerIds.has(row.player_id)
      ? row.player_id
      : fallbackPlayerId;
    const playerStats = playerId ? statsByPlayer.get(playerId) : null;

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

export async function getSquadPlayerSummaries(
  season?: string,
  options?: SquadPlayerSummaryOptions
) {
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

  const summaries = squadPlayers
    .map((player) => buildPlayerSummary(
      player,
      statsByPlayer.get(player.id) ?? createEmptyStats()
    ));

  return summaries
    .filter((player) => {
      if (!season) {
        return true;
      }

      if (options?.includeInactiveForSeason) {
        return true;
      }

      return player.matchesPlayed > 0;
    })
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

  const stats = statsByPlayer.get(player.id) ?? createEmptyStats();
  const summary = buildPlayerSummary(player, stats);
  const matchIdSet = stats.matchIds;
  const activeMatchIds = new Set([
    ...stats.battingMatchIds,
    ...stats.bowlingMatchIds
  ]);
  const inningsToMatchId = new Map(
    inningsRows.map((innings) => [innings.id, innings.match_id])
  );
  const inningsById = new Map(
    inningsRows.map((innings) => [innings.id, innings])
  );
  const normalizedPlayerName = cleanName(player.name);

  const runsByMatch = new Map<string, number>();
  const catchesByMatch = new Map<string, number>();
  battingStats.forEach((row) => {
    const innings = inningsById.get(row.innings_id);
    const isCurrentTeamFallbackMatch =
      !row.player_id
      && innings?.team_name === currentTeamName
      && cleanName(row.player_name ?? "") === normalizedPlayerName;

    if (row.player_id !== player.id && !isCurrentTeamFallbackMatch) {
      return;
    }

    const matchId = inningsToMatchId.get(row.innings_id);
    if (!matchId) {
      return;
    }

    runsByMatch.set(matchId, (runsByMatch.get(matchId) ?? 0) + (row.runs ?? 0));
  });

  battingStats.forEach((row) => {
    const innings = inningsById.get(row.innings_id);

    if (!innings?.team_name || innings.team_name === currentTeamName) {
      return;
    }

    const catchCount = countCatchesFromDismissal(row.dismissal, normalizedPlayerName);

    if (catchCount === 0) {
      return;
    }

    const matchId = inningsToMatchId.get(row.innings_id);

    if (!matchId) {
      return;
    }

    catchesByMatch.set(matchId, (catchesByMatch.get(matchId) ?? 0) + catchCount);
  });

  const wicketsByMatch = new Map<string, number>();
  bowlingStats.forEach((row) => {
    const innings = inningsById.get(row.innings_id);
    const isCurrentTeamFallbackMatch =
      !row.player_id
      && typeof innings?.team_name === "string"
      && innings.team_name !== currentTeamName
      && cleanName(row.player_name ?? "") === normalizedPlayerName;

    if (row.player_id !== player.id && !isCurrentTeamFallbackMatch) {
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
    .sort((left, right) => (right.match_date ?? "").localeCompare(left.match_date ?? ""));

  let detailedMatchesById = new Map<string, MatchDetailRow>();

  if (recentMatches.length > 0) {
    const { data: detailedMatchData, error: detailedMatchError } = await supabase
      .from("matches")
      .select(`
        id,
        match_date,
        team_a,
        team_b,
        result,
        result_summary,
        winner,
        match_code,
        innings (
          id,
          team_name,
          runs,
          wickets,
          overs,
          extras,
          batting_stats (*),
          bowling_stats (*),
          fall_of_wickets (*)
        ),
        match_players (
          team_name,
          player_name
        )
      `)
      .in("id", recentMatches.map((match) => match.id));

    if (detailedMatchError) {
      throw new Error("Could not load player match scorecards.");
    }

    detailedMatchesById = new Map(
      ((detailedMatchData ?? []) as MatchDetailRow[]).map((match) => [match.id, match])
    );
  }

  const recentMatchItems = recentMatches.map((match) => ({
    id: match.id,
    matchDate: match.match_date,
    opponentName: getOpponentName(match.team_a, match.team_b, currentTeamName),
    result: match.result,
    resultSummary: match.result_summary ?? null,
    matchCode: match.match_code,
    scorecard: detailedMatchesById.get(match.id) ?? {
      ...match,
      winner: null,
      innings: [],
      match_players: []
    },
    runs: runsByMatch.get(match.id) ?? 0,
    wickets: wicketsByMatch.get(match.id) ?? 0
  }));

  return {
    id: player.id,
    name: player.name,
    matchesPlayed: stats.matchIds.size,
    totalTeamMatches: matches.length,
    activeMatches: activeMatchIds.size,
    benchMatches: Math.max(0, stats.matchIds.size - activeMatchIds.size),
    battingMatches: stats.battingMatchIds.size,
    bowlingMatches: stats.bowlingMatchIds.size,
    totalRuns: stats.battingRuns,
    catches: Array.from(catchesByMatch.values()).reduce((sum, count) => sum + count, 0),
    strikeRate,
    totalWickets: stats.bowlingWickets,
    economy,
    role: summary.role,
    battingStyle: player.battingStyle,
    isCaptain: player.isCaptain,
    isWicketKeeper: player.isWicketKeeper,
    roleTags: player.roleTags,
    recentMatches: recentMatchItems
  };
}
