import {
  getCurrentTeamMembershipAccess,
  requireFairnessWorkspaceAccess
} from "@/app/services/accessControlService";
import {
  getPlannerActualMatchLinkMap,
  getPlannerActualParticipationByMatch,
  PlannerActualParticipation
} from "@/app/services/plannerActualService";
import { cleanName } from "@/app/services/cleanName";
import { getPlannerPlayerSummaries } from "@/app/services/playerProfileService";
import { supabase } from "@/app/services/supabaseClient";

type PlannerBatchRow = {
  id?: unknown;
  season?: unknown;
  weekend_date?: unknown;
  weekend_label?: unknown;
  created_at?: unknown;
};

type PlannerAssignmentRow = {
  batch_id?: unknown;
  match_number?: unknown;
  player_id?: unknown;
  member_id?: unknown;
  player_name?: unknown;
  assignment?: unknown;
  is_available?: unknown;
};

export type PlannerFairnessPlayerSummary = {
  memberId: string;
  playerId: string;
  name: string;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  xiCount: number;
  twelfthCount: number;
  benchCount: number;
  unusedInXiCount: number;
  batCount: number;
  bowlCount: number;
  unavailableCount: number;
  trackedMatchdays: number;
  availableMatchdays: number;
  quotaRemaining: number;
  consecutiveAvailableNoXiBatches: number;
  underuseRisk: boolean;
  recentHistory: PlannerFairnessHistoryEntry[];
};

export type PlannerFairnessHistoryEntry = {
  batchId: string;
  weekendDate: string;
  weekendLabel: string;
  xiCount: number;
  twelfthCount: number;
  benchCount: number;
  unavailableCount: number;
  availableMatchCount: number;
  pendingMatchCount: number;
  plannedXiCount: number;
  plannedTwelfthCount: number;
  plannedBenchCount: number;
};

export type PlannerFairnessDashboard = {
  savedMatchdays: number;
  trackedPlayers: number;
  playersBelowQuota: number;
  playersAtOrAboveQuota: number;
  underuseRiskCount: number;
  playerSummaries: PlannerFairnessPlayerSummary[];
  alerts: PlannerFairnessAlert[];
};

export type PlannerFairnessMemberSnapshot = {
  savedMatchdays: number;
  member: PlannerFairnessPlayerSummary | null;
  alerts: PlannerFairnessAlert[];
};

export type PlannerFairnessAlert = {
  id: string;
  type:
    | "baseline_build"
    | "no_xi_yet"
    | "underuse_after_quota"
    | "repeat_bench"
    | "planned_xi_no_show"
    | "planned_twelfth_used"
    | "planned_bench_used"
    | "planned_unavailable_used";
  severity: "info" | "warning";
  playerId: string;
  playerName: string;
  batchId?: string | null;
  weekendLabel?: string | null;
  weekendDate?: string | null;
  matchNumber?: number | null;
  message: string;
};

type PlannerFairnessBuildOptions = {
  includePlayersWithoutAvailability?: boolean;
};

function isPlannerPersistenceMissingError(error: { code?: string | null } | null) {
  return error?.code === "42P01" || error?.code === "42703";
}

function mapBatchDate(row: PlannerBatchRow) {
  return typeof row.weekend_date === "string"
    ? row.weekend_date
    : typeof row.created_at === "string"
      ? row.created_at
      : "";
}

function matchesPlannerSeasonFilter(seasonFilter: string | undefined, row: PlannerBatchRow) {
  if (!seasonFilter) {
    return true;
  }

  if (typeof row.season === "string" && row.season === seasonFilter) {
    return true;
  }

  return typeof row.weekend_date === "string" && row.weekend_date.startsWith(`${seasonFilter}-`);
}

