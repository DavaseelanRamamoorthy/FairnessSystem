import { requireFairnessWorkspaceAccess } from "@/app/services/accessControlService";
import {
  getPlannerActualMatchLinkMap,
  getPlannerActualParticipationByMatch
} from "@/app/services/plannerActualService";
import { cleanName } from "@/app/services/cleanName";
import { getPlannerPlayerSummaries } from "@/app/services/playerProfileService";
import { supabase } from "@/app/services/supabaseClient";

type PlannerBatchRow = {
  id?: unknown;
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
  playerId: string;
  name: string;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  xiCount: number;
  twelfthCount: number;
  benchCount: number;
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

export type PlannerFairnessAlert = {
  id: string;
  type: "baseline_build" | "no_xi_yet" | "underuse_after_quota" | "repeat_bench";
  severity: "info" | "warning";
  playerId: string;
  playerName: string;
  message: string;
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

function didPlayerActuallyParticipate(
  row: PlannerAssignmentRow,
  actualParticipation:
    | Awaited<ReturnType<typeof getPlannerActualParticipationByMatch>> extends Map<string, infer T>
      ? T
      : never
    | null
) {
  if (!actualParticipation) {
    return false;
  }

  const normalizedPlayerName = typeof row.player_name === "string"
    ? cleanName(row.player_name)
    : "";
  const playerId = typeof row.player_id === "string" ? row.player_id : null;

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
  );
}

export async function getPlannerFairnessDashboard(season?: string) {
  const access = await requireFairnessWorkspaceAccess();
  const roster = await getPlannerPlayerSummaries(season);

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

  const batchesQuery = supabase
    .from("planner_matchday_batches")
    .select("id, weekend_date, weekend_label, created_at")
    .eq("team_id", access.teamId)
    .eq("planner_mode", "friendly")
    .order("weekend_date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: batchesData, error: batchesError } = season
    ? await batchesQuery.eq("season", season)
    : await batchesQuery;

  if (batchesError) {
    if (isPlannerPersistenceMissingError(batchesError)) {
      throw new Error("Planner fairness history is not available yet. Run the V2 planner persistence SQL first.");
    }

    throw new Error("Could not load saved planner batches.");
  }

  const batchRows = (batchesData ?? []) as PlannerBatchRow[];
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
      .select("batch_id, match_number, player_id, member_id, assignment, is_available")
      .eq("team_id", access.teamId)
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
  const actualLinkMap = await getPlannerActualMatchLinkMap(access.teamId, batchIds);
  const linkedMatchIds = Array.from(
    new Set(Array.from(actualLinkMap.values()).map((link) => link.matchId))
  );
  const actualParticipationByMatchId = await getPlannerActualParticipationByMatch(access.teamId, linkedMatchIds);
  const assignmentsByIdentityId = new Map<string, PlannerAssignmentRow[]>();

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
          return didPlayerActuallyParticipate(row, actualParticipation);
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

        if (actualParticipation && didPlayerActuallyParticipate(row, actualParticipation)) {
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

        if (actualParticipation && didPlayerActuallyParticipate(row, actualParticipation)) {
          return false;
        }

        return row.assignment === "bench";
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

        const hadXiSelection = batchAssignments.some((row) => row.assignment === "xi");

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
          const actualXiCount = batchAssignments.filter((row) => {
            const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
            const actualLink = matchNumber ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null : null;
            const actualParticipation = actualLink
              ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
              : null;

            if (actualParticipation) {
              return didPlayerActuallyParticipate(row, actualParticipation);
            }

            return row.assignment === "xi";
          }).length;
          const actualTwelfthCount = batchAssignments.filter((row) => {
            const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
            const actualLink = matchNumber ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null : null;
            const actualParticipation = actualLink
              ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
              : null;

            if (actualParticipation && didPlayerActuallyParticipate(row, actualParticipation)) {
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

            if (actualParticipation && didPlayerActuallyParticipate(row, actualParticipation)) {
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
            ).length
          } satisfies PlannerFairnessHistoryEntry;
        })
        .filter((entry): entry is PlannerFairnessHistoryEntry => Boolean(entry))
        .slice(0, 5);

      return {
        playerId: player.playerId ?? player.memberId,
        name: player.name,
        isCaptain: player.isCaptain,
        isWicketKeeper: player.isWicketKeeper,
        xiCount,
        twelfthCount,
        benchCount,
        unavailableCount,
        trackedMatchdays: trackedBatchIds.size,
        availableMatchdays: availableBatchIds.size,
        quotaRemaining: Math.max(0, 5 - xiCount),
        consecutiveAvailableNoXiBatches,
        underuseRisk,
        recentHistory
      } satisfies PlannerFairnessPlayerSummary;
    })
    .filter((player) => player.availableMatchdays > 0)
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

    if (player.availableMatchdays >= 1 && player.xiCount === 0) {
      playerAlerts.push({
        id: `${player.playerId}-no-xi-yet`,
        type: "no_xi_yet",
        severity: "warning",
        playerId: player.playerId,
        playerName: player.name,
        message: `${player.name} has been available for ${player.availableMatchdays} saved matchday${player.availableMatchdays > 1 ? "s" : ""} but still has 0 XI selections.`
      });
    } else if (player.quotaRemaining > 0 && player.availableMatchdays >= 1) {
      playerAlerts.push({
        id: `${player.playerId}-baseline-build`,
        type: "baseline_build",
        severity: "info",
        playerId: player.playerId,
        playerName: player.name,
        message: `${player.name} still needs ${player.quotaRemaining} more XI selection${player.quotaRemaining > 1 ? "s" : ""} to complete the 5-match baseline.`
      });
    }

    if (player.underuseRisk) {
      playerAlerts.push({
        id: `${player.playerId}-underuse-after-quota`,
        type: "underuse_after_quota",
        severity: "warning",
        playerId: player.playerId,
        playerName: player.name,
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
        message: `${player.name} is picking up repeated bench or 12th-man outcomes before reaching the 5-XI baseline.`
      });
    }

    return playerAlerts;
  }).sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "warning" ? -1 : 1;
    }

    return left.playerName.localeCompare(right.playerName);
  });

  return {
    savedMatchdays: batchIds.length,
    trackedPlayers: playerSummaries.length,
    playersBelowQuota: playerSummaries.filter((player) => player.xiCount < 5).length,
    playersAtOrAboveQuota: playerSummaries.filter((player) => player.xiCount >= 5).length,
    underuseRiskCount: playerSummaries.filter((player) => player.underuseRisk).length,
    playerSummaries,
    alerts
  } satisfies PlannerFairnessDashboard;
}
