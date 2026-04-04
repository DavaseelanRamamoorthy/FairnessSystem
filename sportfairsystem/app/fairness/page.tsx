"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import PaginationFooter from "@/app/components/common/PaginationFooter";
import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import MemberFairnessView from "@/app/components/fairness/MemberFairnessView";
import { useAuth } from "@/app/context/AuthContext";
import { canAccessFairnessWorkspace } from "@/app/services/accessControlService";
import { cleanName } from "@/app/services/cleanName";
import { formatName } from "@/app/services/formatname";
import {
  deleteFriendlyPlannerBatch,
  getFriendlyPlannerBatchDetail,
  listFriendlyPlannerBatches,
  PlannerBatchDetail,
  PlannerBatchListItem,
  updateFriendlyPlannerBatchActualMatchLink,
  updateFriendlyPlannerBatchNotes
} from "@/app/services/plannerHistoryService";
import {
  PlannerFairnessAlert,
  PlannerFairnessDashboard,
  getPlannerFairnessDashboard
} from "@/app/services/plannerFairnessService";
import {
  getPlannerPlayerSummaries,
  getPlayerSeasons,
  PlannerPlayerSummary,
  SeasonOption
} from "@/app/services/playerProfileService";
import { getLatestSeasonValue } from "@/app/utils/seasonSelection";
import { readStoredSeasonFilter, storeSeasonFilter } from "@/app/utils/seasonFilterStorage";

const FAIRNESS_SEASON_STORAGE_KEY = "sportfairsystem:season-filter:fairness";
const FAIRNESS_TRACKER_PAGE_SIZE = 5;
const SAVED_BATCHES_PAGE_SIZE = 5;

function MetricCard({
  label,
  value,
  helper
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <Card variant="outlined" sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={0.75}>
          <Typography variant="subtitle2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1 }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {helper}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function EmptyStateMessage({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        px: 1,
        py: 0.5
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
    </Box>
  );
}

function buildFairnessRoleLabel(player: PlannerFairnessDashboard["playerSummaries"][number]) {
  const tags = [
    player.isCaptain ? "C" : null,
    player.isWicketKeeper ? "WK" : null
  ].filter(Boolean);

  return tags.length > 0 ? `${formatName(player.name)} - ${tags.join(", ")}` : formatName(player.name);
}

function buildFairnessHistoryLabel(
  entry: PlannerFairnessDashboard["playerSummaries"][number]["recentHistory"][number]
) {
  const resultParts = [
    entry.xiCount > 0 ? `XI ${entry.xiCount}` : null,
    entry.twelfthCount > 0 ? `12th ${entry.twelfthCount}` : null,
    entry.benchCount > 0 ? `Bench ${entry.benchCount}` : null,
    entry.unavailableCount > 0 ? `Unavailable ${entry.unavailableCount}` : null
  ].filter(Boolean);

  return resultParts.length > 0
    ? `${entry.weekendLabel}: ${resultParts.join(", ")}`
    : `${entry.weekendLabel}: No tracked assignments`;
}

function stripLeadingPlayerNameFromAlert(alert: PlannerFairnessAlert) {
  const normalizedPlayerName = formatName(alert.playerName).toLowerCase();
  const message = alert.message.trim();
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.startsWith(normalizedPlayerName)) {
    return message.slice(formatName(alert.playerName).length).trimStart();
  }

  if (typeof alert.playerName === "string" && normalizedMessage.startsWith(alert.playerName.toLowerCase())) {
    return message.slice(alert.playerName.length).trimStart();
  }

  return message;
}

