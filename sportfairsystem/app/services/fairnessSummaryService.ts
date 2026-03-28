import { PlannerFairnessPlayerSummary } from "@/app/services/plannerFairnessService";

export type DashboardFairnessStatus =
  | "Balanced"
  | "Underused"
  | "Overused"
  | "Bench Heavy"
  | "Recently Unused";

export type DashboardFairnessSummary = {
  status: DashboardFairnessStatus;
  reason: string;
};

function getLatestAvailableHistory(player: PlannerFairnessPlayerSummary) {
  return player.recentHistory.find((entry) => entry.availableMatchCount > 0) ?? null;
}

export function summarizeFairnessStatus(
  player: PlannerFairnessPlayerSummary
): DashboardFairnessSummary {
  const nonXiCount = player.benchCount + player.twelfthCount;
  const latestAvailableHistory = getLatestAvailableHistory(player);
  const latestAvailableNoXi = Boolean(
    latestAvailableHistory
    && latestAvailableHistory.availableMatchCount > 0
    && latestAvailableHistory.xiCount === 0
  );

  if (player.unusedInXiCount > 0 && latestAvailableNoXi) {
    return {
      status: "Recently Unused",
      reason: "Listed in the recent XI but did not bat or bowl."
    };
  }

  if (
    player.availableMatchdays >= 2
    && nonXiCount >= Math.max(2, player.xiCount + 1)
  ) {
    return {
      status: "Bench Heavy",
      reason: "Bench and 12th-man outcomes are outweighing XI opportunities."
    };
  }

  if (
    player.availableMatchdays >= 3
    && (
      player.underuseRisk
      || player.xiCount <= Math.max(1, Math.floor(player.availableMatchdays / 2))
    )
  ) {
    return {
      status: "Underused",
      reason: "Available often, but still receiving fewer XI chances than expected."
    };
  }

  if (
    player.availableMatchdays >= 4
    && player.xiCount >= Math.max(4, Math.ceil(player.availableMatchdays * 0.75))
    && (player.batCount + player.bowlCount) >= Math.max(4, player.xiCount)
  ) {
    return {
      status: "Overused",
      reason: "High XI frequency combined with repeated batting or bowling usage."
    };
  }

  return {
    status: "Balanced",
    reason: "Opportunity distribution looks healthy across recent tracked weeks."
  };
}

