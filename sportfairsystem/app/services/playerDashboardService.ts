import { cleanName } from "@/app/services/cleanName";
import { getCurrentTeamMembershipAccess } from "@/app/services/accessControlService";
import {
  getCurrentMemberFairnessSnapshot
} from "@/app/services/plannerFairnessService";
import {
  CurrentMemberPlannerWeekSnapshot,
  getCurrentMemberFriendlyPlannerWeekSnapshot
} from "@/app/services/plannerHistoryService";
import { getPlannerActualMatchLinkMap, getPlannerActualParticipationByMatch } from "@/app/services/plannerActualService";
import {
  getPlayerProfile,
  PlayerProfile
} from "@/app/services/playerProfileService";
import { supabase } from "@/app/services/supabaseClient";
import { getOpponentName } from "@/app/utils/matchOpponent";
import { getActiveTeamContext } from "@/app/services/teamContextService";
import {
  DashboardFairnessStatus,
  summarizeFairnessStatus
} from "@/app/services/fairnessSummaryService";

type PlayerTimelineBatchRow = {
  id?: unknown;
  weekend_date?: unknown;
  weekend_label?: unknown;
  created_at?: unknown;
};

type PlayerTimelineAssignmentRow = {
  batch_id?: unknown;
  match_number?: unknown;
  player_id?: unknown;
  member_id?: unknown;
  player_name?: unknown;
  assignment?: unknown;
  is_available?: unknown;
};

type LinkedMatchRow = {
  id: string;
  match_date: string | null;
  team_a: string | null;
  team_b: string | null;
  result: string | null;
  result_summary: string | null;
  match_code: string | null;
};

export type PlayerOpportunityTimelineItem = {
  id: string;
  date: string | null;
  opponent: string | null;
  plannedStatus: "XI" | "12th" | "Bench" | "Unavailable";
  actualStatus: "Batted" | "Bowled" | "Both" | "Not Used" | "Unavailable" | "Pending";
};

export type PlayerOpportunityTrendPoint = {
  match: string;
  matchLabel: string;
  score: number;
  plannedStatus: PlayerOpportunityTimelineItem["plannedStatus"];
  actualStatus: PlayerOpportunityTimelineItem["actualStatus"];
};

export type PlayerDashboardData = {
  summary: {
    matchesPlayed: number;
    totalRuns: number;
    totalWickets: number;
    fairnessStatus: DashboardFairnessStatus;
  };
  opportunityBreakdown: {
    xiAppearances: number;
    twelfthCount: number;
    benchCount: number;
    unusedInXiCount: number;
    unavailableCount: number;
  };
  performance: {
    totalRuns: number;
    totalWickets: number;
    recentContributionSummary: string;
    strikeRate: number | null;
    economy: number | null;
  };
  plannerWeek: CurrentMemberPlannerWeekSnapshot | null;
  timeline: PlayerOpportunityTimelineItem[];
  trends: {
    runs: Array<{ match: string; matchLabel: string; runs: number }>;
    wickets: Array<{ match: string; matchLabel: string; wickets: number }>;
    opportunity: PlayerOpportunityTrendPoint[];
  };
  recentMatches: Array<{
    id: string;
    date: string | null;
    opponent: string | null;
    result: string | null;
    resultSummary: string | null;
    playerStatus: string;
    contribution: string;
  }>;
};

function mapPlannerStatus(value: unknown): PlayerOpportunityTimelineItem["plannedStatus"] | null {
  if (value === "xi") {
    return "XI";
  }

  if (value === "twelfth") {
    return "12th";
  }

  if (value === "bench") {
    return "Bench";
  }

  if (value === "unavailable") {
    return "Unavailable";
  }

  return null;
}

function getActualStatus(args: {
  plannedStatus: PlayerOpportunityTimelineItem["plannedStatus"];
  isAvailable: boolean;
  linked: boolean;
  listed: boolean;
  batted: boolean;
  bowled: boolean;
}): PlayerOpportunityTimelineItem["actualStatus"] {
  if (!args.isAvailable || args.plannedStatus === "Unavailable") {
    return "Unavailable";
  }

  if (!args.linked) {
    return "Pending";
  }

  if (args.batted && args.bowled) {
    return "Both";
  }

  if (args.batted) {
    return "Batted";
  }

  if (args.bowled) {
    return "Bowled";
  }

  if (args.listed || args.plannedStatus === "XI" || args.plannedStatus === "12th" || args.plannedStatus === "Bench") {
    return "Not Used";
  }

  return "Pending";
}

