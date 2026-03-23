"use client";

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
  Pagination,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import { useAuth } from "@/app/context/AuthContext";
import { canAccessFairnessWorkspace } from "@/app/services/accessControlService";
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
import { getPlayerSeasons, SeasonOption } from "@/app/services/playerProfileService";
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

function getFairnessAlertSeverity(
  alert: PlannerFairnessAlert
): "info" | "warning" {
  return alert.severity;
}

function renderFairnessAlertMessage(alert: PlannerFairnessAlert) {
  const formattedName = formatName(alert.playerName);
  const remainingMessage = alert.message.startsWith(alert.playerName)
    ? alert.message.slice(alert.playerName.length).trimStart()
    : alert.message;

  return (
    <>
      <Box component="span" sx={{ fontWeight: 800 }}>
        {formattedName}
      </Box>
      {remainingMessage ? ` ${remainingMessage}` : ""}
    </>
  );
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

export default function FairnessPage() {
  const { isAuthenticated } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(() => readStoredSeasonFilter(FAIRNESS_SEASON_STORAGE_KEY) ?? "");
  const [hasResolvedSeason, setHasResolvedSeason] = useState(false);
  const [dashboard, setDashboard] = useState<PlannerFairnessDashboard | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [savedBatches, setSavedBatches] = useState<PlannerBatchListItem[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedBatchDetail, setSelectedBatchDetail] = useState<PlannerBatchDetail | null>(null);
  const [isLoadingBatchDetail, setIsLoadingBatchDetail] = useState(false);
  const [batchNotesDraft, setBatchNotesDraft] = useState("");
  const [isSavingBatchNotes, setIsSavingBatchNotes] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [savingActualMatchKey, setSavingActualMatchKey] = useState<string | null>(null);
  const [fairnessTrackerPage, setFairnessTrackerPage] = useState(1);
  const [savedBatchesPage, setSavedBatchesPage] = useState(1);
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
      const [nextDashboard, nextBatches] = await Promise.all([
        getPlannerFairnessDashboard(normalizedSeason),
        listFriendlyPlannerBatches(normalizedSeason)
      ]);

      setDashboard(nextDashboard);
      setSavedBatches(nextBatches);
      setSelectedBatchId((currentBatchId) => {
        if (currentBatchId && nextBatches.some((batch) => batch.id === currentBatchId)) {
          return currentBatchId;
        }

        return nextBatches[0]?.id ?? "";
      });
    } catch (error) {
      setDashboard(null);
      setSavedBatches([]);
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
    setFairnessTrackerPage(1);
    setSavedBatchesPage(1);
  }, [selectedSeason]);

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
    return (
      <Container maxWidth="xl">
        <Stack spacing={4}>
          <TeamPageHeader
            eyebrow="Leadership Workspace"
            title="Fairness"
            description="Organiser and captain workspace for fairness tracking, alerts, and saved matchday management."
          />
          <Alert severity="warning" variant="outlined">
            Only the organiser or captain can access the fairness workspace.
          </Alert>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Stack spacing={4}>
        <TeamPageHeader
          eyebrow="Leadership Workspace"
          title="Fairness"
          description="Track authentic planner fairness across saved matchdays, review recent player opportunity history, and manage saved planner records in one place."
          action={(
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
                <Stack spacing={2}>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    Fairness Alerts
                  </Typography>
                  {dashboard.savedMatchdays === 0 ? (
                    <EmptyStateMessage>
                      Save a friendly matchday plan first. Alerts start once planner history exists.
                    </EmptyStateMessage>
                  ) : fairnessAlerts.length === 0 ? (
                    <EmptyStateMessage>
                      No active fairness alerts from the saved planner history.
                    </EmptyStateMessage>
                  ) : (
                    <Stack spacing={1.25}>
                      {fairnessAlerts.map((alert) => (
                        <Alert
                          key={alert.id}
                          severity={getFairnessAlertSeverity(alert)}
                          variant="outlined"
                        >
                          {renderFairnessAlertMessage(alert)}
                        </Alert>
                      ))}
                    </Stack>
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
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            <Chip label={selectedBatchDetail.weekendLabel} color="primary" variant="outlined" />
                            <Chip label={`Saved ${formatTimestamp(selectedBatchDetail.createdAt)}`} variant="outlined" />
                            {selectedBatchDetail.weekendDate ? (
                              <Chip label={selectedBatchDetail.weekendDate} variant="outlined" />
                            ) : null}
                          </Stack>

                          <Grid container spacing={2}>
                            {selectedBatchDetail.matches.map((match) => (
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
                                          {selectedBatchDetail.actualMatchCandidates.map((candidate) => (
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
                                      ) : (
                                        <Typography variant="caption" color="text.secondary">
                                          Link the real scorecard for this match to move fairness from planned to actual participation.
                                        </Typography>
                                      )}
                                      <Typography variant="caption" color="text.secondary">
                                        XI
                                      </Typography>
                                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                        {match.xiPlayers.map((player) => (
                                          <Chip key={`batch-${selectedBatchDetail.id}-m${match.matchNumber}-xi-${player}`} label={formatName(player)} size="small" variant="outlined" />
                                        ))}
                                      </Stack>
                                      <Typography variant="caption" color="text.secondary">
                                        12th / Bench
                                      </Typography>
                                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                        {match.twelfthPlayer ? (
                                          <Chip label={`${formatName(match.twelfthPlayer)} - 12th`} size="small" color="warning" variant="outlined" />
                                        ) : null}
                                        {match.benchPlayers.map((player) => (
                                          <Chip key={`batch-${selectedBatchDetail.id}-m${match.matchNumber}-bench-${player}`} label={formatName(player)} size="small" variant="outlined" />
                                        ))}
                                      </Stack>
                                      {match.unavailablePlayers.length > 0 ? (
                                        <>
                                          <Typography variant="caption" color="text.secondary">
                                            Unavailable
                                          </Typography>
                                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                            {match.unavailablePlayers.map((player) => (
                                              <Chip key={`batch-${selectedBatchDetail.id}-m${match.matchNumber}-na-${player}`} label={formatName(player)} size="small" variant="outlined" />
                                            ))}
                                          </Stack>
                                        </>
                                      ) : null}
                                      {match.linkedActualMatchId ? (
                                        <>
                                          <Typography variant="caption" color="text.secondary">
                                            Actual Scorecard Involvement
                                          </Typography>
                                          {match.actualListedPlayers.length > 0 ? (
                                            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                              {match.actualListedPlayers.map((player) => (
                                                <Chip
                                                  key={`batch-${selectedBatchDetail.id}-m${match.matchNumber}-actual-${player}`}
                                                  label={formatName(player)}
                                                  size="small"
                                                  color="success"
                                                  variant="outlined"
                                                />
                                              ))}
                                            </Stack>
                                          ) : (
                                            <Typography variant="caption" color="text.secondary">
                                              No actual player involvement was matched from the linked scorecard yet.
                                            </Typography>
                                          )}
                                          {(match.actualBattedPlayers.length > 0 || match.actualBowledPlayers.length > 0) ? (
                                            <Stack spacing={0.75}>
                                              {match.actualBattedPlayers.length > 0 ? (
                                                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                                  {match.actualBattedPlayers.map((player) => (
                                                    <Chip
                                                      key={`batch-${selectedBatchDetail.id}-m${match.matchNumber}-bat-${player}`}
                                                      label={`${formatName(player)} - Bat`}
                                                      size="small"
                                                      variant="outlined"
                                                    />
                                                  ))}
                                                </Stack>
                                              ) : null}
                                              {match.actualBowledPlayers.length > 0 ? (
                                                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                                  {match.actualBowledPlayers.map((player) => (
                                                    <Chip
                                                      key={`batch-${selectedBatchDetail.id}-m${match.matchNumber}-bowl-${player}`}
                                                      label={`${formatName(player)} - Bowl`}
                                                      size="small"
                                                      variant="outlined"
                                                    />
                                                  ))}
                                                </Stack>
                                              ) : null}
                                            </Stack>
                                          ) : null}
                                        </>
                                      ) : null}
                                    </Stack>
                                  </CardContent>
                                </Card>
                              </Grid>
                            ))}
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
                            <Stack direction="row" justifyContent="flex-end">
                              <Pagination
                                count={fairnessTrackerPageCount}
                                page={fairnessTrackerPage}
                                onChange={(_, page) => setFairnessTrackerPage(page)}
                                color="primary"
                                size="small"
                              />
                            </Stack>
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
                        {fairnessUnderusePlayers.length > 0 ? (
                          <Alert severity="warning" variant="outlined">
                            {fairnessUnderusePlayers.length} player{fairnessUnderusePlayers.length > 1 ? "s are" : " is"} currently on underuse watch after crossing the 5-XI baseline.
                          </Alert>
                        ) : (
                          <EmptyStateMessage>
                            No current underuse alerts in the saved planner history.
                          </EmptyStateMessage>
                        )}

                        {fairnessUrgentPlayers.length > 0 ? (
                          <Alert severity="info" variant="outlined">
                            {fairnessUrgentPlayers.length} player{fairnessUrgentPlayers.length > 1 ? "s still need" : " still needs"} strong rotation support to build toward the first 5 XI opportunities.
                          </Alert>
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
                                      {selectedBatchId === batch.id ? "Viewing" : "View"}
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
                        <Stack direction="row" justifyContent="flex-end">
                          <Pagination
                            count={savedBatchesPageCount}
                            page={savedBatchesPage}
                            onChange={(_, page) => setSavedBatchesPage(page)}
                            color="primary"
                            size="small"
                          />
                        </Stack>
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