function stripBiasWatchContextFromAlert(alert: PlannerFairnessAlert) {
  let message = stripLeadingPlayerNameFromAlert(alert);
  const weekendLabel = alert.weekendLabel?.trim();
  const matchLabel = alert.matchNumber ? `Match ${alert.matchNumber}` : "";
  const combinedContext = [weekendLabel, matchLabel].filter(Boolean).join(" ");

  if (combinedContext) {
    const contextPattern = new RegExp(combinedContext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    message = message.replace(contextPattern, "").replace(/\s{2,}/g, " ").trim();
  }

  return message
    .replace(/\s+for\s+but\s+/i, " but ")
    .replace(/\s+for\s+\./i, ".")
    .trim();
}

function formatBiasWatchAlertMessage(alert: PlannerFairnessAlert) {
  const cleanedMessage = stripBiasWatchContextFromAlert(alert)
    .replace(/\bwas planned on the bench but appears in the linked scorecard\./i, "Started as a bench call, but ended up being used in the actual match.")
    .replace(/\bwas planned as 12th man but was actually used in the linked scorecard\./i, "Was originally marked as 12th man, but was brought into the actual match.")
    .replace(/\bwas planned in the XI but no actual appearance was found in the linked scorecard\./i, "Was lined up in the XI, but the linked scorecard does not show an actual appearance.")
    .replace(/\bwas marked unavailable but appears in the linked scorecard\./i, "Was marked unavailable, but still shows up in the actual match.")
    .replace(/\bwas planned\b/i, "Started")
    .trim();

  if (!cleanedMessage) {
    return "This saved week shows a planning-versus-actual mismatch that is worth reviewing.";
  }

  return cleanedMessage.charAt(0).toUpperCase() + cleanedMessage.slice(1);
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function StaticNameList({ names }: { names: string[] }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {names.map((name, index) => (
        <Typography
          key={`${name}-${index}`}
          component="li"
          variant="body2"
          sx={{ mb: 0.5 }}
        >
          {formatName(name)}
        </Typography>
      ))}
    </Box>
  );
}

function normalizeComparisonName(name: string) {
  return cleanName(name).replace(/\s+/g, " ").trim();
}

function resolveComparisonIdentityKey(name: string, canonicalNameByIdentityKey: Map<string, string>) {
  const normalizedName = normalizeComparisonName(name);
  return canonicalNameByIdentityKey.get(normalizedName) ?? normalizedName;
}

function buildMatchComparisonInsights(
  match: PlannerBatchDetail["matches"][number],
  canonicalNameByIdentityKey: Map<string, string>
) {
  const actualNameKeySet = new Set(
    match.actualListedPlayers.map((name) => resolveComparisonIdentityKey(name, canonicalNameByIdentityKey))
  );
  const plannedXiNoShow = match.xiPlayers.filter(
    (name) => !actualNameKeySet.has(resolveComparisonIdentityKey(name, canonicalNameByIdentityKey))
  );
  const plannedTwelfthUsed = match.twelfthPlayer
    ? actualNameKeySet.has(resolveComparisonIdentityKey(match.twelfthPlayer, canonicalNameByIdentityKey))
      ? [match.twelfthPlayer]
      : []
    : [];
  const plannedBenchUsed = match.benchPlayers.filter(
    (name) => actualNameKeySet.has(resolveComparisonIdentityKey(name, canonicalNameByIdentityKey))
  );
  const plannedUnavailableUsed = match.unavailablePlayers.filter(
    (name) => actualNameKeySet.has(resolveComparisonIdentityKey(name, canonicalNameByIdentityKey))
  );
  const insights: string[] = [];

  if (plannedXiNoShow.length > 0) {
    insights.push(`Planned XI but no actual appearance: ${plannedXiNoShow.map((name) => formatName(name)).join(", ")}`);
  }

  if (plannedTwelfthUsed.length > 0) {
    insights.push(`Planned 12th but actually used: ${plannedTwelfthUsed.map((name) => formatName(name)).join(", ")}`);
  }

  if (plannedBenchUsed.length > 0) {
    insights.push(`Planned bench but actually used: ${plannedBenchUsed.map((name) => formatName(name)).join(", ")}`);
  }

  if (plannedUnavailableUsed.length > 0) {
    insights.push(`Marked unavailable but appeared: ${plannedUnavailableUsed.map((name) => formatName(name)).join(", ")}`);
  }

  return insights;
}

export default function FairnessPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(() => readStoredSeasonFilter(FAIRNESS_SEASON_STORAGE_KEY) ?? "");
  const [hasResolvedSeason, setHasResolvedSeason] = useState(false);
  const [dashboard, setDashboard] = useState<PlannerFairnessDashboard | null>(null);
  const [plannerIdentitySummaries, setPlannerIdentitySummaries] = useState<PlannerPlayerSummary[]>([]);
  const [recentComparisonBatchDetails, setRecentComparisonBatchDetails] = useState<PlannerBatchDetail[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isLoadingComparisonInsights, setIsLoadingComparisonInsights] = useState(false);
  const [savedBatches, setSavedBatches] = useState<PlannerBatchListItem[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedBatchDetail, setSelectedBatchDetail] = useState<PlannerBatchDetail | null>(null);
  const [isLoadingBatchDetail, setIsLoadingBatchDetail] = useState(false);
  const [batchNotesDraft, setBatchNotesDraft] = useState("");
  const [isSavingBatchNotes, setIsSavingBatchNotes] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [savingActualMatchKey, setSavingActualMatchKey] = useState<string | null>(null);
  const [isAutoLinkingSuggestedMatches, setIsAutoLinkingSuggestedMatches] = useState(false);
  const [fairnessTrackerPage, setFairnessTrackerPage] = useState(1);
  const [savedBatchesPage, setSavedBatchesPage] = useState(1);
  const [weeklyInsightPage, setWeeklyInsightPage] = useState(1);
  const [selectedAlertPlayerId, setSelectedAlertPlayerId] = useState<string>("");
  const [selectedBiasWatchPlayerId, setSelectedBiasWatchPlayerId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadAccess = async () => {
      try {
        const nextAccess = await canAccessFairnessWorkspace();

        if (isActive) {
          setHasAccess(nextAccess);
        }
      } catch {
        if (isActive) {
          setHasAccess(false);
        }
      }
    };

    if (!isAuthenticated) {
      setHasAccess(false);
      return () => {
        isActive = false;
      };
    }

    void loadAccess();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    let isActive = true;

    const loadSeasons = async () => {
      try {
        const nextSeasons = await getPlayerSeasons();

        if (!isActive) {
          return;
        }

        setSeasons(nextSeasons);
        const storedSeason = readStoredSeasonFilter(FAIRNESS_SEASON_STORAGE_KEY);
        const nextSeasonValues = new Set(nextSeasons.map((season) => season.value));
        const resolvedSeason = storedSeason && (storedSeason === "all" || nextSeasonValues.has(storedSeason))
          ? storedSeason
          : getLatestSeasonValue(nextSeasons);

        setSelectedSeason((currentSeason) =>
          currentSeason && (currentSeason === "all" || nextSeasonValues.has(currentSeason))
            ? currentSeason
            : resolvedSeason
        );
      } finally {
        if (isActive) {
          setHasResolvedSeason(true);
        }
      }
    };

    void loadSeasons();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      storeSeasonFilter(FAIRNESS_SEASON_STORAGE_KEY, selectedSeason);
    }
  }, [selectedSeason]);

  const canonicalNameByIdentityKey = useMemo(() => {
    const nextMap = new Map<string, string>();

    plannerIdentitySummaries.forEach((player) => {
      const canonicalName = formatName(player.name);

      [player.name, ...(player.identityNames ?? [])].forEach((identityName) => {
        const normalizedKey = normalizeComparisonName(identityName);

        if (!normalizedKey || nextMap.has(normalizedKey)) {
          return;
        }

        nextMap.set(normalizedKey, canonicalName);
      });
    });

    return nextMap;
  }, [plannerIdentitySummaries]);

  const recentComparisonInsights = useMemo(() => {
    return recentComparisonBatchDetails.map((batchDetail) => ({
      batchId: batchDetail.id,
      weekendLabel: batchDetail.weekendLabel,
      weekendDate: batchDetail.weekendDate,
      entries: batchDetail.matches.flatMap((match) => {
        if (!match.linkedActualMatchId) {
          return [];
        }

        const insights = buildMatchComparisonInsights(match, canonicalNameByIdentityKey);

        if (insights.length === 0) {
          return [];
        }

        return [{
          id: `${batchDetail.id}-match-${match.matchNumber}`,
          matchNumber: match.matchNumber,
          insights
        }];
      })
    }));
  }, [canonicalNameByIdentityKey, recentComparisonBatchDetails]);

  const loadFairnessWorkspace = useCallback(async () => {
    if (!hasAccess || (!hasResolvedSeason && !selectedSeason)) {
      return;
    }

    setIsLoadingDashboard(true);
    setIsLoadingBatches(true);
    setDashboardError(null);
    setErrorMessage(null);

    try {
      const normalizedSeason = !selectedSeason || selectedSeason === "all" ? undefined : selectedSeason;
      const [nextDashboard, nextBatches, nextPlannerIdentitySummaries] = await Promise.all([
        getPlannerFairnessDashboard(normalizedSeason),
        listFriendlyPlannerBatches(normalizedSeason),
        getPlannerPlayerSummaries(normalizedSeason)
      ]);

      setDashboard(nextDashboard);
      setSavedBatches(nextBatches);
      setPlannerIdentitySummaries(nextPlannerIdentitySummaries);
      setSelectedBatchId((currentBatchId) => {
        if (currentBatchId && nextBatches.some((batch) => batch.id === currentBatchId)) {
          return currentBatchId;
        }

        return nextBatches[0]?.id ?? "";
      });
    } catch (error) {
      setDashboard(null);
      setSavedBatches([]);
      setPlannerIdentitySummaries([]);
      setDashboardError(error instanceof Error ? error.message : "Could not load the fairness workspace.");
    } finally {
      setIsLoadingDashboard(false);
      setIsLoadingBatches(false);
    }
  }, [hasAccess, hasResolvedSeason, selectedSeason]);

  useEffect(() => {
    void loadFairnessWorkspace();
  }, [loadFairnessWorkspace]);

  useEffect(() => {
    let isActive = true;

    const loadRecentComparisonInsights = async () => {
      if (!hasAccess || savedBatches.length === 0) {
        setRecentComparisonBatchDetails([]);
        return;
      }

      setIsLoadingComparisonInsights(true);

      try {
        const recentBatches = savedBatches.slice(0, 4);
        const nextDetails = await Promise.all(
          recentBatches.map((batch) => getFriendlyPlannerBatchDetail(batch.id))
        );

        if (!isActive) {
          return;
        }

        setRecentComparisonBatchDetails(nextDetails);
      } catch {
        if (!isActive) {
          return;
        }

        setRecentComparisonBatchDetails([]);
      } finally {
        if (isActive) {
          setIsLoadingComparisonInsights(false);
        }
      }
    };

    void loadRecentComparisonInsights();

    return () => {
      isActive = false;
    };
  }, [hasAccess, savedBatches]);

  useEffect(() => {
    let isActive = true;

    const loadSelectedBatchDetail = async () => {
      if (!selectedBatchId || !hasAccess) {
        setSelectedBatchDetail(null);
        setBatchNotesDraft("");
        return;
      }

      setIsLoadingBatchDetail(true);

      try {
        const nextDetail = await getFriendlyPlannerBatchDetail(selectedBatchId);

        if (!isActive) {
          return;
        }

        setSelectedBatchDetail(nextDetail);
        setBatchNotesDraft(nextDetail.notes.join("\n"));
      } catch (error) {
        if (!isActive) {
          return;
        }

        setSelectedBatchDetail(null);
        setBatchNotesDraft("");
        setErrorMessage(error instanceof Error ? error.message : "Could not load the selected saved matchday plan.");
      } finally {
        if (isActive) {
          setIsLoadingBatchDetail(false);
        }
      }
    };

    void loadSelectedBatchDetail();

    return () => {
      isActive = false;
    };
  }, [hasAccess, selectedBatchId]);

  const fairnessProgressPlayers = useMemo(() => {
    return dashboard?.playerSummaries.filter((player) => player.xiCount < 5) ?? [];
  }, [dashboard]);

  const fairnessUnderusePlayers = useMemo(() => {
    return dashboard?.playerSummaries.filter((player) => player.underuseRisk) ?? [];
  }, [dashboard]);

  const fairnessAlerts = useMemo(() => {
    return dashboard?.alerts ?? [];
  }, [dashboard]);

  const groupedFairnessAlerts = useMemo(() => {
    const grouped = new Map<string, { playerId: string; playerName: string; severity: "info" | "warning"; alerts: PlannerFairnessAlert[] }>();

    fairnessAlerts.forEach((alert) => {
      const currentGroup = grouped.get(alert.playerId);

      if (!currentGroup) {
        grouped.set(alert.playerId, {
          playerId: alert.playerId,
          playerName: alert.playerName,
          severity: alert.severity,
          alerts: [alert]
        });
        return;
      }

      currentGroup.alerts.push(alert);
      if (alert.severity === "warning") {
        currentGroup.severity = "warning";
      }
    });

    return Array.from(grouped.values()).sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "warning" ? -1 : 1;
      }

      return formatName(left.playerName).localeCompare(formatName(right.playerName));
    });
  }, [fairnessAlerts]);

  const weeklyFairnessStatusPages = useMemo(() => {
    return recentComparisonInsights
      .map((week) => {
        const weeklyAlertGroups = groupedFairnessAlerts
          .map((group) => {
            const weeklyAlerts = group.alerts.filter((alert) => alert.batchId === week.batchId);

            if (weeklyAlerts.length === 0) {
              return null;
            }

            return {
              ...group,
              alerts: weeklyAlerts
            };
          })
          .filter((group): group is { playerId: string; playerName: string; severity: "info" | "warning"; alerts: PlannerFairnessAlert[] } => Boolean(group));

        if (week.entries.length === 0 && weeklyAlertGroups.length === 0) {
          return null;
        }

        return {
          batchId: week.batchId,
          weekendLabel: week.weekendLabel,
          weekendDate: week.weekendDate,
          entries: week.entries,
          alertGroups: weeklyAlertGroups
        };
      })
      .filter((week): week is {
        batchId: string;
        weekendLabel: string;
        weekendDate: string | null;
        entries: Array<{ id: string; matchNumber: number; insights: string[] }>;
        alertGroups: Array<{ playerId: string; playerName: string; severity: "info" | "warning"; alerts: PlannerFairnessAlert[] }>;
      } => Boolean(week));
  }, [groupedFairnessAlerts, recentComparisonInsights]);

  const weeklyInsightPageCount = Math.max(1, weeklyFairnessStatusPages.length);
  const selectedWeeklyFairnessStatus = weeklyFairnessStatusPages[weeklyInsightPage - 1] ?? null;

  const selectedAlertPlayerGroup = useMemo(() => {
    const currentWeeklyAlertGroups = selectedWeeklyFairnessStatus?.alertGroups ?? [];

    if (currentWeeklyAlertGroups.length === 0) {
      return null;
    }

    return currentWeeklyAlertGroups.find((group) => group.playerId === selectedAlertPlayerId)
      ?? currentWeeklyAlertGroups[0]
      ?? null;
  }, [selectedAlertPlayerId, selectedWeeklyFairnessStatus]);

  const recurringWeeklyAlertPlayers = useMemo(() => {
    return groupedFairnessAlerts
      .map((group) => {
        const weeklyBatchIds = Array.from(
          new Set(group.alerts.flatMap((alert) => (alert.batchId ? [alert.batchId] : [])))
        );

        if (weeklyBatchIds.length < 2) {
          return null;
        }

        return {
          playerId: group.playerId,
          playerName: group.playerName,
          severity: group.severity,
          weekCount: weeklyBatchIds.length
        };
      })
      .filter((group): group is {
        playerId: string;
        playerName: string;
        severity: "info" | "warning";
        weekCount: number;
      } => Boolean(group))
      .sort((left, right) => {
        if (left.weekCount !== right.weekCount) {
          return right.weekCount - left.weekCount;
        }

        if (left.severity !== right.severity) {
          return left.severity === "warning" ? -1 : 1;
        }

        return formatName(left.playerName).localeCompare(formatName(right.playerName));
      });
  }, [groupedFairnessAlerts]);

  const selectedBiasWatchGroup = useMemo(() => {
    if (recurringWeeklyAlertPlayers.length === 0) {
      return null;
    }

    const selectedPlayer = recurringWeeklyAlertPlayers.find((player) => player.playerId === selectedBiasWatchPlayerId)
      ?? recurringWeeklyAlertPlayers[0]
      ?? null;

    if (!selectedPlayer) {
      return null;
    }

    const groupedPlayerAlerts = groupedFairnessAlerts.find((group) => group.playerId === selectedPlayer.playerId);

    if (!groupedPlayerAlerts) {
      return null;
    }

    const weeklyAlerts = groupedPlayerAlerts.alerts
      .filter((alert) => alert.batchId)
      .sort((left, right) => (right.weekendDate ?? "").localeCompare(left.weekendDate ?? ""));

    return {
      ...selectedPlayer,
      alerts: weeklyAlerts
    };
  }, [groupedFairnessAlerts, recurringWeeklyAlertPlayers, selectedBiasWatchPlayerId]);

  const fairnessNoXiPlayers = useMemo(() => {
    return fairnessProgressPlayers.filter((player) => player.xiCount === 0);
  }, [fairnessProgressPlayers]);

  const fairnessUrgentPlayers = useMemo(() => {
    return fairnessProgressPlayers.filter(
      (player) => player.availableMatchdays >= 1 && player.quotaRemaining >= 4
    );
  }, [fairnessProgressPlayers]);

  const fairnessTrackerPageCount = Math.max(
    1,
    Math.ceil((dashboard?.playerSummaries.length ?? 0) / FAIRNESS_TRACKER_PAGE_SIZE)
  );
  const paginatedFairnessPlayers = useMemo(() => {
    const players = dashboard?.playerSummaries ?? [];
    const startIndex = (fairnessTrackerPage - 1) * FAIRNESS_TRACKER_PAGE_SIZE;
    return players.slice(startIndex, startIndex + FAIRNESS_TRACKER_PAGE_SIZE);
  }, [dashboard?.playerSummaries, fairnessTrackerPage]);
  const memberIdByPlayerId = useMemo(() => {
    return new Map(
      (dashboard?.playerSummaries ?? []).map((player) => [player.playerId, player.memberId] as const)
    );
  }, [dashboard?.playerSummaries]);
  const selectedAlertMemberId = selectedAlertPlayerGroup
    ? (memberIdByPlayerId.get(selectedAlertPlayerGroup.playerId) ?? "")
    : "";
  const selectedBiasWatchMemberId = selectedBiasWatchGroup
    ? (memberIdByPlayerId.get(selectedBiasWatchGroup.playerId) ?? "")
    : "";
  const savedBatchesPageCount = Math.max(1, Math.ceil(savedBatches.length / SAVED_BATCHES_PAGE_SIZE));
  const paginatedSavedBatches = useMemo(() => {
    const startIndex = (savedBatchesPage - 1) * SAVED_BATCHES_PAGE_SIZE;
    return savedBatches.slice(startIndex, startIndex + SAVED_BATCHES_PAGE_SIZE);
  }, [savedBatches, savedBatchesPage]);

  useEffect(() => {
    setFairnessTrackerPage((currentPage) => Math.min(currentPage, fairnessTrackerPageCount));
  }, [fairnessTrackerPageCount]);

  useEffect(() => {
    setSavedBatchesPage((currentPage) => Math.min(currentPage, savedBatchesPageCount));
  }, [savedBatchesPageCount]);

  useEffect(() => {
    setWeeklyInsightPage((currentPage) => Math.min(currentPage, weeklyInsightPageCount));
  }, [weeklyInsightPageCount]);

  useEffect(() => {
    setFairnessTrackerPage(1);
    setSavedBatchesPage(1);
    setWeeklyInsightPage(1);
  }, [selectedSeason]);

  useEffect(() => {
    if (recurringWeeklyAlertPlayers.length === 0) {
      setSelectedBiasWatchPlayerId("");
      return;
    }

    setSelectedBiasWatchPlayerId((currentPlayerId) =>
      recurringWeeklyAlertPlayers.some((player) => player.playerId === currentPlayerId)
        ? currentPlayerId
        : recurringWeeklyAlertPlayers[0]?.playerId ?? ""
    );
  }, [recurringWeeklyAlertPlayers]);

  useEffect(() => {
    const currentWeeklyAlertGroups = selectedWeeklyFairnessStatus?.alertGroups ?? [];

    if (currentWeeklyAlertGroups.length === 0) {
      setSelectedAlertPlayerId("");
      return;
    }

    setSelectedAlertPlayerId((currentPlayerId) =>
      currentWeeklyAlertGroups.some((group) => group.playerId === currentPlayerId)
        ? currentPlayerId
        : currentWeeklyAlertGroups[0]?.playerId ?? ""
    );
  }, [selectedWeeklyFairnessStatus]);

  const handleBatchNotesSave = async () => {
    if (!selectedBatchDetail) {
      return;
    }

    setIsSavingBatchNotes(true);
    setErrorMessage(null);

    try {
      await updateFriendlyPlannerBatchNotes(
        selectedBatchDetail.id,
        batchNotesDraft.split("\n")
      );
      setSuccessMessage(`Updated saved notes for ${selectedBatchDetail.weekendLabel}.`);
      await loadFairnessWorkspace();
      const refreshedDetail = await getFriendlyPlannerBatchDetail(selectedBatchDetail.id);
      setSelectedBatchDetail(refreshedDetail);
      setBatchNotesDraft(refreshedDetail.notes.join("\n"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update saved planner notes.");
    } finally {
      setIsSavingBatchNotes(false);
    }
  };

  const handleBatchDelete = async (batch: PlannerBatchListItem) => {
    const confirmed = window.confirm(
      `Delete the saved matchday plan for ${batch.weekendLabel}? This will remove its fairness history records too.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingBatchId(batch.id);
    setErrorMessage(null);

    try {
      await deleteFriendlyPlannerBatch(batch.id);
      setSuccessMessage(`Deleted the saved matchday plan for ${batch.weekendLabel}.`);
      if (selectedBatchId === batch.id) {
        setSelectedBatchId("");
        setSelectedBatchDetail(null);
        setBatchNotesDraft("");
      }
      await loadFairnessWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not delete the saved matchday plan.");
    } finally {
      setDeletingBatchId(null);
    }
  };

  const handleActualMatchLinkSave = async (matchNumber: number, matchId: string) => {
    if (!selectedBatchDetail) {
      return;
    }

    const linkKey = `${selectedBatchDetail.id}:${matchNumber}`;
    setSavingActualMatchKey(linkKey);
    setErrorMessage(null);

    try {
      await updateFriendlyPlannerBatchActualMatchLink(
        selectedBatchDetail.id,
        matchNumber,
        matchId || null
      );

      const refreshedDetail = await getFriendlyPlannerBatchDetail(selectedBatchDetail.id);
      setSelectedBatchDetail(refreshedDetail);
      await loadFairnessWorkspace();
      setSuccessMessage(
        matchId
          ? `Linked Match ${matchNumber} to its actual scorecard.`
          : `Removed the actual scorecard link for Match ${matchNumber}.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update the actual scorecard link.");
    } finally {
      setSavingActualMatchKey(null);
    }
  };

  const handleAutoLinkSuggestedMatches = async () => {
    if (!selectedBatchDetail) {
      return;
    }

    const matchesToLink = selectedBatchDetail.matches.filter(
      (match) => !match.linkedActualMatchId && match.suggestedActualMatchId
    );

    if (matchesToLink.length === 0) {
      return;
    }

    setIsAutoLinkingSuggestedMatches(true);
    setErrorMessage(null);

    try {
      for (const match of matchesToLink) {
        await updateFriendlyPlannerBatchActualMatchLink(
          selectedBatchDetail.id,
          match.matchNumber,
          match.suggestedActualMatchId
        );
      }

      const refreshedDetail = await getFriendlyPlannerBatchDetail(selectedBatchDetail.id);
      setSelectedBatchDetail(refreshedDetail);
      await loadFairnessWorkspace();
      setSuccessMessage(`Auto-linked ${matchesToLink.length} suggested scorecard${matchesToLink.length > 1 ? "s" : ""}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not auto-link the suggested scorecards.");
    } finally {
      setIsAutoLinkingSuggestedMatches(false);
    }
  };

  if (hasAccess === null || !hasResolvedSeason) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!hasAccess) {
    return <MemberFairnessView mode="self" />;
  }

  return (
    <Container maxWidth="xl">
      <Stack spacing={4}>
        <TeamPageHeader
          eyebrow="Leadership Workspace"
          title="Fairness"
          description="Track authentic planner fairness across saved matchdays, review recent player opportunity history, and manage saved planner records in one place."
          action={(
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              <ToggleButtonGroup
                exclusive
                value="team"
                onChange={(_event, nextValue) => {
                  if (nextValue === "mine") {
                    router.push("/my-fairness");
                  }
                }}
              >
                <ToggleButton value="team">Team View</ToggleButton>
                <ToggleButton value="mine">My View</ToggleButton>
              </ToggleButtonGroup>

              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="fairness-season-label">Season</InputLabel>
                <Select
                  labelId="fairness-season-label"
                  value={selectedSeason || "all"}
                  label="Season"
                  onChange={(event) => setSelectedSeason(event.target.value)}
                >
                  <MenuItem value="all">All Seasons</MenuItem>
                  {seasons.map((season) => (
                    <MenuItem key={season.value} value={season.value}>
                      {season.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        />

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        {successMessage && (
          <AutoHideAlert severity="success" resetKey={successMessage}>
            {successMessage}
          </AutoHideAlert>
        )}

        {dashboardError && (
          <Alert severity="info" variant="outlined">
            {dashboardError}
          </Alert>
        )}

        {isLoadingDashboard ? (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Loading fairness workspace...
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ) : dashboard ? (
          <Stack spacing={3}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={3}>
                  <Stack spacing={0.75}>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      Weekly Fairness Status
                    </Typography>
                    {selectedWeeklyFairnessStatus ? (
                      <Typography variant="body2" color="text.secondary">
                        {selectedWeeklyFairnessStatus.weekendLabel}
                      </Typography>
                    ) : null}
                  </Stack>

                  {isLoadingComparisonInsights ? (
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">
                        Loading recent planned-vs-actual comparison insights...
                      </Typography>
                    </Stack>
                  ) : weeklyFairnessStatusPages.length === 0 ? (
                    <EmptyStateMessage>
                      No planned-vs-actual weekly fairness insights yet from the recent saved matchdays.
                    </EmptyStateMessage>
                  ) : (
                    <>
                      <Grid container spacing={3}>
                        <Grid size={{ xs: 12, lg: 6 }}>
                          <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                            <CardContent sx={{ p: 3 }}>
                              <Stack spacing={2}>
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                  Comparison Insights
                                </Typography>
                                {selectedWeeklyFairnessStatus && selectedWeeklyFairnessStatus.entries.length > 0 ? (
                                  <Stack spacing={1.5}>
                                    {selectedWeeklyFairnessStatus.entries.map((matchEntry) => (
                                      <Box key={matchEntry.id}>
                                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                          Match {matchEntry.matchNumber}
                                        </Typography>
                                        <Box component="ul" sx={{ m: 0, pl: 2.5, listStyle: "none" }}>
                                          {matchEntry.insights.map((insight, index) => (
                                            <Typography
                                              key={`${matchEntry.id}-insight-${index}`}
                                              component="li"
                                              variant="body2"
                                              sx={{ mb: 0.5 }}
                                            >
                                              - {insight}
                                            </Typography>
                                          ))}
                                        </Box>
                                      </Box>
                                    ))}
                                  </Stack>
                                ) : (
                                  <EmptyStateMessage>
                                    No comparison insights were recorded for this saved week.
                                  </EmptyStateMessage>
                                )}
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>

                        <Grid size={{ xs: 12, lg: 6 }}>
                          <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                            <CardContent sx={{ p: 3 }}>
                              <Stack spacing={2}>
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                  Fairness Alerts
                                </Typography>
                                {selectedWeeklyFairnessStatus && selectedWeeklyFairnessStatus.alertGroups.length > 0 ? (
                                  <Stack spacing={2}>
                                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                      {selectedWeeklyFairnessStatus.alertGroups.map((group) => (
                                        <Chip
                                          key={`fairness-alert-player-${selectedWeeklyFairnessStatus.batchId}-${group.playerId}`}
                                          label={formatName(group.playerName)}
                                          clickable
                                          color={group.severity === "warning" ? "warning" : "info"}
                                          variant={selectedAlertPlayerGroup?.playerId === group.playerId ? "filled" : "outlined"}
                                          onClick={() => setSelectedAlertPlayerId(group.playerId)}
                                        />
                                      ))}
                                    </Stack>
                                    {selectedAlertPlayerGroup ? (
                                      <Stack spacing={1}>
                                        <Stack
                                          direction={{ xs: "column", sm: "row" }}
                                          spacing={1}
                                          justifyContent="space-between"
                                          alignItems={{ xs: "flex-start", sm: "center" }}
                                        >
                                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                            {formatName(selectedAlertPlayerGroup.playerName)}
                                          </Typography>
                                          <Button
                                            component={Link}
                                            href={selectedAlertMemberId ? `/fairness/member/${selectedAlertMemberId}` : "/fairness"}
                                            variant="outlined"
                                            size="small"
                                            disabled={!selectedAlertMemberId}
                                          >
                                            Open Member Detail
                                          </Button>
                                        </Stack>
                                        <Box component="ul" sx={{ m: 0, pl: 2.5, listStyle: "none" }}>
                                          {selectedAlertPlayerGroup.alerts.map((alert) => (
                                            <Typography
                                              key={alert.id}
                                              component="li"
                                              variant="body2"
                                              sx={{ mb: 0.75 }}
                                            >
                                              - {stripLeadingPlayerNameFromAlert(alert)}
                                            </Typography>
                                          ))}
                                        </Box>
                                      </Stack>
                                    ) : null}
                                  </Stack>
                                ) : (
                                  <EmptyStateMessage>
                                    No fairness alerts were triggered for this saved week.
                                  </EmptyStateMessage>
                                )}
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>

                      {weeklyInsightPageCount > 1 ? (
                        <PaginationFooter
                          pageStart={weeklyInsightPage}
                          pageEnd={weeklyInsightPage}
                          totalCount={weeklyInsightPageCount}
                          hasPreviousPage={weeklyInsightPage > 1}
                          hasNextPage={weeklyInsightPage < weeklyInsightPageCount}
                          onPrevious={() => setWeeklyInsightPage((currentPage) => Math.max(1, currentPage - 1))}
                          onNext={() => setWeeklyInsightPage((currentPage) => Math.min(weeklyInsightPageCount, currentPage + 1))}
                        />
                      ) : null}
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <MetricCard
                  label="Saved Matchdays"
                  value={dashboard.savedMatchdays}
                  helper="Friendly planner batches already saved for fairness tracking."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <MetricCard
                  label="Below 5 XI"
                  value={dashboard.playersBelowQuota}
                  helper="Tracked players still building toward the 5-XI opportunity baseline."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <MetricCard
                  label="Quota Complete"
                  value={dashboard.playersAtOrAboveQuota}
                  helper="Players who already reached at least 5 saved XI selections."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <MetricCard
                  label="Underuse Watch"
                  value={dashboard.underuseRiskCount}
                  helper="Players with 5+ XI selections who are now missing XI chances across recent available matchdays."
                />
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        Saved Matchday Detail
                      </Typography>
                      {isLoadingBatchDetail ? (
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <CircularProgress size={20} />
                          <Typography variant="body2" color="text.secondary">
                            Loading saved matchday detail...
                          </Typography>
                        </Stack>
                      ) : selectedBatchDetail ? (
                        <Stack spacing={2}>
                          {selectedBatchDetail.matches.some(
                            (match) => !match.linkedActualMatchId && match.suggestedActualMatchId
                          ) ? (
                            <Stack direction="row" justifyContent="flex-end">
                              <Button
                                variant="outlined"
                                size="small"
                                disabled={isAutoLinkingSuggestedMatches}
                                startIcon={isAutoLinkingSuggestedMatches ? <CircularProgress size={16} color="inherit" /> : null}
                                onClick={() => void handleAutoLinkSuggestedMatches()}
                              >
                                Auto-Link Suggested Scorecards
                              </Button>
                            </Stack>
                          ) : null}
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            <Chip label={selectedBatchDetail.weekendLabel} color="primary" variant="outlined" />
                            <Chip label={`Saved ${formatTimestamp(selectedBatchDetail.createdAt)}`} variant="outlined" />
                            {selectedBatchDetail.weekendDate ? (
                              <Chip label={selectedBatchDetail.weekendDate} variant="outlined" />
                            ) : null}
                          </Stack>

                          <Grid container spacing={2}>
                            {selectedBatchDetail.matches.map((match) => {
                              const linkedActualMatchIdsForOtherMatches = new Set(
                                selectedBatchDetail.matches
                                  .filter((candidateMatch) =>
                                    candidateMatch.matchNumber !== match.matchNumber
                                    && Boolean(candidateMatch.linkedActualMatchId)
                                  )
                                  .map((candidateMatch) => candidateMatch.linkedActualMatchId as string)
                              );
                              const availableActualMatchCandidates = selectedBatchDetail.actualMatchCandidates.filter(
                                (candidate) =>
                                  candidate.id === match.linkedActualMatchId
                                  || !linkedActualMatchIdsForOtherMatches.has(candidate.id)
                              );

                              return (
                              <Grid key={`saved-match-${match.matchNumber}`} size={{ xs: 12, md: 4 }}>
                                <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                                  <CardContent sx={{ p: 2 }}>
                                    <Stack spacing={1.25}>
                                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                        Match {match.matchNumber}
                                      </Typography>
                                      <FormControl size="small" fullWidth>
                                        <InputLabel id={`actual-match-link-${match.matchNumber}`}>Actual Scorecard</InputLabel>
                                        <Select
                                          labelId={`actual-match-link-${match.matchNumber}`}
                                          label="Actual Scorecard"
                                          value={match.linkedActualMatchId ?? ""}
                                          disabled={savingActualMatchKey === `${selectedBatchDetail.id}:${match.matchNumber}`}
                                          onChange={(event) =>
                                            void handleActualMatchLinkSave(match.matchNumber, event.target.value)
                                          }
                                        >
                                          <MenuItem value="">Not Linked</MenuItem>
                                          {availableActualMatchCandidates.map((candidate) => (
                                            <MenuItem key={`${match.matchNumber}-${candidate.id}`} value={candidate.id}>
                                              {candidate.label}
                                            </MenuItem>
                                          ))}
                                        </Select>
                                      </FormControl>
                                      {match.linkedActualMatchLabel ? (
                                        <Typography variant="caption" color="text.secondary">
                                          Linked to {match.linkedActualMatchLabel}
                                        </Typography>
                                      ) : match.suggestedActualMatchLabel ? (
                                        <Stack spacing={0.75}>
                                          <Typography variant="caption" color="text.secondary">
                                            Suggested: {match.suggestedActualMatchLabel}
                                          </Typography>
                                          <Stack direction="row" spacing={1}>
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              disabled={savingActualMatchKey === `${selectedBatchDetail.id}:${match.matchNumber}`}
                                              onClick={() =>
                                                void handleActualMatchLinkSave(match.matchNumber, match.suggestedActualMatchId ?? "")
                                              }
                                            >
                                              Use Suggested
                                            </Button>
                                          </Stack>
                                        </Stack>
                                      ) : (
                                        <Typography variant="caption" color="text.secondary">
                                          Link the real scorecard for this match to move fairness from planned to actual participation.
                                        </Typography>
                                      )}
                                      <Grid container spacing={2}>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                          <Stack spacing={1.25}>
                                            <Chip
                                              label="Matchday Fairness Planner"
                                              size="small"
                                              variant="filled"
                                              sx={{ alignSelf: "flex-start" }}
                                            />
                                            <StaticNameList names={match.xiPlayers} />
                                            <Chip
                                              label="12th / Bench"
                                              size="small"
                                              variant="filled"
                                              sx={{ alignSelf: "flex-start" }}
                                            />
                                            <StaticNameList
                                              names={[
                                                ...(match.twelfthPlayer ? [`${formatName(match.twelfthPlayer)} - 12th`] : []),
                                                ...match.benchPlayers
                                              ]}
                                            />
                                            {match.unavailablePlayers.length > 0 ? (
                                              <>
                                                <Chip
                                                  label="Unavailable"
                                                  size="small"
                                                  variant="filled"
                                                  sx={{ alignSelf: "flex-start" }}
                                                />
                                                <StaticNameList names={match.unavailablePlayers} />
                                              </>
                                            ) : null}
                                          </Stack>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                          <Stack spacing={1.25}>
                                            <Chip
                                              label="Actual Result"
                                              size="small"
                                              variant="filled"
                                              sx={{ alignSelf: "flex-start" }}
                                            />
                                            {match.linkedActualMatchId ? (
                                              <Stack spacing={1}>
                                                {match.actualListedPlayers.length > 0 ? (
                                                  <StaticNameList names={match.actualListedPlayers} />
                                                ) : (
                                                  <Typography variant="caption" color="text.secondary">
                                                    No actual player involvement was matched from the linked scorecard yet.
                                                  </Typography>
                                                )}
                                              </Stack>
                                            ) : (
                                              <Typography variant="body2" color="text.secondary">
                                                Link the actual scorecard to compare the planned fairness lineup with what really happened.
                                              </Typography>
                                            )}
                                          </Stack>
                                        </Grid>
                                      </Grid>
                                      {match.linkedActualMatchId && (
                                        <Grid container spacing={2}>
                                          <Grid size={{ xs: 12, md: 6 }}>
                                            <Stack spacing={1.25}>
                                              <Chip
                                                label="Batted"
                                                size="small"
                                                variant="filled"
                                                sx={{ alignSelf: "flex-start" }}
                                              />
                                              {match.actualBattedPlayers.length > 0 ? (
                                                <StaticNameList names={match.actualBattedPlayers} />
                                              ) : (
                                                <Typography variant="caption" color="text.secondary">
                                                  No batting involvement was matched from the linked scorecard yet.
                                                </Typography>
                                              )}
                                            </Stack>
                                          </Grid>
                                          <Grid size={{ xs: 12, md: 6 }}>
                                            <Stack spacing={1.25}>
                                              <Chip
                                                label="Bowled"
                                                size="small"
                                                variant="filled"
                                                sx={{ alignSelf: "flex-start" }}
                                              />
                                              {match.actualBowledPlayers.length > 0 ? (
                                                <StaticNameList names={match.actualBowledPlayers} />
                                              ) : (
                                                <Typography variant="caption" color="text.secondary">
                                                  No bowling involvement was matched from the linked scorecard yet.
                                                </Typography>
                                              )}
                                            </Stack>
                                          </Grid>
                                        </Grid>
                                      )}
                                    </Stack>
                                  </CardContent>
                                </Card>
                              </Grid>
                              );
                            })}
                          </Grid>

                          <TextField
                            label="Saved Matchday Notes"
                            placeholder="Add planner observations, captain notes, or matchday context..."
                            multiline
                            minRows={4}
                            value={batchNotesDraft}
                            onChange={(event) => setBatchNotesDraft(event.target.value)}
                          />

                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="contained"
                              startIcon={isSavingBatchNotes ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />}
                              disabled={isSavingBatchNotes}
                              onClick={() => void handleBatchNotesSave()}
                            >
                              Save Notes
                            </Button>
                          </Stack>
                        </Stack>
                      ) : (
                        <EmptyStateMessage>
                          Choose a saved matchday plan to inspect its saved XI, bench, unavailable assignments, and notes.
                        </EmptyStateMessage>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        Fairness Tracker
                      </Typography>
                      {dashboard.savedMatchdays === 0 ? (
                        <EmptyStateMessage>
                          Save a friendly matchday plan first. This dashboard starts tracking XI, 12th, and bench history only after the saved planner batches begin.
                        </EmptyStateMessage>
                      ) : (
                        <>
                          <Stack
                            divider={<Divider flexItem />}
                            sx={{
                              maxHeight: 520,
                              overflowY: "auto",
                              pr: 0.5
                            }}
                          >
                            {paginatedFairnessPlayers.map((player) => (
                              <Stack
                                key={`fairness-player-${player.playerId}`}
                                spacing={1.25}
                              sx={{ py: 0.25 }}
                            >
                              <Stack
                                direction={{ xs: "column", md: "row" }}
                                spacing={1}
                                justifyContent="space-between"
                                alignItems={{ xs: "flex-start", md: "center" }}
                              >
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                  {buildFairnessRoleLabel(player)}
                                </Typography>
                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                  <Chip
                                    label={player.xiCount >= 5 ? "Quota Complete" : `${player.quotaRemaining} XI to go`}
                                    size="small"
                                    color={player.xiCount >= 5 ? "success" : player.xiCount === 0 ? "warning" : "default"}
                                    variant={player.xiCount >= 5 ? "filled" : "outlined"}
                                  />
                                  {player.underuseRisk ? (
                                    <Chip
                                      label={`Underuse watch: ${player.consecutiveAvailableNoXiBatches} saved matchdays`}
                                      size="small"
                                      color="warning"
                                      variant="outlined"
                                    />
                                  ) : null}
                                  <Button
                                    component={Link}
                                    href={`/fairness/member/${player.memberId}`}
                                    variant="outlined"
                                    size="small"
                                  >
                                    Open Detail
                                  </Button>
                                </Stack>
                              </Stack>
                              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                <Chip label={`XI ${player.xiCount}/5`} size="small" color="primary" variant="outlined" />
                                <Chip label={`12th ${player.twelfthCount}`} size="small" variant="outlined" />
                                <Chip label={`Bench ${player.benchCount}`} size="small" variant="outlined" />
                                <Chip label={`Available ${player.availableMatchdays}`} size="small" variant="outlined" />
                                <Chip label={`Unavailable ${player.unavailableCount}`} size="small" variant="outlined" />
                              </Stack>
                              {player.recentHistory.length > 0 ? (
                                <Stack spacing={0.75}>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                    Recent Saved Matchdays
                                  </Typography>
                                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                    {player.recentHistory.map((entry) => (
                                      <Chip
                                        key={`${player.playerId}-${entry.batchId}`}
                                        label={buildFairnessHistoryLabel(entry)}
                                        size="small"
                                        variant="outlined"
                                      />
                                    ))}
                                  </Stack>
                                </Stack>
                              ) : null}
                              </Stack>
                            ))}
                          </Stack>
                          {fairnessTrackerPageCount > 1 ? (
                            <PaginationFooter
                              pageStart={(fairnessTrackerPage - 1) * FAIRNESS_TRACKER_PAGE_SIZE + 1}
                              pageEnd={Math.min(fairnessTrackerPage * FAIRNESS_TRACKER_PAGE_SIZE, dashboard.playerSummaries.length)}
                              totalCount={dashboard.playerSummaries.length}
                              hasPreviousPage={fairnessTrackerPage > 1}
                              hasNextPage={fairnessTrackerPage < fairnessTrackerPageCount}
                              onPrevious={() => setFairnessTrackerPage((currentPage) => Math.max(1, currentPage - 1))}
                              onNext={() => setFairnessTrackerPage((currentPage) => Math.min(fairnessTrackerPageCount, currentPage + 1))}
                            />
                          ) : null}
                        </>
                      )}
                      </Stack>
                    </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, lg: 5 }}>
                <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        Bias Watch
                      </Typography>
                      <Stack spacing={1.5}>
                        {recurringWeeklyAlertPlayers.length > 0 ? (
                          <>
                            <Alert severity="warning" variant="outlined">
                              {recurringWeeklyAlertPlayers.length} player{recurringWeeklyAlertPlayers.length > 1 ? "s have" : " has"} triggered fairness alerts across multiple saved weeks.
                            </Alert>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                Repeated Weekly Alerts
                              </Typography>
                              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                {recurringWeeklyAlertPlayers.map((player) => (
                                  <Chip
                                    key={`recurring-alert-${player.playerId}`}
                                    label={`${formatName(player.playerName)} - ${player.weekCount} weeks`}
                                    color={player.severity === "warning" ? "warning" : "info"}
                                    variant={selectedBiasWatchGroup?.playerId === player.playerId ? "filled" : "outlined"}
                                    clickable
                                    onClick={() => setSelectedBiasWatchPlayerId(player.playerId)}
                                  />
                                ))}
                              </Stack>
                            </Box>
                          </>
                        ) : null}

                        {fairnessUnderusePlayers.length > 0 ? (
                          <Alert severity="warning" variant="outlined">
                            {fairnessUnderusePlayers.length} player{fairnessUnderusePlayers.length > 1 ? "s are" : " is"} currently on underuse watch after crossing the 5-XI baseline.
                          </Alert>
                        ) : recurringWeeklyAlertPlayers.length === 0 ? (
                          <EmptyStateMessage>
                            Bias Watch appears when a player either repeats fairness alerts across saved weeks or hits the post-baseline underuse rule.
                          </EmptyStateMessage>
                        ) : null}

                        {fairnessUrgentPlayers.length > 0 ? (
                          <Alert severity="info" variant="outlined">
                            {fairnessUrgentPlayers.length} player{fairnessUrgentPlayers.length > 1 ? "s still need" : " still needs"} strong rotation support to build toward the first 5 XI opportunities.
                          </Alert>
                        ) : null}

                        {selectedBiasWatchGroup ? (
                          <Box
                            sx={{
                              p: 2,
                              borderRadius: 3,
                              border: "1px solid",
                              borderColor: "divider",
                              backgroundColor: "action.hover"
                            }}
                          >
                            <Stack spacing={1.5}>
                              <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                justifyContent="space-between"
                                alignItems={{ xs: "flex-start", sm: "center" }}
                              >
                                <Stack spacing={0.5}>
                                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                    {formatName(selectedBiasWatchGroup.playerName)}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Repeated fairness alerts across {selectedBiasWatchGroup.weekCount} saved weeks
                                  </Typography>
                                </Stack>
                                <Button
                                  component={Link}
                                  href={selectedBiasWatchMemberId ? `/fairness/member/${selectedBiasWatchMemberId}` : "/fairness"}
                                  variant="outlined"
                                  size="small"
                                  disabled={!selectedBiasWatchMemberId}
                                >
                                  Open Member Detail
                                </Button>
                              </Stack>
                              <Stack spacing={1}>
                                {selectedBiasWatchGroup.alerts.map((alert) => (
                                  <Box key={alert.id}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                      {alert.weekendLabel ?? "Saved week"}
                                      {alert.matchNumber ? ` • Match ${alert.matchNumber}` : ""}
                                    </Typography>
                                    <Typography variant="body2" sx={{ mt: 0.25 }}>
                                      {formatBiasWatchAlertMessage(alert)}
                                    </Typography>
                                  </Box>
                                ))}
                              </Stack>
                            </Stack>
                          </Box>
                        ) : null}

                        {fairnessNoXiPlayers.length > 0 ? (
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                              No XI Yet
                            </Typography>
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                              {fairnessNoXiPlayers.map((player) => (
                                <Chip
                                  key={`no-xi-player-${player.playerId}`}
                                  label={`${formatName(player.name)} - Available ${player.availableMatchdays}`}
                                  color="warning"
                                  variant="outlined"
                                />
                              ))}
                            </Stack>
                          </Box>
                        ) : null}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, lg: 7 }}>
                <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        Saved Matchday Plans
                      </Typography>
                      {isLoadingBatches ? (
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <CircularProgress size={20} />
                          <Typography variant="body2" color="text.secondary">
                            Loading saved planner batches...
                          </Typography>
                        </Stack>
                      ) : savedBatches.length === 0 ? (
                        <EmptyStateMessage>
                          No saved matchday plans yet for this season.
                        </EmptyStateMessage>
                      ) : (
                        <Stack spacing={1.25}>
                          {paginatedSavedBatches.map((batch) => (
                            <Card
                              key={batch.id}
                              variant="outlined"
                              sx={{
                                borderRadius: 3,
                                borderColor: selectedBatchId === batch.id ? "primary.main" : "divider",
                                backgroundColor: selectedBatchId === batch.id ? "action.hover" : "background.paper"
                              }}
                            >
                              <CardContent sx={{ p: 2 }}>
                                <Stack spacing={1.25}>
                                  <Stack
                                    direction={{ xs: "column", sm: "row" }}
                                    spacing={1}
                                    justifyContent="space-between"
                                    alignItems={{ xs: "flex-start", sm: "center" }}
                                  >
                                    <Box>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        {batch.weekendLabel}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        Saved {formatTimestamp(batch.createdAt)}
                                      </Typography>
                                    </Box>
                                    <Chip label={`${batch.matchCount} matches`} size="small" variant="outlined" />
                                  </Stack>
                                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                    {batch.season ? (
                                      <Chip label={`Season ${batch.season}`} size="small" variant="outlined" />
                                    ) : null}
                                    {batch.attendanceWorkbookName ? (
                                      <Chip label={batch.attendanceWorkbookName} size="small" variant="outlined" />
                                    ) : null}
                                    {batch.unmatchedAvailabilityNames.length > 0 ? (
                                      <Chip
                                        label={`${batch.unmatchedAvailabilityNames.length} unmatched`}
                                        size="small"
                                        color="warning"
                                        variant="outlined"
                                      />
                                    ) : null}
                                  </Stack>
                                  <Stack direction="row" spacing={1}>
                                    <Button
                                      variant={selectedBatchId === batch.id ? "contained" : "outlined"}
                                      size="small"
                                      onClick={() => setSelectedBatchId(batch.id)}
                                    >
                                      View
                                    </Button>
                                    <Button
                                      variant="outlined"
                                      color="error"
                                      size="small"
                                      startIcon={deletingBatchId === batch.id ? <CircularProgress size={14} color="inherit" /> : <DeleteRoundedIcon />}
                                      disabled={deletingBatchId === batch.id}
                                      onClick={() => void handleBatchDelete(batch)}
                                    >
                                      Delete
                                    </Button>
                                  </Stack>
                                </Stack>
                              </CardContent>
                            </Card>
                          ))}
                        </Stack>
                      )}
                      {savedBatchesPageCount > 1 ? (
                        <PaginationFooter
                          pageStart={(savedBatchesPage - 1) * SAVED_BATCHES_PAGE_SIZE + 1}
                          pageEnd={Math.min(savedBatchesPage * SAVED_BATCHES_PAGE_SIZE, savedBatches.length)}
                          totalCount={savedBatches.length}
                          hasPreviousPage={savedBatchesPage > 1}
                          hasNextPage={savedBatchesPage < savedBatchesPageCount}
                          onPrevious={() => setSavedBatchesPage((currentPage) => Math.max(1, currentPage - 1))}
                          onNext={() => setSavedBatchesPage((currentPage) => Math.min(savedBatchesPageCount, currentPage + 1))}
                        />
                      ) : null}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
}