function getOpportunityScore(status: PlayerOpportunityTimelineItem["actualStatus"]) {
  switch (status) {
    case "Both":
      return 3;
    case "Batted":
    case "Bowled":
      return 2;
    case "Not Used":
      return 1;
    case "Pending":
      return 0.5;
    default:
      return 0;
  }
}

async function getCurrentMemberOpportunityTimeline(
  teamId: string,
  memberId: string,
  teamName: string
): Promise<PlayerOpportunityTimelineItem[]> {
  const { data: batchData, error: batchError } = await supabase
    .from("planner_matchday_batches")
    .select("id, weekend_date, weekend_label, created_at")
    .eq("team_id", teamId)
    .eq("planner_mode", "friendly")
    .order("weekend_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);

  if (batchError) {
    throw new Error("Could not load your planner timeline.");
  }

  const batches = ((batchData ?? []) as PlayerTimelineBatchRow[])
    .flatMap((row) => {
      if (typeof row.id !== "string") {
        return [];
      }

      return [{
        id: row.id,
        weekendDate: typeof row.weekend_date === "string"
          ? row.weekend_date
          : typeof row.created_at === "string"
            ? row.created_at
            : null,
        weekendLabel: typeof row.weekend_label === "string" ? row.weekend_label : "Planner Week"
      }];
    });

  if (batches.length === 0) {
    return [];
  }

  const batchIds = batches.map((batch) => batch.id);
  const { data: assignmentData, error: assignmentError } = await supabase
    .from("planner_matchday_assignments")
    .select("batch_id, match_number, player_id, member_id, player_name, assignment, is_available")
    .eq("team_id", teamId)
    .eq("member_id", memberId)
    .in("batch_id", batchIds)
    .order("match_number", { ascending: true });

  if (assignmentError) {
    throw new Error("Could not load your planner timeline assignments.");
  }

  const actualLinkMap = await getPlannerActualMatchLinkMap(teamId, batchIds);
  const linkedMatchIds = Array.from(new Set(Array.from(actualLinkMap.values()).map((link) => link.matchId)));
  const actualParticipationByMatchId = await getPlannerActualParticipationByMatch(teamId, linkedMatchIds);
  const { data: linkedMatchesData, error: linkedMatchesError } = linkedMatchIds.length > 0
    ? await supabase
      .from("matches")
      .select("id, match_date, team_a, team_b, result, result_summary, match_code")
      .in("id", linkedMatchIds)
    : { data: [], error: null };

  if (linkedMatchesError) {
    throw new Error("Could not load linked actual matches for your planner timeline.");
  }

  const linkedMatchesById = new Map(
    ((linkedMatchesData ?? []) as LinkedMatchRow[]).map((match) => [match.id, match] as const)
  );
  const batchesById = new Map(batches.map((batch) => [batch.id, batch] as const));

  return ((assignmentData ?? []) as PlayerTimelineAssignmentRow[])
    .flatMap((row) => {
      if (typeof row.batch_id !== "string" || typeof row.match_number !== "number") {
        return [];
      }

      const plannedStatus = mapPlannerStatus(row.assignment);

      if (!plannedStatus) {
        return [];
      }

      const batch = batchesById.get(row.batch_id);
      const actualLink = actualLinkMap.get(`${row.batch_id}:${row.match_number}`) ?? null;
      const actualParticipation = actualLink
        ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
        : null;
      const linkedMatch = actualLink ? linkedMatchesById.get(actualLink.matchId) ?? null : null;
      const playerId = typeof row.player_id === "string" ? row.player_id : null;
      const normalizedPlayerName = typeof row.player_name === "string"
        ? cleanName(row.player_name)
        : "";
      const listed = Boolean(
        actualParticipation && (
          (playerId && actualParticipation.listedPlayerIds.has(playerId))
          || (normalizedPlayerName && actualParticipation.listedNameKeys.has(normalizedPlayerName))
        )
      );
      const batted = Boolean(
        actualParticipation && (
          (playerId && actualParticipation.battedPlayerIds.has(playerId))
          || (normalizedPlayerName && actualParticipation.battedNameKeys.has(normalizedPlayerName))
        )
      );
      const bowled = Boolean(
        actualParticipation && (
          (playerId && actualParticipation.bowledPlayerIds.has(playerId))
          || (normalizedPlayerName && actualParticipation.bowledNameKeys.has(normalizedPlayerName))
        )
      );

      const actualStatus = getActualStatus({
        plannedStatus,
        isAvailable: row.is_available !== false && plannedStatus !== "Unavailable",
        linked: Boolean(actualLink),
        listed,
        batted,
        bowled
      });

      return [{
        id: `${row.batch_id}:${row.match_number}`,
        date: linkedMatch?.match_date ?? batch?.weekendDate ?? null,
        opponent: linkedMatch
          ? getOpponentName(linkedMatch.team_a, linkedMatch.team_b, teamName)
          : batch?.weekendLabel ?? `Match ${row.match_number}`,
        plannedStatus,
        actualStatus
      }];
    })
    .sort((left, right) => `${right.date ?? ""}|${right.id}`.localeCompare(`${left.date ?? ""}|${left.id}`))
    .slice(0, 6);
}

function buildRecentContributionSummary(profile: PlayerProfile | null) {
  if (!profile || profile.recentMatches.length === 0) {
    return "No recent linked scorecard contribution yet.";
  }

  const lastThreeMatches = profile.recentMatches.slice(0, 3);
  const recentRuns = lastThreeMatches.reduce((sum, match) => sum + match.runs, 0);
  const recentWickets = lastThreeMatches.reduce((sum, match) => sum + match.wickets, 0);

  return `Last ${lastThreeMatches.length} matches: ${recentRuns} runs, ${recentWickets} wickets.`;
}

export async function getPlayerDashboardData(playerId: string | null): Promise<PlayerDashboardData | null> {
  const access = await getCurrentTeamMembershipAccess();

  if (!access.teamId || !access.memberId) {
    return null;
  }

  const { teamName } = await getActiveTeamContext();
  const [fairnessSnapshot, plannerWeek, playerProfile, timeline] = await Promise.all([
    getCurrentMemberFairnessSnapshot(),
    getCurrentMemberFriendlyPlannerWeekSnapshot(),
    playerId ? getPlayerProfile(playerId) : Promise.resolve(null),
    getCurrentMemberOpportunityTimeline(access.teamId, access.memberId, teamName)
  ]);

  const fairnessMember = fairnessSnapshot.member;
  const fairness = fairnessMember
    ? summarizeFairnessStatus(fairnessMember)
    : { status: "Balanced" as const, reason: "No fairness history is available yet." };
  const recentMatches = (playerProfile?.recentMatches ?? []).slice(0, 5);

  return {
    summary: {
      matchesPlayed: playerProfile?.matchesPlayed ?? 0,
      totalRuns: playerProfile?.totalRuns ?? 0,
      totalWickets: playerProfile?.totalWickets ?? 0,
      fairnessStatus: fairness.status
    },
    opportunityBreakdown: {
      xiAppearances: fairnessMember?.xiCount ?? 0,
      twelfthCount: fairnessMember?.twelfthCount ?? 0,
      benchCount: fairnessMember?.benchCount ?? 0,
      unusedInXiCount: fairnessMember?.unusedInXiCount ?? 0,
      unavailableCount: fairnessMember?.unavailableCount ?? 0
    },
    performance: {
      totalRuns: playerProfile?.totalRuns ?? 0,
      totalWickets: playerProfile?.totalWickets ?? 0,
      recentContributionSummary: buildRecentContributionSummary(playerProfile),
      strikeRate: playerProfile?.strikeRate ?? null,
      economy: playerProfile?.economy ?? null
    },
    plannerWeek,
    timeline,
    trends: {
      runs: recentMatches
        .slice()
        .reverse()
        .map((match, index) => ({
          match: match.matchCode ?? `Match ${index + 1}`,
          matchLabel: match.matchCode ?? match.opponentName ?? `Match ${index + 1}`,
          runs: match.runs
        })),
      wickets: recentMatches
        .slice()
        .reverse()
        .map((match, index) => ({
          match: match.matchCode ?? `Match ${index + 1}`,
          matchLabel: match.matchCode ?? match.opponentName ?? `Match ${index + 1}`,
          wickets: match.wickets
        })),
      opportunity: timeline
        .slice()
        .reverse()
        .map((item, index) => ({
          match: `M${index + 1}`,
          matchLabel: item.date
            ? `${item.opponent ?? `Match ${index + 1}`} - ${item.date}`
            : item.opponent ?? `Match ${index + 1}`,
          score: getOpportunityScore(item.actualStatus),
          plannedStatus: item.plannedStatus,
          actualStatus: item.actualStatus
        }))
    },
    recentMatches: recentMatches.map((match) => ({
      id: match.id,
      date: match.matchDate,
      opponent: match.opponentName,
      result: match.result,
      resultSummary: match.resultSummary,
      playerStatus: match.wickets > 0 && match.runs > 0
        ? "Batted & Bowled"
        : match.wickets > 0
          ? "Bowled"
          : match.runs > 0
            ? "Batted"
            : "Not Used",
      contribution: `${match.runs} runs / ${match.wickets} wickets`
    }))
  };
}
