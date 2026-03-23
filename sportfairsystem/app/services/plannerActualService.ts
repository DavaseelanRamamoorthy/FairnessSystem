import { requireFairnessWorkspaceAccess } from "@/app/services/accessControlService";
import { cleanName } from "@/app/services/cleanName";
import { getActiveTeamContext } from "@/app/services/teamContextService";
import { supabase } from "@/app/services/supabaseClient";
import { getOpponentName } from "@/app/utils/matchOpponent";

type PlannerBatchLookupRow = {
  id?: unknown;
  season?: unknown;
  weekend_date?: unknown;
};

type MatchCandidateRow = {
  id?: unknown;
  match_code?: unknown;
  match_title?: unknown;
  match_date?: unknown;
  team_a?: unknown;
  team_b?: unknown;
  result?: unknown;
  result_summary?: unknown;
};

type PlannerActualMatchLinkRow = {
  batch_id?: unknown;
  match_number?: unknown;
  match_id?: unknown;
  matches?: MatchCandidateRow | MatchCandidateRow[] | null;
};

type MatchPlayerRow = {
  match_id?: unknown;
  player_id?: unknown;
  player_name?: unknown;
};

type InningsRow = {
  id?: unknown;
  match_id?: unknown;
  team_name?: unknown;
};

type BattingOrBowlingRow = {
  innings_id?: unknown;
  player_id?: unknown;
  player_name?: unknown;
};

export type PlannerActualMatchCandidate = {
  id: string;
  matchCode: string | null;
  matchTitle: string | null;
  matchDate: string | null;
  opponent: string | null;
  result: string | null;
  resultSummary: string | null;
  label: string;
};

export type PlannerActualMatchLink = {
  batchId: string;
  matchNumber: number;
  matchId: string;
  matchCode: string | null;
  matchTitle: string | null;
  matchDate: string | null;
  opponent: string | null;
  result: string | null;
  resultSummary: string | null;
  label: string;
};

export type PlannerActualParticipation = {
  matchId: string;
  listedNames: string[];
  battedNames: string[];
  bowledNames: string[];
  listedNameKeys: Set<string>;
  battedNameKeys: Set<string>;
  bowledNameKeys: Set<string>;
  listedPlayerIds: Set<string>;
  battedPlayerIds: Set<string>;
  bowledPlayerIds: Set<string>;
};

function isPlannerActualReconciliationMissingError(error: { code?: string | null } | null) {
  return error?.code === "42P01" || error?.code === "42703";
}

function normalizeMatchIdentityName(name: string | null | undefined) {
  const normalizedName = cleanName(name ?? "");
  return normalizedName || null;
}

function getSingleMatchRow(matches: MatchCandidateRow | MatchCandidateRow[] | null | undefined) {
  if (Array.isArray(matches)) {
    return matches[0] ?? null;
  }

  return matches ?? null;
}

function mapPlannerActualMatchCandidate(row: MatchCandidateRow, teamName: string): PlannerActualMatchCandidate | null {
  if (typeof row.id !== "string") {
    return null;
  }

  const matchCode = typeof row.match_code === "string" ? row.match_code : null;
  const matchTitle = typeof row.match_title === "string" ? row.match_title : null;
  const matchDate = typeof row.match_date === "string" ? row.match_date : null;
  const teamA = typeof row.team_a === "string" ? row.team_a : null;
  const teamB = typeof row.team_b === "string" ? row.team_b : null;
  const opponent = getOpponentName(teamA, teamB, teamName) || null;
  const result = typeof row.result === "string" ? row.result : null;
  const resultSummary = typeof row.result_summary === "string" ? row.result_summary : null;
  const labelParts = [matchCode, opponent, matchDate].filter((value): value is string => Boolean(value));

  return {
    id: row.id,
    matchCode,
    matchTitle,
    matchDate,
    opponent,
    result,
    resultSummary,
    label: labelParts.length > 0 ? labelParts.join(" • ") : "Linked match"
  };
}

function buildLinkKey(batchId: string, matchNumber: number) {
  return `${batchId}:${matchNumber}`;
}

function createEmptyParticipation(matchId: string): PlannerActualParticipation {
  return {
    matchId,
    listedNames: [],
    battedNames: [],
    bowledNames: [],
    listedNameKeys: new Set<string>(),
    battedNameKeys: new Set<string>(),
    bowledNameKeys: new Set<string>(),
    listedPlayerIds: new Set<string>(),
    battedPlayerIds: new Set<string>(),
    bowledPlayerIds: new Set<string>()
  };
}

function addParticipationName(targetNames: string[], targetNameKeys: Set<string>, rawName: string | null | undefined) {
  const normalizedName = normalizeMatchIdentityName(rawName);

  if (!normalizedName || targetNameKeys.has(normalizedName)) {
    return;
  }

  targetNameKeys.add(normalizedName);
  targetNames.push(normalizedName);
}