function didPlayerActuallyParticipate(
  row: PlannerAssignmentRow,
  actualParticipation: PlannerActualParticipation | null,
  identityNames: string[] = []
) {
  if (!actualParticipation) {
    return false;
  }

  const normalizedPlayerName = typeof row.player_name === "string"
    ? cleanName(row.player_name)
    : "";
  const playerId = typeof row.player_id === "string" ? row.player_id : null;
  const normalizedIdentityNames = identityNames
    .map((value) => cleanName(value))
    .filter(Boolean);

  return Boolean(
    (playerId && (
      actualParticipation.listedPlayerIds.has(playerId)
      || actualParticipation.battedPlayerIds.has(playerId)
      || actualParticipation.bowledPlayerIds.has(playerId)
    ))
    || (normalizedPlayerName && (
      actualParticipation.listedNameKeys.has(normalizedPlayerName)
      || actualParticipation.battedNameKeys.has(normalizedPlayerName)
      || actualParticipation.bowledNameKeys.has(normalizedPlayerName)
    ))
    || normalizedIdentityNames.some((normalizedIdentityName) =>
      actualParticipation.listedNameKeys.has(normalizedIdentityName)
      || actualParticipation.battedNameKeys.has(normalizedIdentityName)
      || actualParticipation.bowledNameKeys.has(normalizedIdentityName)
    )
  );
}

function getPlayerActualParticipationFlags(
  row: PlannerAssignmentRow,
  actualParticipation: PlannerActualParticipation | null,
  identityNames: string[] = []
) {
  if (!actualParticipation) {
    return {
      listed: false,
      batted: false,
      bowled: false
    };
  }

  const normalizedPlayerName = typeof row.player_name === "string"
    ? cleanName(row.player_name)
    : "";
  const playerId = typeof row.player_id === "string" ? row.player_id : null;
  const normalizedIdentityNames = identityNames
    .map((value) => cleanName(value))
    .filter(Boolean);
  const matchesIdentityName = (target: Set<string>) =>
    normalizedIdentityNames.some((normalizedIdentityName) => target.has(normalizedIdentityName));

  const listed = Boolean(
    (playerId && actualParticipation.listedPlayerIds.has(playerId))
    || (normalizedPlayerName && actualParticipation.listedNameKeys.has(normalizedPlayerName))
    || matchesIdentityName(actualParticipation.listedNameKeys)
  );
  const batted = Boolean(
    (playerId && actualParticipation.battedPlayerIds.has(playerId))
    || (normalizedPlayerName && actualParticipation.battedNameKeys.has(normalizedPlayerName))
    || matchesIdentityName(actualParticipation.battedNameKeys)
  );
  const bowled = Boolean(
    (playerId && actualParticipation.bowledPlayerIds.has(playerId))
    || (normalizedPlayerName && actualParticipation.bowledNameKeys.has(normalizedPlayerName))
    || matchesIdentityName(actualParticipation.bowledNameKeys)
  );

  return {
    listed,
    batted,
    bowled
  };
}

