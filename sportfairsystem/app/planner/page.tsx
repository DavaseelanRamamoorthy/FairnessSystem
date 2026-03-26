"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography
} from "@mui/material";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import Groups2RoundedIcon from "@mui/icons-material/Groups2Rounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricketRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import { canAccessPlannerWorkspace } from "@/app/services/accessControlService";
import { formatName } from "@/app/services/formatname";
import { saveFriendlyPlannerBatch } from "@/app/services/plannerHistoryService";
import {
  PlannerPlayerSummary,
  PlayerSummary,
  SeasonOption,
  getPlayerSeasons,
  getPlannerPlayerSummaries
} from "@/app/services/playerProfileService";
import {
  buildPlannerSuggestion,
  FriendlyMatchAvailabilityOverrides,
  parseAttendanceWorkbook,
  PlannerSuggestion,
  PlannerWorkbook
} from "@/app/services/plannerService";
import { getLatestSeasonValue } from "@/app/utils/seasonSelection";
import { readStoredSeasonFilter, storeSeasonFilter } from "@/app/utils/seasonFilterStorage";

const PLANNER_SEASON_STORAGE_KEY = "sportfairsystem:season-filter:planner";
const PLANNER_STATE_STORAGE_KEY = "sportfairsystem:planner-state:v1";

type PlannerMode = "friendly" | "tournament";
type PersistedPlannerState = {
  plannerMode: PlannerMode;
  plannerWorkbook: PlannerWorkbook | null;
  selectedWeekendId: string;
  selectedMatchCount: number;
  uploadedFileName: string | null;
  selectedFriendlyWicketKeeperId: string;
  manualFriendlyMatchAvailability: Record<string, boolean[]>;
  manualTournamentAvailability: Record<string, boolean>;
  generatedSuggestion: PlannerSuggestion | null;
  generatedMode: PlannerMode | null;
};

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

function buildPlayerLabel(player: PlayerSummary) {
  const tags = [
    player.isCaptain ? "Captain" : null,
    player.isWicketKeeper ? "WK" : null,
    ...player.roleTags
  ].filter(Boolean);

  return tags.length > 0 ? `${formatName(player.name)} - ${tags.join(", ")}` : formatName(player.name);
}

function buildAvailabilityLabel(player: PlayerSummary) {
  const tags = [
    player.isCaptain ? "C" : null,
    player.isWicketKeeper ? "WK" : null
  ].filter(Boolean);

  return tags.length > 0 ? `${formatName(player.name)} - ${tags.join(", ")}` : formatName(player.name);
}

function buildManualAvailabilityOverrides(
  players: PlannerPlayerSummary[],
  selectedAvailability: Record<string, boolean>
) {
  return players.reduce<Record<string, boolean>>((result, player) => {
    result[player.id] = selectedAvailability[player.id] ?? false;
    return result;
  }, {});
}

function buildFriendlyMatchAvailabilityOverrides(
  playerAvailability: Record<string, boolean[]>,
  matchCount: number
) {
  return Object.entries(playerAvailability).reduce<FriendlyMatchAvailabilityOverrides>((result, [playerId, matches]) => {
    result[playerId] = Array.from({ length: matchCount }, (_, index) => index + 1)
      .filter((matchNumber) => matches[matchNumber - 1] ?? true);
    return result;
  }, {});
}

