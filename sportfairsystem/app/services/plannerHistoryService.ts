import {
  getCurrentTeamMembershipAccess,
  requirePlannerWorkspaceAccess,
  requireFairnessWorkspaceAccess
} from "@/app/services/accessControlService";
import {
  getPlannerActualMatchLinkMap,
  getPlannerActualParticipationByMatch,
  listFriendlyPlannerActualMatchCandidates,
  PlannerActualMatchCandidate,
  upsertFriendlyPlannerActualMatchLink
} from "@/app/services/plannerActualService";
import {
  FriendlyMatchAvailabilityOverrides,
  PlannerSuggestion,
  PlannerWeekendOption
} from "@/app/services/plannerService";
import { supabase } from "@/app/services/supabaseClient";

type PlannerPlayerLinkRow = {
  id?: unknown;
  member_id?: unknown;
};

type PlannerMemberRow = {
  id?: unknown;
};

type PlannerBatchListRow = {
  id?: unknown;
  season?: unknown;
  weekend_date?: unknown;
  weekend_label?: unknown;
  attendance_workbook_name?: unknown;
  match_count?: unknown;
  unmatched_availability_names?: unknown;
  notes?: unknown;
  created_at?: unknown;
};

type PlannerAssignmentDetailRow = {
  match_number?: unknown;
  player_name?: unknown;
  assignment?: unknown;
  is_available?: unknown;
  member_id?: unknown;
  is_captain?: unknown;
  is_wicket_keeper?: unknown;
};

type SaveFriendlyPlannerBatchInput = {
  season: string | null;
  attendanceWorkbookName: string | null;
  attendanceSessionId?: string | null;
  weekend: PlannerWeekendOption;
  suggestion: PlannerSuggestion;
  preferredWicketKeeperPlayerId?: string | null;
  matchAvailabilityOverrides?: FriendlyMatchAvailabilityOverrides;
};

export type SavedPlannerBatch = {
  batchId: string;
  createdAt: string;
  savedAssignments: number;
};

export type PlannerBatchListItem = {
  id: string;
  season: string | null;
  weekendDate: string | null;
  weekendLabel: string;
  attendanceWorkbookName: string | null;
  matchCount: number;
  unmatchedAvailabilityNames: string[];
  notes: string[];
  createdAt: string;
};

export type PlannerBatchDetail = PlannerBatchListItem & {
  actualMatchCandidates: PlannerActualMatchCandidate[];
  matches: Array<{
    matchNumber: number;
    xiPlayers: string[];
    twelfthPlayer: string | null;
    benchPlayers: string[];
    unavailablePlayers: string[];
    linkedActualMatchId: string | null;
    linkedActualMatchLabel: string | null;
    suggestedActualMatchId: string | null;
    suggestedActualMatchLabel: string | null;
    actualListedPlayers: string[];
    actualBattedPlayers: string[];
    actualBowledPlayers: string[];
  }>;
};

export type CurrentMemberPlannerWeekSnapshot = {
  batchId: string;
  createdAt: string;
  weekendDate: string | null;
  weekendLabel: string;
  notes: string[];
  matchCount: number;
  matches: Array<{
    matchNumber: number;
    assignment: "xi" | "twelfth" | "bench" | "unavailable";
    isCaptain: boolean;
    isWicketKeeper: boolean;
    xiPlayers: string[];
  }>;
};

function compareActualMatchCandidates(
  left: PlannerActualMatchCandidate,
  right: PlannerActualMatchCandidate
) {
  const leftKey = [left.matchDate ?? "", left.matchCode ?? "", left.matchTitle ?? "", left.id].join("|");
  const rightKey = [right.matchDate ?? "", right.matchCode ?? "", right.matchTitle ?? "", right.id].join("|");
  return leftKey.localeCompare(rightKey);
}

function isPlannerPersistenceMissingError(error: { code?: string | null } | null) {
  return error?.code === "42P01" || error?.code === "42703";
}

function mapPlannerBatchListItem(row: PlannerBatchListRow): PlannerBatchListItem | null {
  if (typeof row.id !== "string" || typeof row.weekend_label !== "string" || typeof row.created_at !== "string") {
    return null;
  }

  return {
    id: row.id,
    season: typeof row.season === "string" ? row.season : null,
    weekendDate: typeof row.weekend_date === "string" ? row.weekend_date : null,
    weekendLabel: row.weekend_label,
    attendanceWorkbookName: typeof row.attendance_workbook_name === "string" ? row.attendance_workbook_name : null,
    matchCount: typeof row.match_count === "number" ? row.match_count : 0,
    unmatchedAvailabilityNames: Array.isArray(row.unmatched_availability_names)
      ? row.unmatched_availability_names.filter((value): value is string => typeof value === "string")
      : [],
    notes: Array.isArray(row.notes)
      ? row.notes.filter((value): value is string => typeof value === "string")
      : [],
    createdAt: row.created_at
  };
}