async function buildPlannerFairnessDashboard(
  teamId: string,
  roster: Awaited<ReturnType<typeof getPlannerPlayerSummaries>>,
  season?: string,
  options?: PlannerFairnessBuildOptions
) {
  if (roster.length === 0) {
    return {
      savedMatchdays: 0,
      trackedPlayers: 0,
      playersBelowQuota: 0,
      playersAtOrAboveQuota: 0,
      underuseRiskCount: 0,
      playerSummaries: [],
      alerts: []
    } satisfies PlannerFairnessDashboard;
  }

  const { data: batchesData, error: batchesError } = await supabase
    .from("planner_matchday_batches")
    .select("id, weekend_date, weekend_label, created_at")
    .eq("team_id", teamId)
    .eq("planner_mode", "friendly")
    .order("weekend_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (batchesError) {
    if (isPlannerPersistenceMissingError(batchesError)) {
      throw new Error("Planner fairness history is not available yet. Run the V2 planner persistence SQL first.");
    }

    throw new Error("Could not load saved planner batches.");
  }

  const batchRows = ((batchesData ?? []) as PlannerBatchRow[])
    .filter((row) => matchesPlannerSeasonFilter(season, row));
  const batchIds = batchRows.flatMap((row) => (typeof row.id === "string" ? [row.id] : []));

  if (batchIds.length === 0) {
    return {
      savedMatchdays: 0,
      trackedPlayers: 0,
      playersBelowQuota: 0,
      playersAtOrAboveQuota: 0,
      underuseRiskCount: 0,
      playerSummaries: [],
      alerts: []
    } satisfies PlannerFairnessDashboard;
  }

  const rosterIdentityIds = new Set(
    roster.flatMap((player) => [player.memberId, ...(player.playerId ? [player.playerId] : [])])
  );
  const { data: assignmentsData, error: assignmentsError } = batchIds.length > 0
    ? await supabase
      .from("planner_matchday_assignments")
      .select("batch_id, match_number, player_id, member_id, player_name, assignment, is_available")
      .eq("team_id", teamId)
      .in("batch_id", batchIds)
      
    : { data: [], error: null };

  if (assignmentsError) {
    if (isPlannerPersistenceMissingError(assignmentsError)) {
      throw new Error("Planner fairness history is not available yet. Run the V2 planner persistence SQL first.");
    }

    throw new Error("Could not load saved planner assignments.");
  }

  const batchOrder = batchRows
    .map((row) => ({
      batchId: typeof row.id === "string" ? row.id : "",
      batchDate: mapBatchDate(row),
      weekendLabel: typeof row.weekend_label === "string" ? row.weekend_label : ""
    }))
    .filter((row) => row.batchId)
    .sort((left, right) => right.batchDate.localeCompare(left.batchDate));
  const batchMetadataById = new Map(
    batchOrder.map((row) => [
      row.batchId,
      {
        weekendDate: row.batchDate,
        weekendLabel: row.weekendLabel || row.batchDate
      }
    ] as const)
  );
  const actualLinkMap = await getPlannerActualMatchLinkMap(teamId, batchIds);
  const linkedMatchIds = Array.from(
    new Set(Array.from(actualLinkMap.values()).map((link) => link.matchId))
  );
  const actualParticipationByMatchId = await getPlannerActualParticipationByMatch(teamId, linkedMatchIds);
  const assignmentsByIdentityId = new Map<string, PlannerAssignmentRow[]>();
  const playerByIdentityId = new Map<
    string,
    {
      playerId: string;
      name: string;
      identityNames: string[];
    }
  >();

  roster.forEach((player) => {
    playerByIdentityId.set(player.memberId, {
      playerId: player.playerId ?? player.memberId,
      name: player.name,
      identityNames: player.identityNames
    });

    if (player.playerId) {
      playerByIdentityId.set(player.playerId, {
        playerId: player.playerId,
        name: player.name,
        identityNames: player.identityNames
      });
    }
  });

  ((assignmentsData ?? []) as PlannerAssignmentRow[]).forEach((row) => {
    const identityId =
      typeof row.member_id === "string"
        ? row.member_id
        : typeof row.player_id === "string"
          ? row.player_id
          : null;

    if (!identityId || !rosterIdentityIds.has(identityId)) {
      return;
    }

    const currentRows = assignmentsByIdentityId.get(identityId) ?? [];
    currentRows.push(row);
    assignmentsByIdentityId.set(identityId, currentRows);
  });

  const playerSummaries = roster
    .map((player) => {
      const playerAssignments = [
        ...(assignmentsByIdentityId.get(player.memberId) ?? []),
        ...(player.playerId ? (assignmentsByIdentityId.get(player.playerId) ?? []) : [])
      ].filter((row, index, currentRows) =>
        currentRows.findIndex((candidate) =>
          candidate.batch_id === row.batch_id
          && candidate.match_number === row.match_number
          && candidate.assignment === row.assignment
          && candidate.member_id === row.member_id
          && candidate.player_id === row.player_id
        ) === index
      );
      const xiCount = playerAssignments.filter((row) => {
        const batchId = typeof row.batch_id === "string" ? row.batch_id : null;
        const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
        const actualLink = batchId && matchNumber
          ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null
          : null;
        const actualParticipation = actualLink
          ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
          : null;

        if (actualParticipation) {
          return didPlayerActuallyParticipate(row, actualParticipation, player.identityNames);
        }

        return row.assignment === "xi";
      }).length;
      const twelfthCount = playerAssignments.filter((row) => {
        const batchId = typeof row.batch_id === "string" ? row.batch_id : null;
        const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
        const actualLink = batchId && matchNumber
          ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null
          : null;
        const actualParticipation = actualLink
          ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
          : null;

        if (actualParticipation && didPlayerActuallyParticipate(row, actualParticipation, player.identityNames)) {
          return false;
        }

        return row.assignment === "twelfth";
      }).length;
      const benchCount = playerAssignments.filter((row) => {
        const batchId = typeof row.batch_id === "string" ? row.batch_id : null;
        const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
        const actualLink = batchId && matchNumber
            ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null
          : null;
        const actualParticipation = actualLink
          ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
          : null;

        if (actualParticipation && didPlayerActuallyParticipate(row, actualParticipation, player.identityNames)) {
          return false;
        }

        return row.assignment === "bench";
      }).length;
      const unusedInXiCount = playerAssignments.filter((row) => {
        const batchId = typeof row.batch_id === "string" ? row.batch_id : null;
        const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
        const actualLink = batchId && matchNumber
          ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null
          : null;
        const actualParticipation = actualLink
          ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
          : null;
        const flags = getPlayerActualParticipationFlags(row, actualParticipation, player.identityNames);

        return flags.listed && !flags.batted && !flags.bowled;
      }).length;
      const batCount = playerAssignments.filter((row) => {
        const batchId = typeof row.batch_id === "string" ? row.batch_id : null;
        const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
        const actualLink = batchId && matchNumber
          ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null
          : null;
        const actualParticipation = actualLink
          ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
          : null;

        return getPlayerActualParticipationFlags(row, actualParticipation, player.identityNames).batted;
      }).length;
      const bowlCount = playerAssignments.filter((row) => {
        const batchId = typeof row.batch_id === "string" ? row.batch_id : null;
        const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
        const actualLink = batchId && matchNumber
          ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null
          : null;
        const actualParticipation = actualLink
          ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
          : null;

        return getPlayerActualParticipationFlags(row, actualParticipation, player.identityNames).bowled;
      }).length;
      const unavailableCount = playerAssignments.filter((row) => row.assignment === "unavailable" || row.is_available === false).length;
      const trackedBatchIds = new Set(
        playerAssignments
          .map((row) => (typeof row.batch_id === "string" ? row.batch_id : null))
          .filter((value): value is string => Boolean(value))
      );
      const availableBatchIds = new Set(
        playerAssignments
          .filter((row) => row.is_available !== false && row.assignment !== "unavailable")
          .map((row) => (typeof row.batch_id === "string" ? row.batch_id : null))
          .filter((value): value is string => Boolean(value))
      );
      const assignmentsByBatchId = new Map<string, PlannerAssignmentRow[]>();

      playerAssignments.forEach((row) => {
        const batchId = typeof row.batch_id === "string" ? row.batch_id : null;

        if (!batchId) {
          return;
        }

        const currentRows = assignmentsByBatchId.get(batchId) ?? [];
        currentRows.push(row);
        assignmentsByBatchId.set(batchId, currentRows);
      });

      let consecutiveAvailableNoXiBatches = 0;

      for (const { batchId } of batchOrder) {
        const batchAssignments = assignmentsByBatchId.get(batchId) ?? [];

        if (batchAssignments.length === 0) {
          continue;
        }

        const wasAvailable = batchAssignments.some(
          (row) => row.is_available !== false && row.assignment !== "unavailable"
        );

        if (!wasAvailable) {
          continue;
        }

        const hadXiSelection = batchAssignments.some((row) => {
          const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
          const actualLink = matchNumber ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null : null;
          const actualParticipation = actualLink
            ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
            : null;

          if (actualParticipation) {
            return didPlayerActuallyParticipate(row, actualParticipation, player.identityNames);
          }

          return row.assignment === "xi";
        });

        if (hadXiSelection) {
          break;
        }

        consecutiveAvailableNoXiBatches += 1;
      }

      const underuseRisk = xiCount >= 5 && consecutiveAvailableNoXiBatches >= 2;
      const recentHistory = batchOrder
        .map(({ batchId }) => {
          const batchAssignments = assignmentsByBatchId.get(batchId) ?? [];

          if (batchAssignments.length === 0) {
            return null;
          }

          const metadata = batchMetadataById.get(batchId);
          const pendingMatchCount = batchAssignments.filter((row) => {
            const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
            const actualLink = matchNumber ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null : null;

            return (
              row.is_available !== false
              && row.assignment !== "unavailable"
              && !actualLink
            );
          }).length;
          const actualXiCount = batchAssignments.filter((row) => {
            const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
            const actualLink = matchNumber ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null : null;
            const actualParticipation = actualLink
              ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
              : null;

            if (actualParticipation) {
              return didPlayerActuallyParticipate(row, actualParticipation, player.identityNames);
            }

            return false;
          }).length;
          const actualTwelfthCount = batchAssignments.filter((row) => {
            const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
            const actualLink = matchNumber ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null : null;
            const actualParticipation = actualLink
              ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
              : null;

            if (actualParticipation && didPlayerActuallyParticipate(row, actualParticipation, player.identityNames)) {
              return false;
            }

            return row.assignment === "twelfth";
          }).length;
          const actualBenchCount = batchAssignments.filter((row) => {
            const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
            const actualLink = matchNumber ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null : null;
            const actualParticipation = actualLink
              ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
              : null;

            if (actualParticipation && didPlayerActuallyParticipate(row, actualParticipation, player.identityNames)) {
              return false;
            }

            return row.assignment === "bench";
          }).length;

          return {
            batchId,
            weekendDate: metadata?.weekendDate ?? "",
            weekendLabel: metadata?.weekendLabel ?? "",
            xiCount: actualXiCount,
            twelfthCount: actualTwelfthCount,
            benchCount: actualBenchCount,
            unavailableCount: batchAssignments.filter(
              (row) => row.assignment === "unavailable" || row.is_available === false
            ).length,
            availableMatchCount: batchAssignments.filter(
              (row) => row.is_available !== false && row.assignment !== "unavailable"
            ).length,
            pendingMatchCount,
            plannedXiCount: batchAssignments.filter((row) => row.assignment === "xi").length,
            plannedTwelfthCount: batchAssignments.filter((row) => row.assignment === "twelfth").length,
            plannedBenchCount: batchAssignments.filter((row) => row.assignment === "bench").length
          } satisfies PlannerFairnessHistoryEntry;
        })
        .filter((entry): entry is PlannerFairnessHistoryEntry => Boolean(entry))
        .slice(0, 5);

      return {
        memberId: player.memberId,
        playerId: player.playerId ?? player.memberId,
        name: player.name,
        isCaptain: player.isCaptain,
        isWicketKeeper: player.isWicketKeeper,
        xiCount,
        twelfthCount,
        benchCount,
        unusedInXiCount,
        batCount,
        bowlCount,
        unavailableCount,
        trackedMatchdays: trackedBatchIds.size,
        availableMatchdays: availableBatchIds.size,
        quotaRemaining: Math.max(0, 5 - xiCount),
        consecutiveAvailableNoXiBatches,
        underuseRisk,
        recentHistory
      } satisfies PlannerFairnessPlayerSummary;
    })
    .filter((player) => options?.includePlayersWithoutAvailability || player.availableMatchdays > 0)
    .sort((left, right) => {
      if (left.underuseRisk !== right.underuseRisk) {
        return left.underuseRisk ? -1 : 1;
      }

      if (left.quotaRemaining !== right.quotaRemaining) {
        return right.quotaRemaining - left.quotaRemaining;
      }

      if (left.xiCount !== right.xiCount) {
        return left.xiCount - right.xiCount;
      }

      return left.name.localeCompare(right.name);
    });

  const alerts = playerSummaries.flatMap((player) => {
    const playerAlerts: PlannerFairnessAlert[] = [];

    if (player.consecutiveAvailableNoXiBatches >= 2) {
      playerAlerts.push({
        id: `${player.playerId}-no-xi-yet`,
        type: "no_xi_yet",
        severity: "warning",
        playerId: player.playerId,
        playerName: player.name,
        batchId: null,
        weekendLabel: null,
        weekendDate: null,
        matchNumber: null,
        message: player.xiCount === 0
          ? `${player.name} has been available for ${player.consecutiveAvailableNoXiBatches} consecutive saved week${player.consecutiveAvailableNoXiBatches > 1 ? "s" : ""} but still has 0 actual XI selections.`
          : `${player.name} has been available for ${player.consecutiveAvailableNoXiBatches} consecutive saved week${player.consecutiveAvailableNoXiBatches > 1 ? "s" : ""} without an actual XI selection.`
      });
    }

    if (player.underuseRisk) {
      playerAlerts.push({
        id: `${player.playerId}-underuse-after-quota`,
        type: "underuse_after_quota",
        severity: "warning",
        playerId: player.playerId,
        playerName: player.name,
        batchId: null,
        weekendLabel: null,
        weekendDate: null,
        matchNumber: null,
        message: `${player.name} already crossed the 5-XI baseline but has now missed XI chances across ${player.consecutiveAvailableNoXiBatches} saved matchdays.`
      });
    }

    if (
      player.xiCount < 5
      && player.availableMatchdays >= 2
      && player.benchCount + player.twelfthCount >= Math.max(2, player.xiCount + 1)
    ) {
      playerAlerts.push({
        id: `${player.playerId}-repeat-bench`,
        type: "repeat_bench",
        severity: "warning",
        playerId: player.playerId,
        playerName: player.name,
        batchId: null,
        weekendLabel: null,
        weekendDate: null,
        matchNumber: null,
        message: `${player.name} is picking up repeated bench or 12th-man outcomes before reaching the 5-XI baseline.`
      });
    }

    return playerAlerts;
  });

  const reconciliationAlerts: PlannerFairnessAlert[] = [];

  Array.from(assignmentsByIdentityId.entries()).forEach(([identityId, rows]) => {
    const player = playerByIdentityId.get(identityId);

    if (!player) {
      return;
    }

    rows.forEach((row) => {
      const batchId = typeof row.batch_id === "string" ? row.batch_id : null;
      const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
      const assignment = typeof row.assignment === "string" ? row.assignment : null;

      if (!batchId || matchNumber === null || !assignment) {
        return;
      }

      const actualLink = actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null;

      if (!actualLink) {
        return;
      }

      const actualParticipation = actualParticipationByMatchId.get(actualLink.matchId) ?? null;

      if (!actualParticipation) {
        return;
      }

      const metadata = batchMetadataById.get(batchId);
      const weekendLabel = metadata?.weekendLabel ?? metadata?.weekendDate ?? "the saved matchday";
      const actuallyParticipated = didPlayerActuallyParticipate(
        row,
        actualParticipation,
        player.identityNames
      );
      const batchMatchLabel = `${weekendLabel} Match ${matchNumber}`;

      if (assignment === "xi" && !actuallyParticipated) {
        reconciliationAlerts.push({
          id: `${player.playerId}-${batchId}-${matchNumber}-planned-xi-no-show`,
          type: "planned_xi_no_show",
          severity: "warning",
          playerId: player.playerId,
          playerName: player.name,
          batchId,
          weekendLabel,
          weekendDate: metadata?.weekendDate ?? null,
          matchNumber,
          message: `${player.name} was planned in the XI for ${batchMatchLabel} but no actual appearance was found in the linked scorecard.`
        });
        return;
      }

      if (assignment === "twelfth" && actuallyParticipated) {
        reconciliationAlerts.push({
          id: `${player.playerId}-${batchId}-${matchNumber}-planned-twelfth-used`,
          type: "planned_twelfth_used",
          severity: "info",
          playerId: player.playerId,
          playerName: player.name,
          batchId,
          weekendLabel,
          weekendDate: metadata?.weekendDate ?? null,
          matchNumber,
          message: `${player.name} was planned as 12th man for ${batchMatchLabel} but was actually used in the linked scorecard.`
        });
        return;
      }

      if (assignment === "bench" && actuallyParticipated) {
        reconciliationAlerts.push({
          id: `${player.playerId}-${batchId}-${matchNumber}-planned-bench-used`,
          type: "planned_bench_used",
          severity: "warning",
          playerId: player.playerId,
          playerName: player.name,
          batchId,
          weekendLabel,
          weekendDate: metadata?.weekendDate ?? null,
          matchNumber,
          message: `${player.name} was planned on the bench for ${batchMatchLabel} but appears in the linked scorecard.`
        });
        return;
      }

      if ((assignment === "unavailable" || row.is_available === false) && actuallyParticipated) {
        reconciliationAlerts.push({
          id: `${player.playerId}-${batchId}-${matchNumber}-planned-unavailable-used`,
          type: "planned_unavailable_used",
          severity: "warning",
          playerId: player.playerId,
          playerName: player.name,
          batchId,
          weekendLabel,
          weekendDate: metadata?.weekendDate ?? null,
          matchNumber,
          message: `${player.name} was marked unavailable for ${batchMatchLabel} but appears in the linked scorecard.`
        });
      }
    });
  });

  return {
    savedMatchdays: batchIds.length,
    trackedPlayers: playerSummaries.length,
    playersBelowQuota: playerSummaries.filter((player) => player.xiCount < 5).length,
    playersAtOrAboveQuota: playerSummaries.filter((player) => player.xiCount >= 5).length,
    underuseRiskCount: playerSummaries.filter((player) => player.underuseRisk).length,
    playerSummaries,
    alerts: [...reconciliationAlerts, ...alerts].sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "warning" ? -1 : 1;
    }

    return left.playerName.localeCompare(right.playerName);
    })
  } satisfies PlannerFairnessDashboard;
}