export default function PlannerPage() {
  const [canAccessWorkspace, setCanAccessWorkspace] = useState<boolean | null>(null);
  const [plannerMode, setPlannerMode] = useState<PlannerMode>("friendly");
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(() => readStoredSeasonFilter(PLANNER_SEASON_STORAGE_KEY) ?? "");
  const [hasResolvedSeason, setHasResolvedSeason] = useState(false);
  const [players, setPlayers] = useState<PlannerPlayerSummary[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);
  const [plannerWorkbook, setPlannerWorkbook] = useState<PlannerWorkbook | null>(null);
  const [selectedWeekendId, setSelectedWeekendId] = useState("");
  const [selectedMatchCount, setSelectedMatchCount] = useState(3);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isParsingWorkbook, setIsParsingWorkbook] = useState(false);
  const [selectedFriendlyWicketKeeperId, setSelectedFriendlyWicketKeeperId] = useState("");
  const [manualFriendlyMatchAvailability, setManualFriendlyMatchAvailability] = useState<Record<string, boolean[]>>({});
  const [manualTournamentAvailability, setManualTournamentAvailability] = useState<Record<string, boolean>>({});
  const [generatedSuggestion, setGeneratedSuggestion] = useState<PlannerSuggestion | null>(null);
  const [generatedMode, setGeneratedMode] = useState<PlannerMode | null>(null);
  const [isSavingFriendlyPlan, setIsSavingFriendlyPlan] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const rawState = window.localStorage.getItem(PLANNER_STATE_STORAGE_KEY);

      if (!rawState) {
        return;
      }

      const persistedState = JSON.parse(rawState) as Partial<PersistedPlannerState>;

      if (persistedState.plannerMode === "friendly" || persistedState.plannerMode === "tournament") {
        setPlannerMode(persistedState.plannerMode);
      }

      setPlannerWorkbook(persistedState.plannerWorkbook ?? null);
      setSelectedWeekendId(typeof persistedState.selectedWeekendId === "string" ? persistedState.selectedWeekendId : "");
      setSelectedMatchCount(
        typeof persistedState.selectedMatchCount === "number"
          && persistedState.selectedMatchCount >= 1
          && persistedState.selectedMatchCount <= 3
          ? persistedState.selectedMatchCount
          : 3
      );
      setUploadedFileName(typeof persistedState.uploadedFileName === "string" ? persistedState.uploadedFileName : null);
      setSelectedFriendlyWicketKeeperId(
        typeof persistedState.selectedFriendlyWicketKeeperId === "string"
          ? persistedState.selectedFriendlyWicketKeeperId
          : ""
      );
      setManualFriendlyMatchAvailability(persistedState.manualFriendlyMatchAvailability ?? {});
      setManualTournamentAvailability(persistedState.manualTournamentAvailability ?? {});
      setGeneratedSuggestion(persistedState.generatedSuggestion ?? null);
      setGeneratedMode(
        persistedState.generatedMode === "friendly" || persistedState.generatedMode === "tournament"
          ? persistedState.generatedMode
          : null
      );
    } catch {
      window.localStorage.removeItem(PLANNER_STATE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      const nextState: PersistedPlannerState = {
        plannerMode,
        plannerWorkbook,
        selectedWeekendId,
        selectedMatchCount,
        uploadedFileName,
        selectedFriendlyWicketKeeperId,
        manualFriendlyMatchAvailability,
        manualTournamentAvailability,
        generatedSuggestion,
        generatedMode
      };

      window.localStorage.setItem(PLANNER_STATE_STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      // Ignore storage write failures and keep the planner usable.
    }
  }, [
    generatedMode,
    generatedSuggestion,
    manualFriendlyMatchAvailability,
    manualTournamentAvailability,
    plannerMode,
    plannerWorkbook,
    selectedFriendlyWicketKeeperId,
    selectedMatchCount,
    selectedWeekendId,
    uploadedFileName
  ]);

  useEffect(() => {
    let isActive = true;

    const loadSeasons = async () => {
      try {
        const nextSeasons = await getPlayerSeasons();
        if (!isActive) {
          return;
        }

        setSeasons(nextSeasons);
        const storedSeason = readStoredSeasonFilter(PLANNER_SEASON_STORAGE_KEY);
        const nextSeasonValues = new Set(nextSeasons.map((season) => season.value));
        const resolvedSeason = storedSeason && (storedSeason === "all" || nextSeasonValues.has(storedSeason))
          ? storedSeason
          : getLatestSeasonValue(nextSeasons);
        setSelectedSeason((currentSeason) =>
          currentSeason && (currentSeason === "all" || nextSeasonValues.has(currentSeason))
            ? currentSeason
            : resolvedSeason
        );
      } catch {
        // Keep planner usable even if seasons fail to load.
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
      storeSeasonFilter(PLANNER_SEASON_STORAGE_KEY, selectedSeason);
    }
  }, [selectedSeason]);

  useEffect(() => {
    let isActive = true;

    const loadPlannerAccess = async () => {
      try {
        const nextCanAccessWorkspace = await canAccessPlannerWorkspace();

        if (isActive) {
          setCanAccessWorkspace(nextCanAccessWorkspace);
        }
      } catch {
        if (isActive) {
          setCanAccessWorkspace(false);
        }
      }
    };

    void loadPlannerAccess();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!hasResolvedSeason && !selectedSeason) {
      return;
    }

    if (!canAccessWorkspace) {
      setPlayers([]);
      setIsLoadingPlayers(false);
      return;
    }

    let isActive = true;

    const loadPlayers = async () => {
      setIsLoadingPlayers(true);
      setErrorMessage(null);

      try {
        const nextPlayers = await getPlannerPlayerSummaries(
          !selectedSeason || selectedSeason === "all" ? undefined : selectedSeason
        );
        if (!isActive) {
          return;
        }

        setPlayers(nextPlayers);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setPlayers([]);
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load squad players for planning."
        );
      } finally {
        if (isActive) {
          setIsLoadingPlayers(false);
        }
      }
    };

    void loadPlayers();

    return () => {
      isActive = false;
    };
  }, [canAccessWorkspace, hasResolvedSeason, selectedSeason]);

  useEffect(() => {
    if (players.length === 0) {
      setManualTournamentAvailability({});
      return;
    }

    setManualTournamentAvailability((current) =>
      players.reduce<Record<string, boolean>>((result, player) => {
        result[player.id] = current[player.id] ?? false;
        return result;
      }, {})
    );
  }, [players]);

  useEffect(() => {
    setGeneratedSuggestion(null);
    setGeneratedMode(null);
  }, [plannerMode, selectedSeason]);

  useEffect(() => {
    setSelectedFriendlyWicketKeeperId("");
  }, [selectedWeekendId, selectedSeason, plannerMode]);

  const selectedWeekend = useMemo(() => {
    return plannerWorkbook?.weekends.find((weekend) => weekend.id === selectedWeekendId) ?? null;
  }, [plannerWorkbook, selectedWeekendId]);

  const friendlyBaseSuggestion = useMemo(() => {
    if (!selectedWeekend || players.length === 0) {
      return null;
    }

    return buildPlannerSuggestion(players, selectedWeekend.availableNames, selectedMatchCount, undefined, undefined, "friendly");
  }, [players, selectedMatchCount, selectedWeekend]);

  const friendlyWicketKeeperOptions = useMemo(() => {
    return friendlyBaseSuggestion?.availablePlayers ?? [];
  }, [friendlyBaseSuggestion]);

  useEffect(() => {
    const availablePlayers = friendlyBaseSuggestion?.availablePlayers ?? [];

    if (availablePlayers.length === 0) {
      setManualFriendlyMatchAvailability({});
      return;
    }

    setManualFriendlyMatchAvailability((current) =>
      availablePlayers.reduce<Record<string, boolean[]>>((result, player) => {
        result[player.id] = Array.from({ length: selectedMatchCount }, (_, index) => current[player.id]?.[index] ?? true);
        return result;
      }, {})
    );
  }, [friendlyBaseSuggestion, selectedMatchCount]);

  const manualTournamentSelectedCount = useMemo(() => {
    return Object.values(manualTournamentAvailability).filter(Boolean).length;
  }, [manualTournamentAvailability]);

  const activeSuggestion = generatedMode === plannerMode ? generatedSuggestion : null;

  const handleWorkbookUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setIsParsingWorkbook(true);
      setErrorMessage(null);

      const parsedWorkbook = await parseAttendanceWorkbook(file);
      setPlannerWorkbook(parsedWorkbook);
      setUploadedFileName(file.name);
      setSelectedWeekendId(parsedWorkbook.weekends[0]?.id ?? "");
      setGeneratedSuggestion(null);
      setGeneratedMode(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not read the uploaded attendance workbook."
      );
      setPlannerWorkbook(null);
      setUploadedFileName(null);
      setSelectedWeekendId("");
      setGeneratedSuggestion(null);
      setGeneratedMode(null);
    } finally {
      setIsParsingWorkbook(false);
    }
  };

  const toggleTournamentAvailability = (playerId: string) => {
    setManualTournamentAvailability((current) => ({
      ...current,
      [playerId]: !current[playerId]
    }));
    setGeneratedSuggestion(null);
    setGeneratedMode(null);
  };

  const toggleFriendlyMatchAvailability = (playerId: string, matchIndex: number) => {
    setManualFriendlyMatchAvailability((current) => {
      const currentMatches = current[playerId] ?? Array.from({ length: selectedMatchCount }, () => true);
      const nextMatches = [...currentMatches];
      nextMatches[matchIndex] = !(nextMatches[matchIndex] ?? true);

      return {
        ...current,
        [playerId]: nextMatches
      };
    });
    setGeneratedSuggestion(null);
    setGeneratedMode(null);
  };

  const setFriendlyFullDayAvailability = (playerId: string) => {
    setManualFriendlyMatchAvailability((current) => ({
      ...current,
      [playerId]: Array.from({ length: selectedMatchCount }, () => true)
    }));
    setGeneratedSuggestion(null);
    setGeneratedMode(null);
  };

  const handleFriendlyGenerate = () => {
    if (!selectedWeekend) {
      setErrorMessage("Upload the attendance workbook and choose a weekend before generating the friendly matchday plans.");
      return;
    }

    setErrorMessage(null);
    const nextSuggestion = buildPlannerSuggestion(
      players,
      selectedWeekend.availableNames,
      selectedMatchCount,
      undefined,
      selectedFriendlyWicketKeeperId || undefined,
      "friendly",
      buildFriendlyMatchAvailabilityOverrides(manualFriendlyMatchAvailability, selectedMatchCount)
    );
    setGeneratedSuggestion(nextSuggestion);
    setGeneratedMode("friendly");
  };

  const handleFriendlySave = async () => {
    if (!selectedWeekend || !activeSuggestion || generatedMode !== "friendly") {
      setErrorMessage("Generate the friendly planner first before saving the matchday plan.");
      return;
    }

    setIsSavingFriendlyPlan(true);
    setErrorMessage(null);

    try {
      const savedBatch = await saveFriendlyPlannerBatch({
        season: selectedSeason || null,
        attendanceWorkbookName: uploadedFileName,
        weekend: selectedWeekend,
        suggestion: activeSuggestion,
        preferredWicketKeeperPlayerId: selectedFriendlyWicketKeeperId || null,
        matchAvailabilityOverrides: buildFriendlyMatchAvailabilityOverrides(
          manualFriendlyMatchAvailability,
          selectedMatchCount
        )
      });

      setSaveSuccessMessage(
        `Saved the friendly matchday plan for ${selectedWeekend.label} with ${savedBatch.savedAssignments} tracked assignments.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save the friendly matchday plan."
      );
    } finally {
      setIsSavingFriendlyPlan(false);
    }
  };

  const handleTournamentGenerate = () => {
    const manualAvailabilityOverrides = buildManualAvailabilityOverrides(players, manualTournamentAvailability);
    const nextSuggestion = buildPlannerSuggestion(players, [], 1, manualAvailabilityOverrides, undefined, "tournament");
    setGeneratedSuggestion(nextSuggestion);
    setGeneratedMode("tournament");
  };

  const renderSuggestion = (plannerSuggestion: PlannerSuggestion, mode: PlannerMode) => {
    const unavailableHeading = mode === "friendly" ? "Not Available This Week" : "Not Included For Tournament";
    const unavailableDescription = mode === "friendly"
      ? "Squad players who did not mark themselves available for the selected weekend, including no response or explicit unavailability."
      : "Players manually left out before the tournament squad was generated.";
    const droppedDescription = mode === "friendly"
      ? "Players who were available this week but were not selected in any Playing XI or 12th-man slot across the generated match plans."
      : "Players manually included for tournament selection but not used in the generated Playing XI or 12th-man slot.";
    const formatPlanPlayerLabel = (player: PlayerSummary) => {
      const tags = [
        player.isCaptain ? "C" : null,
        (mode === "friendly" && selectedFriendlyWicketKeeperId && player.id === selectedFriendlyWicketKeeperId)
          || player.isWicketKeeper
          ? "WK"
          : null
      ].filter(Boolean);

      return tags.length > 0 ? `${formatName(player.name)} - ${tags.join(", ")}` : formatName(player.name);
    };

    return (
      <Stack spacing={3}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              label="Available Squad"
              value={plannerSuggestion.availablePlayers.length}
              helper={mode === "friendly" ? "Matched from the uploaded weekend sheet" : "Manually confirmed for the tournament matchday"}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              label="Not Available"
              value={plannerSuggestion.unavailablePlayers.length}
              helper={mode === "friendly" ? "Squad players not marked available this week" : "Players manually left out before generation"}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              label="Unmatched Names"
              value={plannerSuggestion.unmatchedAvailabilityNames.length}
              helper={mode === "friendly" ? "Attendance names not matched to the squad" : "Not used in tournament mode"}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              label="Dropped"
              value={plannerSuggestion.reserves.length}
              helper={mode === "friendly" ? "Available players not used in the final friendly plan" : "Available players not used in the generated plans"}
            />
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 4 }}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <AutorenewRoundedIcon color="primary" />
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      Planner Notes
                    </Typography>
                  </Stack>

                  {plannerSuggestion.notes.map((note, index) => (
                    <Alert key={`${note}-${index}`} severity="info" variant="outlined">
                      {note}
                    </Alert>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 8 }}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <EventAvailableRoundedIcon color="primary" />
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      Confirmed Availability
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {plannerSuggestion.availablePlayers.map((player) => (
                      <Chip
                        key={player.id}
                        label={buildAvailabilityLabel(player)}
                        sx={{ maxWidth: "100%" }}
                      />
                    ))}
                  </Stack>

                  {mode === "friendly" && plannerSuggestion.unmatchedAvailabilityNames.length > 0 && (
                    <Stack spacing={1}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Unmatched attendance names
                      </Typography>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {plannerSuggestion.unmatchedAvailabilityNames.map((name) => (
                          <Chip key={name} label={name} color="warning" variant="outlined" />
                        ))}
                      </Stack>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          {plannerSuggestion.matchPlans.map((plan) => (
            <Grid key={plan.matchNumber} size={{ xs: 12, xl: 4 }}>
              <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={2.25}>
                    <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Groups2RoundedIcon color="primary" />
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                          Match {plan.matchNumber}
                        </Typography>
                      </Stack>

                      <Chip
                        label={plan.twelfthMan ? `12th: ${formatName(plan.twelfthMan.name)}` : "No 12th man"}
                        color={plan.twelfthMan ? "warning" : "default"}
                        size="small"
                      />
                    </Stack>

                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip
                        label={plan.xiShortfall > 0 ? `${plan.playingXi.length}/11 selected` : "Full XI"}
                        color={plan.xiShortfall > 0 ? "error" : "success"}
                        size="small"
                        variant={plan.xiShortfall > 0 ? "filled" : "outlined"}
                      />
                      <Chip
                        label={plan.hasWicketKeeper ? "WK covered" : "WK missing"}
                        color={plan.hasWicketKeeper ? "success" : "warning"}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={plan.hasCaptain ? "Captain covered" : "Captain missing"}
                        color={plan.hasCaptain ? "success" : "warning"}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={`${plan.bowlingOptions} bowling option${plan.bowlingOptions === 1 ? "" : "s"}`}
                        color={plan.bowlingOptions >= 3 ? "success" : "warning"}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>

                    <Stack spacing={1}>
                      {plan.playingXi.map((player, index) => (
                        <Box
                          key={`${plan.matchNumber}-${player.id}`}
                          sx={{
                            px: 1.5,
                            py: 1,
                            borderRadius: 2,
                            backgroundColor: "action.hover"
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {index + 1}. {formatPlanPlayerLabel(player)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {plannerSuggestion.matchPlans.some((plan) => plan.benchPlayers.length > 0) && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={1.75}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "flex-start", md: "center" }}
                  justifyContent="space-between"
                >
                  <Stack spacing={0.5}>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      Bench Report
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Players outside the Playing XI for each generated match. The highlighted chip marks the suggested 12th man.
                    </Typography>
                  </Stack>

                  <Chip
                    label={`${plannerSuggestion.matchPlans.reduce((sum, plan) => sum + plan.benchPlayers.length, 0)} bench spots shown`}
                    color="warning"
                    variant="outlined"
                  />
                </Stack>

                <Grid container spacing={1.5}>
                  {plannerSuggestion.matchPlans
                    .filter((plan) => plan.benchPlayers.length > 0)
                    .map((plan) => (
                    <Grid key={`bench-${plan.matchNumber}`} size={{ xs: 12, md: 6, xl: 4 }}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2.5,
                          border: "1px solid",
                          borderColor: "divider",
                          backgroundColor: "background.paper"
                        }}
                      >
                        <Stack spacing={1}>
                          <Stack spacing={0.5}>
                            <Typography variant="body1" sx={{ fontWeight: 700 }}>
                              Match {plan.matchNumber}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {plan.benchPlayers.length} player{plan.benchPlayers.length === 1 ? "" : "s"} outside the Playing XI
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            {plan.benchPlayers.map((player) => (
                              <Chip
                                key={`${plan.matchNumber}-${player.id}`}
                                label={
                                  plan.twelfthMan?.id === player.id
                                    ? `${formatPlanPlayerLabel(player)} - 12th man`
                                    : formatPlanPlayerLabel(player)
                                }
                                color={plan.twelfthMan?.id === player.id ? "warning" : "default"}
                                size="small"
                                variant={plan.twelfthMan?.id === player.id ? "filled" : "outlined"}
                              />
                            ))}
                          </Stack>
                        </Stack>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Stack>
            </CardContent>
          </Card>
        )}

        {plannerSuggestion.reserves.length > 0 && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={1.5}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  Dropped From Matchday Plans
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {droppedDescription}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {plannerSuggestion.reserves.map((player) => (
                    <Chip key={player.id} label={buildPlayerLabel(player)} variant="outlined" />
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}

        {plannerSuggestion.unavailablePlayers.length > 0 && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={1.5}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {unavailableHeading}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {unavailableDescription}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {plannerSuggestion.unavailablePlayers.map((player) => (
                    <Chip
                      key={player.id}
                      label={buildPlayerLabel(player)}
                      color="default"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    );
  };

  return (
    <Container maxWidth="xl">
      <Stack spacing={4}>
        <TeamPageHeader
          eyebrow="Admin Workspace"
          title="Planner"
          description="Choose a friendly or tournament planning workflow, confirm availability, and generate matchday squads with XI and 12th-man suggestions."
          action={(
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="planner-season-label">Season</InputLabel>
              <Select
                labelId="planner-season-label"
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

        {canAccessWorkspace === false && (
          <AutoHideAlert severity="info" variant="outlined">
            Planner requires organiser access or explicit planning permission.
          </AutoHideAlert>
        )}

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        {saveSuccessMessage && (
          <AutoHideAlert severity="success" resetKey={saveSuccessMessage}>
            {saveSuccessMessage}
          </AutoHideAlert>
        )}

        {canAccessWorkspace && (
          <>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={1}>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    Fairness Workspace
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Saved matchday history, fairness alerts, and planner record management now live in the separate fairness workspace.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    That workspace is visible only to the organiser and captain.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    borderColor: plannerMode === "friendly" ? "primary.main" : "divider",
                    backgroundColor: plannerMode === "friendly" ? "action.hover" : "background.paper"
                  }}
                >
                  <CardActionArea onClick={() => setPlannerMode("friendly")} sx={{ borderRadius: 3 }}>
                    <CardContent sx={{ p: 3 }}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <SportsCricketRoundedIcon color="primary" />
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            Friendly Matches
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Use the attendance sheet, confirm the weekend and match count, and generate reshuffled Playing XI and 12th-man plans for the day.
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          <Chip label="Sheet-based availability" color="warning" variant="outlined" />
                          <Chip label="Reshuffle up to 3 matches" color="primary" variant="outlined" />
                        </Stack>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    borderColor: plannerMode === "tournament" ? "primary.main" : "divider",
                    backgroundColor: plannerMode === "tournament" ? "action.hover" : "background.paper"
                  }}
                >
                  <CardActionArea onClick={() => setPlannerMode("tournament")} sx={{ borderRadius: 3 }}>
                    <CardContent sx={{ p: 3 }}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <EmojiEventsRoundedIcon color="primary" />
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            Tournament Matches
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Manually confirm the tournament squad pool, then generate one final Playing XI and 12th man from that selected list.
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          <Chip label="Manual selection" color="success" variant="outlined" />
                          <Chip label="Single tournament squad" color="primary" variant="outlined" />
                        </Stack>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            </Grid>

            {isLoadingPlayers || isParsingWorkbook ? (
              <Box
                sx={{
                  minHeight: 280,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <CircularProgress />
              </Box>
            ) : plannerMode === "friendly" ? (
              <Stack spacing={3}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, lg: 8 }}>
                    <Card variant="outlined" sx={{ borderRadius: 3 }}>
                      <CardContent sx={{ p: 3 }}>
                        <Stack spacing={2.5}>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <UploadFileRoundedIcon color="primary" />
                            <Typography variant="h5" sx={{ fontWeight: 800 }}>
                              Friendly Availability Sheet
                            </Typography>
                          </Stack>

                          <Typography variant="body2" color="text.secondary">
                            Upload the weekly attendance sheet, choose the weekend column, confirm how many friendly matches are being played that day, and generate reshuffled XIs with a 12th man for each match.
                          </Typography>

                          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
                            <Button
                              component="label"
                              variant="contained"
                              startIcon={<UploadFileRoundedIcon />}
                              sx={{ width: "fit-content" }}
                            >
                              Upload Attendance Sheet
                              <input
                                hidden
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleWorkbookUpload}
                              />
                            </Button>

                            {uploadedFileName && (
                              <Chip label={uploadedFileName} color="primary" variant="outlined" sx={{ width: "fit-content" }} />
                            )}
                          </Stack>

                          {plannerWorkbook && (
                            <Grid container spacing={1.5}>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormControl size="small" fullWidth>
                                  <InputLabel id="planner-weekend-label">Weekend</InputLabel>
                                  <Select
                                    labelId="planner-weekend-label"
                                    value={selectedWeekendId}
                                    label="Weekend"
                                    onChange={(event) => {
                                      setSelectedWeekendId(event.target.value);
                                      setGeneratedSuggestion(null);
                                      setGeneratedMode(null);
                                    }}
                                  >
                                    {plannerWorkbook.weekends.map((weekend) => (
                                      <MenuItem key={weekend.id} value={weekend.id}>
                                        {weekend.label} ({weekend.sourceColumn})
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>

                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormControl size="small" fullWidth>
                                  <InputLabel id="planner-match-count-label">Matches / Day</InputLabel>
                                  <Select
                                    labelId="planner-match-count-label"
                                    value={String(selectedMatchCount)}
                                    label="Matches / Day"
                                    onChange={(event) => {
                                      setSelectedMatchCount(Number(event.target.value));
                                      setGeneratedSuggestion(null);
                                      setGeneratedMode(null);
                                    }}
                                  >
                                    <MenuItem value="1">1 Match</MenuItem>
                                    <MenuItem value="2">2 Matches</MenuItem>
                                    <MenuItem value="3">3 Matches</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>

                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormControl size="small" fullWidth>
                                  <InputLabel id="planner-friendly-wk-label">Wicket Keeper</InputLabel>
                                  <Select
                                    labelId="planner-friendly-wk-label"
                                    value={selectedFriendlyWicketKeeperId}
                                    label="Wicket Keeper"
                                    onChange={(event) => {
                                      setSelectedFriendlyWicketKeeperId(event.target.value);
                                      setGeneratedSuggestion(null);
                                      setGeneratedMode(null);
                                    }}
                                  >
                                    <MenuItem value="">Use Squad Default</MenuItem>
                                    {friendlyWicketKeeperOptions.map((player) => (
                                      <MenuItem key={player.id} value={player.id}>
                                        {buildPlayerLabel(player)}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                            </Grid>
                          )}

                          {friendlyBaseSuggestion && friendlyBaseSuggestion.availablePlayers.length > 0 && (
                            <Box
                              sx={{
                                p: 2,
                                borderRadius: 3,
                                backgroundColor: "action.hover",
                                border: "1px solid",
                                borderColor: "divider"
                              }}
                            >
                              <Stack spacing={1.5}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                  Matchday Overrides
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Use this when someone leaves early, arrives late, or can only play selected matches. Turn off the matches they cannot play before generating the friendly plans.
                                </Typography>
                                <Stack spacing={0}>
                                  {friendlyBaseSuggestion.availablePlayers.map((player) => {
                                    const playerMatchAvailability =
                                      manualFriendlyMatchAvailability[player.id]
                                      ?? Array.from({ length: selectedMatchCount }, () => true);
                                    const availableMatchLabels = playerMatchAvailability
                                      .map((isAvailable, index) => (isAvailable ? `M${index + 1}` : null))
                                      .filter((value): value is string => Boolean(value));
                                    const isFullDayAvailable = availableMatchLabels.length === selectedMatchCount;
                                    const availabilitySummaryLabel =
                                      availableMatchLabels.length === 0
                                        ? "Unavailable today"
                                        : isFullDayAvailable
                                          ? `All ${selectedMatchCount} matches`
                                          : availableMatchLabels.length === 1
                                            ? `${availableMatchLabels[0]} only`
                                            : `Available for ${availableMatchLabels.join(", ")}`;

                                    return (
                                      <Box
                                        key={`friendly-override-${player.id}`}
                                        sx={{
                                          py: 1.25,
                                          borderBottom: "1px solid",
                                          borderColor: "divider",
                                          "&:last-of-type": {
                                            borderBottom: "none",
                                            pb: 0
                                          },
                                          "&:first-of-type": {
                                            pt: 0
                                          }
                                        }}
                                      >
                                        <Stack
                                          direction={{ xs: "column", lg: "row" }}
                                          spacing={1.25}
                                          alignItems={{ xs: "flex-start", lg: "center" }}
                                          justifyContent="space-between"
                                        >
                                          <Stack
                                            spacing={0.35}
                                            sx={{ minWidth: { lg: 240 } }}
                                          >
                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                              {formatName(player.name)}
                                            </Typography>
                                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                              <Chip
                                                label={availabilitySummaryLabel}
                                                size="small"
                                                color={availableMatchLabels.length > 0 ? "success" : "default"}
                                                variant="outlined"
                                              />
                                            </Stack>
                                          </Stack>
                                        </Stack>
                                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                                          {Array.from({ length: selectedMatchCount }, (_, index) => (
                                            <Chip
                                              key={`${player.id}-match-${index + 1}`}
                                              label={`M${index + 1}`}
                                              clickable
                                              size="small"
                                              color={(playerMatchAvailability[index] ?? true) ? "success" : "default"}
                                              variant={(playerMatchAvailability[index] ?? true) ? "filled" : "outlined"}
                                              onClick={() => toggleFriendlyMatchAvailability(player.id, index)}
                                            />
                                          ))}
                                          {!isFullDayAvailable ? (
                                            <Button
                                              variant="text"
                                              size="small"
                                              onClick={() => setFriendlyFullDayAvailability(player.id)}
                                            >
                                              Reset All
                                            </Button>
                                          ) : null}
                                        </Stack>
                                      </Box>
                                    );
                                  })}
                                </Stack>
                              </Stack>
                            </Box>
                          )}

                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                            <Button
                              variant="contained"
                              onClick={handleFriendlyGenerate}
                              disabled={!selectedWeekend}
                              startIcon={<Groups2RoundedIcon />}
                              sx={{ width: { xs: "100%", sm: "fit-content" } }}
                            >
                              Generate Friendly Matchday Plans
                            </Button>
                            <Button
                              variant="outlined"
                              color="secondary"
                              onClick={handleFriendlySave}
                              disabled={!selectedWeekend || !activeSuggestion || isSavingFriendlyPlan}
                              startIcon={isSavingFriendlyPlan ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />}
                              sx={{ width: { xs: "100%", sm: "fit-content" } }}
                            >
                              Save Matchday Plan
                            </Button>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid size={{ xs: 12, lg: 4 }}>
                    <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                      <CardContent sx={{ p: 3 }}>
                        <Stack spacing={1.5}>
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            Friendly Planning Rules
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Friendly planning uses the uploaded attendance sheet as the source of truth, lets the captain choose the wicket keeper manually, and reshuffles the available squad across up to three matches on the same day.
                          </Typography>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            <Chip label="Sheet only" color="warning" variant="outlined" />
                            <Chip label="Manual wicket keeper" color="success" variant="outlined" />
                            <Chip label="Auto reshuffle for up to 3 matches" color="primary" variant="outlined" />
                          </Stack>
                          {friendlyBaseSuggestion && (
                            <Chip
                              label={`${friendlyBaseSuggestion.availablePlayers.length} matched players ready for planning`}
                              color="primary"
                              variant="outlined"
                              sx={{ width: "fit-content" }}
                            />
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {activeSuggestion ? renderSuggestion(activeSuggestion, "friendly") : null}
              </Stack>
            ) : (
              <Stack spacing={3}>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2.5}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <EmojiEventsRoundedIcon color="primary" />
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                          Tournament Squad Selection
                        </Typography>
                      </Stack>

                      <Typography variant="body2" color="text.secondary">
                        Manually choose the players available for the tournament. The generator will build one final Playing XI and one 12th man from the selected pool.
                      </Typography>

                      <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} useFlexGap flexWrap="wrap">
                        <Chip
                          label={`${manualTournamentSelectedCount} selected`}
                          color="success"
                          variant="outlined"
                        />
                        <Chip
                          label={`${players.length - manualTournamentSelectedCount} not selected`}
                          color="default"
                          variant="outlined"
                        />
                        <Button
                          variant="contained"
                          onClick={handleTournamentGenerate}
                          disabled={manualTournamentSelectedCount < 11}
                          startIcon={<Groups2RoundedIcon />}
                          sx={{ width: { xs: "100%", md: "fit-content" } }}
                        >
                          Generate Tournament Squad
                        </Button>
                      </Stack>

                      {manualTournamentSelectedCount < 11 && (
                        <Alert severity="info" variant="outlined">
                          Select at least 11 players before generating the tournament XI.
                        </Alert>
                      )}

                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          backgroundColor: "action.hover",
                          border: "1px solid",
                          borderColor: "divider"
                        }}
                      >
                        <Stack spacing={1.5}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Select Tournament Availability
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Click a player to include or exclude them from the tournament squad pool.
                          </Typography>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            {players.map((player) => {
                              const isSelected = manualTournamentAvailability[player.id] ?? false;

                              return (
                                <Chip
                                  key={player.id}
                                  label={buildPlayerLabel(player)}
                                  clickable
                                  onClick={() => toggleTournamentAvailability(player.id)}
                                  color={isSelected ? "success" : "default"}
                                  variant={isSelected ? "filled" : "outlined"}
                                  sx={{
                                    fontWeight: 600,
                                    "& .MuiChip-label": {
                                      px: 1.5
                                    }
                                  }}
                                />
                              );
                            })}
                          </Stack>
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                {activeSuggestion ? (
                  renderSuggestion(activeSuggestion, "tournament")
                ) : (
                  <Alert severity="info" variant="outlined">
                    Select the tournament squad pool manually, then generate the final Playing XI and 12th man.
                  </Alert>
                )}
              </Stack>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