function resolveFriendlyAssignment(
  playerId: string,
  plan: PlannerSuggestion["matchPlans"][number]
) {
  if (plan.playingXi.some((player) => player.id === playerId)) {
    return "xi" as const;
  }

  if (plan.twelfthMan?.id === playerId) {
    return "twelfth" as const;
  }

  if (plan.benchPlayers.some((player) => player.id === playerId)) {
    return "bench" as const;
  }

  return null;
}

export async function saveFriendlyPlannerBatch({
  season,
  attendanceWorkbookName,
  attendanceSessionId,
  weekend,
  suggestion,
  preferredWicketKeeperPlayerId,
  matchAvailabilityOverrides
}: SaveFriendlyPlannerBatchInput): Promise<SavedPlannerBatch> {
  const access = await requirePlannerWorkspaceAccess();

  if (suggestion.matchPlans.length === 0 || suggestion.availablePlayers.length === 0) {
    throw new Error("Generate the friendly planner first before saving the matchday plan.");
  }

  const identityIds = Array.from(
    new Set([
      ...suggestion.availablePlayers.map((player) => player.id),
      ...(preferredWicketKeeperPlayerId ? [preferredWicketKeeperPlayerId] : [])
    ])
  );
  const [
    { data: playerLinksData, error: playerLinksError },
    { data: memberRowsData, error: memberRowsError }
  ] = await Promise.all([
    supabase
      .from("players")
      .select("id, member_id")
      .eq("team_id", access.teamId)
      .in("id", identityIds),
    supabase
      .from("team_members")
      .select("id")
      .eq("team_id", access.teamId)
      .in("id", identityIds)
  ]);

  if (playerLinksError) {
    if (isPlannerPersistenceMissingError(playerLinksError)) {
      throw new Error("Planner history tables are not available yet. Run the V2 planner persistence SQL first.");
    }

    throw new Error("Could not load linked planner players for history saving.");
  }

  if (memberRowsError) {
    throw new Error("Could not load planner team members for history saving.");
  }

  const memberIds = new Set(
    ((memberRowsData ?? []) as PlannerMemberRow[])
      .flatMap((row) => (typeof row.id === "string" ? [row.id] : []))
  );
  const identityByPlannerId = new Map<string, { playerId: string | null; memberId: string | null }>();
  ((playerLinksData ?? []) as PlannerPlayerLinkRow[]).forEach((row) => {
    const playerId = typeof row.id === "string" ? row.id : null;

    if (!playerId) {
      return;
    }

    identityByPlannerId.set(playerId, {
      playerId,
      memberId: typeof row.member_id === "string" ? row.member_id : null
    });
  });

  identityIds.forEach((identityId) => {
    if (identityByPlannerId.has(identityId)) {
      return;
    }

    if (memberIds.has(identityId)) {
      identityByPlannerId.set(identityId, {
        playerId: null,
        memberId: identityId
      });
    }
  });

  const preferredWicketKeeperIdentity = preferredWicketKeeperPlayerId
    ? (identityByPlannerId.get(preferredWicketKeeperPlayerId) ?? null)
    : null;

  const { data: insertedBatchData, error: insertedBatchError } = await supabase
    .from("planner_matchday_batches")
    .insert({
      team_id: access.teamId,
      planner_mode: "friendly",
      season: season && season !== "all" ? season : null,
      weekend_date: weekend.isoDate,
      weekend_label: weekend.label,
      weekend_source_column: weekend.sourceColumn,
      attendance_workbook_name: attendanceWorkbookName,
      attendance_session_id: attendanceSessionId ?? null,
      match_count: suggestion.matchPlans.length,
      preferred_wicket_keeper_player_id: preferredWicketKeeperIdentity?.playerId ?? null,
      generated_by_user_id: access.user.id,
      availability_names: weekend.availableNames,
      unmatched_availability_names: suggestion.unmatchedAvailabilityNames,
      notes: suggestion.notes
    })
    .select("id, created_at")
    .single();

  if (
    insertedBatchError
    || !insertedBatchData
    || typeof insertedBatchData.id !== "string"
    || typeof insertedBatchData.created_at !== "string"
  ) {
    if (isPlannerPersistenceMissingError(insertedBatchError)) {
      throw new Error("Planner history tables are not available yet. Run the V2 planner persistence SQL first.");
    }

    throw new Error("Could not save the planner matchday batch.");
  }

  const assignmentRows = suggestion.matchPlans.flatMap((plan) =>
    suggestion.availablePlayers.map((player) => {
      const identity = identityByPlannerId.get(player.id) ?? {
        playerId: null,
        memberId: null
      };

      if (!identity.memberId && !identity.playerId) {
        throw new Error(`Could not resolve planner identity for ${player.name}. Link the member or linked player before saving.`);
      }

      const eligibleMatches = matchAvailabilityOverrides?.[player.id];
      const isAvailableForMatch = !eligibleMatches || eligibleMatches.includes(plan.matchNumber);

      if (!isAvailableForMatch) {
        return {
          batch_id: insertedBatchData.id,
          team_id: access.teamId,
          match_number: plan.matchNumber,
          player_id: identity.playerId,
          member_id: identity.memberId,
          player_name: player.name,
          assignment: "unavailable",
          is_available: false,
          is_captain: player.isCaptain,
          is_wicket_keeper: player.id === preferredWicketKeeperPlayerId || player.isWicketKeeper
        };
      }

      const assignment = resolveFriendlyAssignment(player.id, plan);

      if (!assignment) {
        throw new Error(`Could not resolve planner assignment for ${player.name} in match ${plan.matchNumber}.`);
      }

      return {
        batch_id: insertedBatchData.id,
        team_id: access.teamId,
        match_number: plan.matchNumber,
        player_id: identity.playerId,
        member_id: identity.memberId,
        player_name: player.name,
        assignment,
        is_available: true,
        is_captain: player.isCaptain,
        is_wicket_keeper: player.id === preferredWicketKeeperPlayerId || player.isWicketKeeper
      };
    })
  );

  const { error: assignmentsError } = await supabase
    .from("planner_matchday_assignments")
    .insert(assignmentRows);

  if (assignmentsError) {
    if (isPlannerPersistenceMissingError(assignmentsError)) {
      throw new Error("Planner history tables are not available yet. Run the V2 planner persistence SQL first.");
    }

    await supabase
      .from("planner_matchday_batches")
      .delete()
      .eq("id", insertedBatchData.id);

    throw new Error("Could not save planner matchday assignments.");
  }

  return {
    batchId: insertedBatchData.id,
    createdAt: insertedBatchData.created_at,
    savedAssignments: assignmentRows.length
  };
}