function buildPlannerFairnessMemberSnapshot(
  dashboard: PlannerFairnessDashboard,
  memberId: string
) {
  const member = dashboard.playerSummaries.find((player) => player.memberId === memberId) ?? null;

  return {
    savedMatchdays: dashboard.savedMatchdays,
    member,
    alerts: member
      ? dashboard.alerts.filter((alert) => alert.playerId === member.playerId)
      : []
  } satisfies PlannerFairnessMemberSnapshot;
}

export async function getPlannerFairnessDashboard(season?: string) {
  const access = await requireFairnessWorkspaceAccess();
  const roster = await getPlannerPlayerSummaries(season);

  return buildPlannerFairnessDashboard(access.teamId, roster, season);
}

export async function getCurrentMemberFairnessSnapshot(season?: string) {
  const access = await getCurrentTeamMembershipAccess();

  if (!access.teamId || !access.memberId) {
    throw new Error("Your account is not linked to an active team membership yet.");
  }

  const roster = await getPlannerPlayerSummaries(season, {
    includeInactiveForSeason: true
  });
  const dashboard = await buildPlannerFairnessDashboard(access.teamId, roster, season, {
    includePlayersWithoutAvailability: true
  });

  return buildPlannerFairnessMemberSnapshot(dashboard, access.memberId);
}

export async function getPlannerFairnessMemberSnapshot(
  memberId: string,
  season?: string
) {
  const access = await requireFairnessWorkspaceAccess();
  const roster = await getPlannerPlayerSummaries(season, {
    includeInactiveForSeason: true
  });
  const dashboard = await buildPlannerFairnessDashboard(access.teamId, roster, season, {
    includePlayersWithoutAvailability: true
  });

  return buildPlannerFairnessMemberSnapshot(dashboard, memberId);
}
