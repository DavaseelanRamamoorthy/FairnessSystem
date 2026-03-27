import { cleanName } from "@/app/services/cleanName";
import { getDashboardRecentMatches, DashboardRecentMatch } from "@/app/services/dashboardService";
import {
  DashboardFairnessStatus,
  summarizeFairnessStatus
} from "@/app/services/fairnessSummaryService";
import {
  getPlannerFairnessDashboard
} from "@/app/services/plannerFairnessService";
import {
  getFriendlyPlannerBatchDetail,
  listFriendlyPlannerBatches
} from "@/app/services/plannerHistoryService";
import {
  getMatchesPlayed,
  getRunsPerMatch,
  getTopRunLeaders,
  getTopRunScorer,
  getTopWicketLeaders,
  getTopWicketTaker,
  getWicketsPerMatch,
  getWinRate
} from "@/app/services/statsService";

export type OrganiserFairnessRow = {
  playerId: string;
  name: string;
  xiCount: number;
  twelfthCount: number;
  benchCount: number;
  unusedInXiCount: number;
  batCount: number;
  bowlCount: number;
  fairnessStatus: DashboardFairnessStatus;
  fairnessReason: string;
};

export type UsageInsight = {
  playerId: string;
  name: string;
  reason: string;
};

export type PlannerOutcomeSnapshot = {
  matchCount: number;
  linkedActualMatchCount: number;
  averagePlannedXiCount: number;
  averageActualUtilizedCount: number;
  averageUnusedInXiCount: number;
  totalPlannedXiCount: number;
  totalActualUtilizedCount: number;
  totalUnusedInXiCount: number;
  mismatch: boolean;
  label: string;
} | null;

export type OrganiserDashboardData = {
  summary: {
    matchesPlayed: number;
    winRate: number;
    topRunScorer: { player: string; runs: number } | null;
    topWicketTaker: { player: string; wickets: number } | null;
  };
  leaders: {
    runLeaders: Array<{ player: string; runs: number }>;
    wicketLeaders: Array<{ player: string; wickets: number }>;
  };
  trends: {
    runs: Array<{ match: string; matchLabel: string; runs: number }>;
    wickets: Array<{ match: string; matchLabel: string; wickets: number }>;
  };
  fairnessTable: OrganiserFairnessRow[];
  underusedPlayers: UsageInsight[];
  overusedPlayers: UsageInsight[];
  plannerSnapshot: PlannerOutcomeSnapshot;
  recentMatches: DashboardRecentMatch[];
};

function matchesStatus(status: DashboardFairnessStatus, allowed: DashboardFairnessStatus[]) {
  return allowed.includes(status);
}

function getPlayerSet(values: string[]) {
  return new Set(values.map((value) => cleanName(value)).filter(Boolean));
}

async function getPlannerOutcomeSnapshot(): Promise<PlannerOutcomeSnapshot> {
  const batches = await listFriendlyPlannerBatches();
  const latestBatch = batches[0];

  if (!latestBatch) {
    return null;
  }

  const detail = await getFriendlyPlannerBatchDetail(latestBatch.id);
  const totalPlannedXiCount = detail.matches.reduce((sum, match) => sum + match.xiPlayers.length, 0);
  let totalActualUtilizedCount = 0;
  let totalUnusedInXiCount = 0;
  let linkedActualMatchCount = 0;
  let hasMissingActualLink = false;

  detail.matches.forEach((match) => {
    if (!match.linkedActualMatchId) {
      hasMissingActualLink = true;
      return;
    }

    const batted = getPlayerSet(match.actualBattedPlayers);
    const bowled = getPlayerSet(match.actualBowledPlayers);
    linkedActualMatchCount += 1;

    match.xiPlayers.forEach((player) => {
      const key = cleanName(player);

      if (!key) {
        return;
      }

      if (batted.has(key) || bowled.has(key)) {
        totalActualUtilizedCount += 1;
        return;
      }

      totalUnusedInXiCount += 1;
    });
  });

  const matchCount = detail.matches.length;
  const averagePlannedXiCount = matchCount > 0
    ? Number((totalPlannedXiCount / matchCount).toFixed(1))
    : 0;
  const averageActualUtilizedCount = linkedActualMatchCount > 0
    ? Number((totalActualUtilizedCount / linkedActualMatchCount).toFixed(1))
    : 0;
  const averageUnusedInXiCount = linkedActualMatchCount > 0
    ? Number((totalUnusedInXiCount / linkedActualMatchCount).toFixed(1))
    : 0;

  return {
    matchCount,
    linkedActualMatchCount,
    averagePlannedXiCount,
    averageActualUtilizedCount,
    averageUnusedInXiCount,
    totalPlannedXiCount,
    totalActualUtilizedCount,
    totalUnusedInXiCount,
    mismatch: hasMissingActualLink || totalUnusedInXiCount > 0 || totalActualUtilizedCount < totalPlannedXiCount,
    label: latestBatch.weekendLabel
  };
}

export async function getOrganiserDashboardData(): Promise<OrganiserDashboardData> {
  const [
    matchesPlayed,
    winRate,
    topRunScorer,
    topWicketTaker,
    runLeaders,
    wicketLeaders,
    runsTrend,
    wicketsTrend,
    fairnessDashboard,
    recentMatches,
    plannerSnapshot
  ] = await Promise.all([
    getMatchesPlayed(),
    getWinRate(),
    getTopRunScorer(),
    getTopWicketTaker(),
    getTopRunLeaders(5),
    getTopWicketLeaders(5),
    getRunsPerMatch(),
    getWicketsPerMatch(),
    getPlannerFairnessDashboard(),
    getDashboardRecentMatches(5),
    getPlannerOutcomeSnapshot()
  ]);

  const fairnessTable = fairnessDashboard.playerSummaries.map((player) => {
    const fairness = summarizeFairnessStatus(player);

    return {
      playerId: player.playerId,
      name: player.name,
      xiCount: player.xiCount,
      twelfthCount: player.twelfthCount,
      benchCount: player.benchCount,
      unusedInXiCount: player.unusedInXiCount,
      batCount: player.batCount,
      bowlCount: player.bowlCount,
      fairnessStatus: fairness.status,
      fairnessReason: fairness.reason
    } satisfies OrganiserFairnessRow;
  });

  const underusedPlayers = fairnessTable
    .filter((player) => matchesStatus(player.fairnessStatus, ["Recently Unused", "Bench Heavy", "Underused"]))
    .map((player) => ({
      playerId: player.playerId,
      name: player.name,
      reason: player.fairnessReason
    }))
    .slice(0, 6);

  const overusedPlayers = fairnessTable
    .filter((player) => player.fairnessStatus === "Overused")
    .map((player) => ({
      playerId: player.playerId,
      name: player.name,
      reason: player.fairnessReason
    }))
    .slice(0, 6);

  return {
    summary: {
      matchesPlayed,
      winRate,
      topRunScorer,
      topWicketTaker
    },
    leaders: {
      runLeaders,
      wicketLeaders
    },
    trends: {
      runs: runsTrend,
      wickets: wicketsTrend
    },
    fairnessTable,
    underusedPlayers,
    overusedPlayers,
    plannerSnapshot,
    recentMatches
  };
}