function addParticipationPlayerId(targetPlayerIds: Set<string>, playerId: unknown) {
  if (typeof playerId === "string") {
    targetPlayerIds.add(playerId);
  }
}

export async function listFriendlyPlannerActualMatchCandidates(batchId: string) {
  const access = await requireFairnessWorkspaceAccess();
  const { teamName } = await getActiveTeamContext();

  const { data: batchData, error: batchError } = await supabase
    .from("planner_matchday_batches")
    .select("id, season, weekend_date")
    .eq("team_id", access.teamId)
    .eq("planner_mode", "friendly")
    .eq("id", batchId)
    .single();

  if (batchError || !batchData) {
    throw new Error("Could not load the saved matchday batch for match linking.");
  }

  const batchRow = batchData as PlannerBatchLookupRow;
  const weekendDate = typeof batchRow.weekend_date === "string" ? batchRow.weekend_date : null;
  const season = typeof batchRow.season === "string" ? batchRow.season : null;
  let query = supabase
    .from("matches")
    .select("id, match_code, match_title, match_date, team_a, team_b, result, result_summary")
    .eq("team_id", access.teamId)
    .order("match_date", { ascending: false })
    .limit(25);

  if (weekendDate) {
    query = query.eq("match_date", weekendDate);
  } else if (season && /^\d{4}$/.test(season)) {
    query = query
      .gte("match_date", `${season}-01-01`)
      .lte("match_date", `${season}-12-31`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Could not load candidate matches for planner reconciliation.");
  }

  return ((data ?? []) as MatchCandidateRow[])
    .map((row) => mapPlannerActualMatchCandidate(row, teamName))
    .filter((value): value is PlannerActualMatchCandidate => Boolean(value));
}

export async function getPlannerActualMatchLinkMap(teamId: string, batchIds: string[]) {
  if (batchIds.length === 0) {
    return new Map<string, PlannerActualMatchLink>();
  }

  const { teamName } = await getActiveTeamContext();
  const { data, error } = await supabase
    .from("planner_matchday_actual_links")
    .select(`
      batch_id,
      match_number,
      match_id,
      matches (
        id,
        match_code,
        match_title,
        match_date,
        team_a,
        team_b,
        result,
        result_summary
      )
    `)
    .eq("team_id", teamId)
    .in("batch_id", batchIds);

  if (error) {
    if (isPlannerActualReconciliationMissingError(error)) {
      return new Map<string, PlannerActualMatchLink>();
    }

    throw new Error("Could not load linked actual matches for fairness reconciliation.");
  }

  const links = new Map<string, PlannerActualMatchLink>();

  ((data ?? []) as PlannerActualMatchLinkRow[]).forEach((row) => {
    const batchId = typeof row.batch_id === "string" ? row.batch_id : null;
    const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
    const matchId = typeof row.match_id === "string" ? row.match_id : null;
    const matchRow = getSingleMatchRow(row.matches);

    if (!batchId || !matchNumber || !matchId || !matchRow) {
      return;
    }

    const mappedMatch = mapPlannerActualMatchCandidate(matchRow, teamName);

    if (!mappedMatch) {
      return;
    }

    links.set(buildLinkKey(batchId, matchNumber), {
      batchId,
      matchNumber,
      matchId,
      matchCode: mappedMatch.matchCode,
      matchTitle: mappedMatch.matchTitle,
      matchDate: mappedMatch.matchDate,
      opponent: mappedMatch.opponent,
      result: mappedMatch.result,
      resultSummary: mappedMatch.resultSummary,
      label: mappedMatch.label
    });
  });

  return links;
}

export async function getPlannerActualParticipationByMatch(teamId: string, matchIds: string[]) {
  if (matchIds.length === 0) {
    return new Map<string, PlannerActualParticipation>();
  }

  const { teamName } = await getActiveTeamContext();
  const participationByMatchId = new Map<string, PlannerActualParticipation>();

  matchIds.forEach((matchId) => {
    participationByMatchId.set(matchId, createEmptyParticipation(matchId));
  });

  const [{ data: inningsData, error: inningsError }, { data: matchPlayersData, error: matchPlayersError }] = await Promise.all([
    supabase
      .from("innings")
      .select("id, match_id, team_name")
      .in("match_id", matchIds),
    supabase
      .from("match_players")
      .select("match_id, player_id, player_name")
      .eq("team_name", teamName)
      .in("match_id", matchIds)
  ]);

  if (inningsError) {
    throw new Error("Could not load innings for actual fairness reconciliation.");
  }

  if (matchPlayersError) {
    throw new Error("Could not load matchday players for actual fairness reconciliation.");
  }

  const inningsRows = (inningsData ?? []) as InningsRow[];
  const battingInningsIds = inningsRows
    .filter((row) => row.team_name === teamName && typeof row.id === "string")
    .map((row) => row.id as string);
  const bowlingInningsIds = inningsRows
    .filter((row) => row.team_name !== teamName && typeof row.id === "string")
    .map((row) => row.id as string);
  const matchIdByInningsId = new Map<string, string>();

  inningsRows.forEach((row) => {
    if (typeof row.id === "string" && typeof row.match_id === "string") {
      matchIdByInningsId.set(row.id, row.match_id);
    }
  });

  const [{ data: battingData, error: battingError }, { data: bowlingData, error: bowlingError }] = await Promise.all([
    battingInningsIds.length > 0
      ? supabase
        .from("batting_stats")
        .select("innings_id, player_id, player_name")
        .in("innings_id", battingInningsIds)
      : Promise.resolve({ data: [], error: null }),
    bowlingInningsIds.length > 0
      ? supabase
        .from("bowling_stats")
        .select("innings_id, player_id, player_name")
        .in("innings_id", bowlingInningsIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (battingError) {
    throw new Error("Could not load batting records for actual fairness reconciliation.");
  }

  if (bowlingError) {
    throw new Error("Could not load bowling records for actual fairness reconciliation.");
  }

  ((matchPlayersData ?? []) as MatchPlayerRow[]).forEach((row) => {
    const matchId = typeof row.match_id === "string" ? row.match_id : null;

    if (!matchId) {
      return;
    }

    const participation = participationByMatchId.get(matchId) ?? createEmptyParticipation(matchId);
    addParticipationPlayerId(participation.listedPlayerIds, row.player_id);
    addParticipationName(participation.listedNames, participation.listedNameKeys, typeof row.player_name === "string" ? row.player_name : null);
    participationByMatchId.set(matchId, participation);
  });

  ((battingData ?? []) as BattingOrBowlingRow[]).forEach((row) => {
    const inningsId = typeof row.innings_id === "string" ? row.innings_id : null;
    const matchId = inningsId ? (matchIdByInningsId.get(inningsId) ?? null) : null;

    if (!matchId) {
      return;
    }

    const participation = participationByMatchId.get(matchId) ?? createEmptyParticipation(matchId);
    addParticipationPlayerId(participation.battedPlayerIds, row.player_id);
    addParticipationName(participation.battedNames, participation.battedNameKeys, typeof row.player_name === "string" ? row.player_name : null);
    addParticipationPlayerId(participation.listedPlayerIds, row.player_id);
    addParticipationName(participation.listedNames, participation.listedNameKeys, typeof row.player_name === "string" ? row.player_name : null);
    participationByMatchId.set(matchId, participation);
  });

  ((bowlingData ?? []) as BattingOrBowlingRow[]).forEach((row) => {
    const inningsId = typeof row.innings_id === "string" ? row.innings_id : null;
    const matchId = inningsId ? (matchIdByInningsId.get(inningsId) ?? null) : null;

    if (!matchId) {
      return;
    }

    const participation = participationByMatchId.get(matchId) ?? createEmptyParticipation(matchId);
    addParticipationPlayerId(participation.bowledPlayerIds, row.player_id);
    addParticipationName(participation.bowledNames, participation.bowledNameKeys, typeof row.player_name === "string" ? row.player_name : null);
    addParticipationPlayerId(participation.listedPlayerIds, row.player_id);
    addParticipationName(participation.listedNames, participation.listedNameKeys, typeof row.player_name === "string" ? row.player_name : null);
    participationByMatchId.set(matchId, participation);
  });

  return participationByMatchId;
}

export async function upsertFriendlyPlannerActualMatchLink(
  batchId: string,
  matchNumber: number,
  matchId: string | null
) {
  const access = await requireFairnessWorkspaceAccess();

  if (matchId) {
    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select("id")
      .eq("team_id", access.teamId)
      .eq("id", matchId)
      .single();

    if (matchError || !matchData) {
      throw new Error("Could not verify the selected actual match.");
    }

    const { error } = await supabase
      .from("planner_matchday_actual_links")
      .upsert(
        {
          batch_id: batchId,
          team_id: access.teamId,
          match_number: matchNumber,
          match_id: matchId,
          linked_by_user_id: access.user.id
        },
        {
          onConflict: "batch_id,match_number"
        }
      );

    if (error) {
      if (isPlannerActualReconciliationMissingError(error)) {
        throw new Error("Actual fairness linking is not available yet. Run the V2 planner actual reconciliation SQL first.");
      }

      throw new Error("Could not save the actual match link.");
    }

    return;
  }

  const { error } = await supabase
    .from("planner_matchday_actual_links")
    .delete()
    .eq("team_id", access.teamId)
    .eq("batch_id", batchId)
    .eq("match_number", matchNumber);

  if (error) {
    if (isPlannerActualReconciliationMissingError(error)) {
      throw new Error("Actual fairness linking is not available yet. Run the V2 planner actual reconciliation SQL first.");
    }

    throw new Error("Could not remove the actual match link.");
  }
}