export async function listFriendlyPlannerBatches(season?: string) {
  const access = await requireFairnessWorkspaceAccess();

  const batchesQuery = supabase
    .from("planner_matchday_batches")
    .select("id, season, weekend_date, weekend_label, attendance_workbook_name, match_count, unmatched_availability_names, notes, created_at")
    .eq("team_id", access.teamId)
    .eq("planner_mode", "friendly")
    .order("weekend_date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data, error } = season
    ? await batchesQuery.eq("season", season)
    : await batchesQuery;

  if (error) {
    if (isPlannerPersistenceMissingError(error)) {
      throw new Error("Planner history tables are not available yet. Run the V2 planner persistence SQL first.");
    }

    throw new Error("Could not load saved planner matchday plans.");
  }

  return ((data ?? []) as PlannerBatchListRow[])
    .map(mapPlannerBatchListItem)
    .filter((value): value is PlannerBatchListItem => Boolean(value));
}

export async function getCurrentMemberFriendlyPlannerWeekSnapshot(season?: string) {
  const access = await getCurrentTeamMembershipAccess();

  if (!access.teamId || !access.memberId) {
    return null;
  }

  let batchQuery = supabase
    .from("planner_matchday_batches")
    .select("id, season, weekend_date, weekend_label, match_count, notes, created_at")
    .eq("team_id", access.teamId)
    .eq("planner_mode", "friendly")
    .order("weekend_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (season) {
    batchQuery = batchQuery.eq("season", season);
  }

  const { data: batchData, error: batchError } = await batchQuery;

  if (batchError) {
    if (isPlannerPersistenceMissingError(batchError)) {
      throw new Error("Planner history tables are not available yet. Run the V2 planner persistence SQL first.");
    }

    throw new Error("Could not load the latest planner week.");
  }

  const latestBatch = ((batchData ?? []) as PlannerBatchListRow[])
    .map(mapPlannerBatchListItem)
    .find((value): value is PlannerBatchListItem => Boolean(value));

  if (!latestBatch) {
    return null;
  }

  const { data: assignmentData, error: assignmentError } = await supabase
    .from("planner_matchday_assignments")
    .select("match_number, player_name, assignment, member_id, is_captain, is_wicket_keeper")
    .eq("team_id", access.teamId)
    .eq("batch_id", latestBatch.id)
    .order("match_number", { ascending: true });

  if (assignmentError) {
    throw new Error("Could not load your current planner assignments.");
  }

  const assignmentRows = (assignmentData ?? []) as PlannerAssignmentDetailRow[];
  const rowsByMatchNumber = new Map<number, PlannerAssignmentDetailRow[]>();

  assignmentRows.forEach((row) => {
    const matchNumber = typeof row.match_number === "number" ? row.match_number : null;

    if (!matchNumber) {
      return;
    }

    const currentRows = rowsByMatchNumber.get(matchNumber) ?? [];
    currentRows.push(row);
    rowsByMatchNumber.set(matchNumber, currentRows);
  });

  const matches: CurrentMemberPlannerWeekSnapshot["matches"] = Array.from(
    { length: latestBatch.matchCount },
    (_, index) => index + 1
  ).flatMap((matchNumber) => {
    const matchRows = rowsByMatchNumber.get(matchNumber) ?? [];
    const memberRow = matchRows.find((row) => row.member_id === access.memberId) ?? null;
    const assignment = typeof memberRow?.assignment === "string" ? memberRow.assignment : null;

    if (
      !memberRow
      || (
        assignment !== "xi"
        && assignment !== "twelfth"
        && assignment !== "bench"
        && assignment !== "unavailable"
      )
    ) {
      return [];
    }

    return [{
      matchNumber,
      assignment: assignment as CurrentMemberPlannerWeekSnapshot["matches"][number]["assignment"],
      isCaptain: memberRow.is_captain === true,
      isWicketKeeper: memberRow.is_wicket_keeper === true,
      xiPlayers: matchRows
        .filter((row) => row.assignment === "xi" && typeof row.player_name === "string")
        .map((row) => row.player_name as string)
    }];
  });

  if (matches.length === 0) {
    return null;
  }

  return {
    batchId: latestBatch.id,
    createdAt: latestBatch.createdAt,
    weekendDate: latestBatch.weekendDate,
    weekendLabel: latestBatch.weekendLabel,
    notes: latestBatch.notes,
    matchCount: latestBatch.matchCount,
    matches
  } satisfies CurrentMemberPlannerWeekSnapshot;
}

export async function getFriendlyPlannerBatchDetail(batchId: string) {
  const access = await requireFairnessWorkspaceAccess();

  const { data: batchData, error: batchError } = await supabase
    .from("planner_matchday_batches")
    .select("id, season, weekend_date, weekend_label, attendance_workbook_name, match_count, unmatched_availability_names, notes, created_at")
    .eq("team_id", access.teamId)
    .eq("planner_mode", "friendly")
    .eq("id", batchId)
    .single();

  if (batchError || !batchData) {
    throw new Error("Could not load the saved matchday plan.");
  }

  const mappedBatch = mapPlannerBatchListItem(batchData as PlannerBatchListRow);

  if (!mappedBatch) {
    throw new Error("The saved matchday plan is missing required fields.");
  }

  const { data: assignmentData, error: assignmentError } = await supabase
    .from("planner_matchday_assignments")
    .select("match_number, player_name, assignment, is_available")
    .eq("team_id", access.teamId)
    .eq("batch_id", batchId)
    .order("match_number", { ascending: true })
    .order("player_name", { ascending: true });

  if (assignmentError) {
    throw new Error("Could not load saved planner assignments.");
  }

  const assignmentsByMatch = new Map<number, PlannerAssignmentDetailRow[]>();
  ((assignmentData ?? []) as PlannerAssignmentDetailRow[]).forEach((row) => {
    const matchNumber = typeof row.match_number === "number" ? row.match_number : null;

    if (!matchNumber) {
      return;
    }

    const currentRows = assignmentsByMatch.get(matchNumber) ?? [];
    currentRows.push(row);
    assignmentsByMatch.set(matchNumber, currentRows);
  });

  const [actualMatchCandidates, actualLinkMap] = await Promise.all([
    listFriendlyPlannerActualMatchCandidates(batchId),
    getPlannerActualMatchLinkMap(access.teamId, [batchId])
  ]);
  const sortedActualMatchCandidates = [...actualMatchCandidates].sort(compareActualMatchCandidates);
  const exactDateCandidates = mappedBatch.weekendDate
    ? sortedActualMatchCandidates.filter((candidate) => candidate.matchDate === mappedBatch.weekendDate)
    : [];
  const canSafelyAutoSuggest = Boolean(
    mappedBatch.weekendDate
    && exactDateCandidates.length === mappedBatch.matchCount
    && new Set(exactDateCandidates.map((candidate) => candidate.id)).size === mappedBatch.matchCount
  );
  const linkedCandidateIds = new Set(Array.from(actualLinkMap.values()).map((link) => link.matchId));
  const unlinkedCandidates = (canSafelyAutoSuggest ? exactDateCandidates : [])
    .filter((candidate) => !linkedCandidateIds.has(candidate.id));
  const linkedMatchIds = Array.from(
    new Set(Array.from(actualLinkMap.values()).map((link) => link.matchId))
  );
  const actualParticipationByMatchId = await getPlannerActualParticipationByMatch(access.teamId, linkedMatchIds);

  const matches = Array.from({ length: mappedBatch.matchCount }, (_, index) => {
    const matchNumber = index + 1;
    const rows = assignmentsByMatch.get(matchNumber) ?? [];
    const linkedActualMatch = actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null;
    const suggestedActualMatch = !linkedActualMatch
      ? (unlinkedCandidates[matchNumber - 1] ?? null)
      : null;
    const actualParticipation = linkedActualMatch
      ? (actualParticipationByMatchId.get(linkedActualMatch.matchId) ?? null)
      : null;

    return {
      matchNumber,
      xiPlayers: rows
        .filter((row) => row.assignment === "xi" && typeof row.player_name === "string")
        .map((row) => row.player_name as string),
      twelfthPlayer: rows.find((row) => row.assignment === "twelfth" && typeof row.player_name === "string")?.player_name as string | null ?? null,
      benchPlayers: rows
        .filter((row) => row.assignment === "bench" && typeof row.player_name === "string")
        .map((row) => row.player_name as string),
      unavailablePlayers: rows
        .filter((row) => row.assignment === "unavailable" || row.is_available === false)
        .filter((row) => typeof row.player_name === "string")
        .map((row) => row.player_name as string),
      linkedActualMatchId: linkedActualMatch?.matchId ?? null,
      linkedActualMatchLabel: linkedActualMatch?.label ?? null,
      suggestedActualMatchId: suggestedActualMatch?.id ?? null,
      suggestedActualMatchLabel: suggestedActualMatch?.label ?? null,
      actualListedPlayers: actualParticipation?.listedNames ?? [],
      actualBattedPlayers: actualParticipation?.battedNames ?? [],
      actualBowledPlayers: actualParticipation?.bowledNames ?? []
    };
  });

  return {
    ...mappedBatch,
    actualMatchCandidates: sortedActualMatchCandidates,
    matches
  } satisfies PlannerBatchDetail;
}

export async function updateFriendlyPlannerBatchNotes(batchId: string, notes: string[]) {
  const access = await requireFairnessWorkspaceAccess();

  const sanitizedNotes = notes
    .map((note) => note.trim())
    .filter((note) => note.length > 0);

  const { error } = await supabase
    .from("planner_matchday_batches")
    .update({ notes: sanitizedNotes })
    .eq("team_id", access.teamId)
    .eq("planner_mode", "friendly")
    .eq("id", batchId);

  if (error) {
    throw new Error("Could not update saved planner notes.");
  }
}

export async function deleteFriendlyPlannerBatch(batchId: string) {
  const access = await requireFairnessWorkspaceAccess();

  const { error } = await supabase
    .from("planner_matchday_batches")
    .delete()
    .eq("team_id", access.teamId)
    .eq("planner_mode", "friendly")
    .eq("id", batchId);

  if (error) {
    throw new Error("Could not delete the saved matchday plan.");
  }
}

export async function updateFriendlyPlannerBatchActualMatchLink(
  batchId: string,
  matchNumber: number,
  matchId: string | null
) {
  await upsertFriendlyPlannerActualMatchLink(batchId, matchNumber, matchId);
}
