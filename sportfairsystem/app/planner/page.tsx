"use client";

import { useEffect, useMemo, useState } from "react";

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
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import Groups2RoundedIcon from "@mui/icons-material/Groups2Rounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricketRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import {
  AttendanceAvailabilityState,
  AttendanceSessionDetail,
  AttendanceSessionRecord,
  createPlannerAttendanceSession,
  getPlannerAttendanceSessionDetail,
  getPlannerAttendanceSessions,
  savePlannerAttendanceAvailability
} from "@/app/services/attendanceService";
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
  buildPlannerSuggestionForReleaseFromMembers,
  buildPlannerSuggestionFromMembers,
  FriendlyMatchAvailabilityOverrides,
  PlannerSuggestion
} from "@/app/services/plannerService";
import { getLatestSeasonValue } from "@/app/utils/seasonSelection";
import { readStoredSeasonFilter, storeSeasonFilter } from "@/app/utils/seasonFilterStorage";

const PLANNER_SEASON_STORAGE_KEY = "sportfairsystem:season-filter:planner";
const PLANNER_STATE_STORAGE_KEY = "sportfairsystem:planner-state:v1";

type PlannerMode = "friendly" | "tournament";
type PersistedPlannerState = {
  plannerMode: PlannerMode;
  selectedMatchCount: number;
  selectedNativeAttendanceSessionId: string;
  pendingNativeAttendanceDate: string;
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
  const [selectedMatchCount, setSelectedMatchCount] = useState(3);
  const [nativeAttendanceSessions, setNativeAttendanceSessions] = useState<AttendanceSessionRecord[]>([]);
  const [selectedNativeAttendanceSessionId, setSelectedNativeAttendanceSessionId] = useState("");
  const [pendingNativeAttendanceDate, setPendingNativeAttendanceDate] = useState("");
  const [nativeAttendanceDetail, setNativeAttendanceDetail] = useState<AttendanceSessionDetail | null>(null);
  const [nativeAttendanceDraft, setNativeAttendanceDraft] = useState<Record<string, AttendanceAvailabilityState>>({});
  const [isLoadingNativeAttendanceSessions, setIsLoadingNativeAttendanceSessions] = useState(false);
  const [isLoadingNativeAttendanceDetail, setIsLoadingNativeAttendanceDetail] = useState(false);
  const [isCreatingNativeAttendanceSession, setIsCreatingNativeAttendanceSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFriendlyWicketKeeperId, setSelectedFriendlyWicketKeeperId] = useState("");
  const [manualFriendlyMatchAvailability, setManualFriendlyMatchAvailability] = useState<Record<string, boolean[]>>({});
  const [manualTournamentAvailability, setManualTournamentAvailability] = useState<Record<string, boolean>>({});
  const [generatedSuggestion, setGeneratedSuggestion] = useState<PlannerSuggestion | null>(null);
  const [generatedMode, setGeneratedMode] = useState<PlannerMode | null>(null);
  const [isSavingFriendlyPlan, setIsSavingFriendlyPlan] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const selectedSeasonValue = selectedSeason && (selectedSeason === "all" || seasons.some((season) => season.value === selectedSeason))
    ? selectedSeason
    : "all";
  const normalizedSelectedSeason = selectedSeasonValue === "all" ? null : selectedSeasonValue;

  const resetPlannerWorkspace = (nextMode?: PlannerMode) => {
    const resolvedMode = nextMode ?? plannerMode;

    setPlannerMode(resolvedMode);
    setSelectedMatchCount(3);
    setNativeAttendanceSessions([]);
    setSelectedNativeAttendanceSessionId("");
    setPendingNativeAttendanceDate("");
    setNativeAttendanceDetail(null);
    setNativeAttendanceDraft({});
    setSelectedFriendlyWicketKeeperId("");
    setManualFriendlyMatchAvailability({});
    setManualTournamentAvailability({});
    setGeneratedSuggestion(null);
    setGeneratedMode(null);
    setErrorMessage(null);

    try {
      window.localStorage.removeItem(PLANNER_STATE_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures and keep the reset flow usable.
    }
  };

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
      setSelectedMatchCount(
        typeof persistedState.selectedMatchCount === "number"
          && persistedState.selectedMatchCount >= 1
          && persistedState.selectedMatchCount <= 3
          ? persistedState.selectedMatchCount
          : 3
      );
      setSelectedNativeAttendanceSessionId(
        typeof persistedState.selectedNativeAttendanceSessionId === "string"
          ? persistedState.selectedNativeAttendanceSessionId
          : ""
      );
      setPendingNativeAttendanceDate(
        typeof persistedState.pendingNativeAttendanceDate === "string"
          ? persistedState.pendingNativeAttendanceDate
          : ""
      );
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
        selectedMatchCount,
        selectedNativeAttendanceSessionId,
        pendingNativeAttendanceDate,
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
    pendingNativeAttendanceDate,
    selectedFriendlyWicketKeeperId,
    selectedMatchCount,
    selectedNativeAttendanceSessionId,
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
    if (selectedSeasonValue) {
      storeSeasonFilter(PLANNER_SEASON_STORAGE_KEY, selectedSeasonValue);
    }
  }, [selectedSeasonValue]);

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
          normalizedSelectedSeason ?? undefined
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
  }, [canAccessWorkspace, hasResolvedSeason, normalizedSelectedSeason, selectedSeason]);

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
  }, [selectedSeason, plannerMode, selectedNativeAttendanceSessionId]);

  useEffect(() => {
    if (!canAccessWorkspace || plannerMode !== "friendly") {
      setNativeAttendanceSessions([]);
      setSelectedNativeAttendanceSessionId("");
      setNativeAttendanceDetail(null);
      setNativeAttendanceDraft({});
      setIsLoadingNativeAttendanceSessions(false);
      return;
    }

    let isActive = true;

    const loadNativeAttendanceSessions = async () => {
      try {
        setIsLoadingNativeAttendanceSessions(true);
        const nextSessions = await getPlannerAttendanceSessions(normalizedSelectedSeason);

        if (!isActive) {
          return;
        }

        setNativeAttendanceSessions(nextSessions);
        setSelectedNativeAttendanceSessionId((currentSessionId) => {
          if (currentSessionId && nextSessions.some((session) => session.sessionId === currentSessionId)) {
            return currentSessionId;
          }

          return nextSessions[0]?.sessionId ?? "";
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setNativeAttendanceSessions([]);
        setSelectedNativeAttendanceSessionId("");
        setNativeAttendanceDetail(null);
        setNativeAttendanceDraft({});
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load native attendance sessions."
        );
      } finally {
        if (isActive) {
          setIsLoadingNativeAttendanceSessions(false);
        }
      }
    };

    void loadNativeAttendanceSessions();

    return () => {
      isActive = false;
    };
  }, [canAccessWorkspace, normalizedSelectedSeason, plannerMode, selectedSeason]);

  useEffect(() => {
    if (!selectedNativeAttendanceSessionId || plannerMode !== "friendly") {
      setNativeAttendanceDetail(null);
      setNativeAttendanceDraft({});
      setIsLoadingNativeAttendanceDetail(false);
      return;
    }

    let isActive = true;

    const loadNativeAttendanceDetail = async () => {
      try {
        setIsLoadingNativeAttendanceDetail(true);
        const nextDetail = await getPlannerAttendanceSessionDetail(selectedNativeAttendanceSessionId);

        if (!isActive) {
          return;
        }

        setNativeAttendanceDetail(nextDetail);
        setNativeAttendanceDraft(
          nextDetail.members.reduce<Record<string, AttendanceAvailabilityState>>((result, member) => {
            result[member.memberId] = member.availability;
            return result;
          }, {})
        );
        setPendingNativeAttendanceDate(nextDetail.session.weekendDate);
        setSelectedMatchCount(nextDetail.session.matchCount);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setNativeAttendanceDetail(null);
        setNativeAttendanceDraft({});
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load the selected native attendance session."
        );
      } finally {
        if (isActive) {
          setIsLoadingNativeAttendanceDetail(false);
        }
      }
    };

    void loadNativeAttendanceDetail();

    return () => {
      isActive = false;
    };
  }, [plannerMode, selectedNativeAttendanceSessionId]);

  const nativeAttendanceAvailableMemberIds = useMemo(() => {
    if (!nativeAttendanceDetail) {
      return [] as string[];
    }

    return nativeAttendanceDetail.members
      .filter((member) => (nativeAttendanceDraft[member.memberId] ?? member.availability) === "available")
      .map((member) => member.memberId);
  }, [nativeAttendanceDetail, nativeAttendanceDraft]);

  const nativeAttendanceAvailableNames = useMemo(() => {
    if (!nativeAttendanceDetail) {
      return [] as string[];
    }

    return nativeAttendanceDetail.members
      .filter((member) => (nativeAttendanceDraft[member.memberId] ?? member.availability) === "available")
      .map((member) => member.name);
  }, [nativeAttendanceDetail, nativeAttendanceDraft]);

  const nativeAttendanceSummary = useMemo(() => {
    if (!nativeAttendanceDetail) {
      return {
        available: 0,
        maybe: 0,
        notAvailable: 0
      };
    }

    return nativeAttendanceDetail.members.reduce(
      (result, member) => {
        const availability = nativeAttendanceDraft[member.memberId] ?? member.availability;

        if (availability === "available") {
          result.available += 1;
        } else if (availability === "maybe") {
          result.maybe += 1;
        } else {
          result.notAvailable += 1;
        }

        return result;
      },
      {
        available: 0,
        maybe: 0,
        notAvailable: 0
      }
    );
  }, [nativeAttendanceDetail, nativeAttendanceDraft]);

  const hasUnsavedNativeAttendanceChanges = useMemo(() => {
    if (!nativeAttendanceDetail) {
      return false;
    }

    return nativeAttendanceDetail.members.some((member) => {
      const draftAvailability = nativeAttendanceDraft[member.memberId] ?? member.availability;
      return draftAvailability !== member.availability;
    });
  }, [nativeAttendanceDetail, nativeAttendanceDraft]);

  const nativeAttendanceStatusLabel = useMemo(() => {
    if (!nativeAttendanceDetail) {
      return null;
    }

    return hasUnsavedNativeAttendanceChanges ? "Unsaved attendance changes" : "Attendance saved";
  }, [hasUnsavedNativeAttendanceChanges, nativeAttendanceDetail]);

  const selectedFriendlyWeekend = useMemo(() => {
    if (!nativeAttendanceDetail) {
      return null;
    }

    return {
      id: nativeAttendanceDetail.session.sessionId,
      label: nativeAttendanceDetail.session.weekendLabel,
      isoDate: nativeAttendanceDetail.session.weekendDate,
      sourceColumn: "NATIVE",
      availableNames: nativeAttendanceAvailableNames
    };
  }, [nativeAttendanceAvailableNames, nativeAttendanceDetail]);

  const friendlyBaseSuggestion = useMemo(() => {
    if (players.length === 0) {
      return null;
    }

    if (!nativeAttendanceDetail) {
      return null;
    }

    return buildPlannerSuggestionFromMembers(
      players,
      nativeAttendanceAvailableMemberIds,
      nativeAttendanceDetail.session.matchCount,
      undefined,
      undefined,
      "friendly"
    );
  }, [
    nativeAttendanceAvailableMemberIds,
    nativeAttendanceDetail,
    players
  ]);

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

  const handleCreateNativeAttendanceSession = async () => {
    if (!pendingNativeAttendanceDate) {
      setErrorMessage("Choose an attendance date before creating the native attendance session.");
      return;
    }

    try {
      setIsCreatingNativeAttendanceSession(true);
      setErrorMessage(null);

      const createdSession = await createPlannerAttendanceSession({
        season: normalizedSelectedSeason,
        weekendDate: pendingNativeAttendanceDate,
        matchCount: selectedMatchCount
      });

      const nextSessions = await getPlannerAttendanceSessions(normalizedSelectedSeason);

      setNativeAttendanceSessions(nextSessions);
      setSelectedNativeAttendanceSessionId(createdSession.session.sessionId);
      setNativeAttendanceDetail(createdSession);
      setNativeAttendanceDraft(
        createdSession.members.reduce<Record<string, AttendanceAvailabilityState>>((result, member) => {
          result[member.memberId] = member.availability;
          return result;
        }, {})
      );
      setSaveSuccessMessage(`Created the native attendance session for ${createdSession.session.weekendLabel}.`);
      setGeneratedSuggestion(null);
      setGeneratedMode(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create the native attendance session."
      );
    } finally {
      setIsCreatingNativeAttendanceSession(false);
    }
  };

  const handleNativeAttendanceStateChange = (memberId: string, availability: AttendanceAvailabilityState) => {
    setNativeAttendanceDraft((current) => ({
      ...current,
      [memberId]: availability
    }));
    setGeneratedSuggestion(null);
    setGeneratedMode(null);
  };

  const saveCurrentNativeAttendance = async () => {
    if (!nativeAttendanceDetail) {
      setErrorMessage("Choose a native attendance session before saving availability.");
      return null;
    }

    if (nativeAttendanceSummary.available < 8) {
      setErrorMessage("Mark at least 8 players as available before saving attendance.");
      return null;
    }

    const savedDetail = await savePlannerAttendanceAvailability({
      sessionId: nativeAttendanceDetail.session.sessionId,
      updates: nativeAttendanceDetail.members.map((member) => ({
        memberId: member.memberId,
        availability: nativeAttendanceDraft[member.memberId] ?? member.availability
      }))
    });

    setNativeAttendanceDetail(savedDetail);
    setNativeAttendanceDraft(
      savedDetail.members.reduce<Record<string, AttendanceAvailabilityState>>((result, member) => {
        result[member.memberId] = member.availability;
        return result;
      }, {})
    );

    const nextSessions = await getPlannerAttendanceSessions(normalizedSelectedSeason);
    setNativeAttendanceSessions(nextSessions);

    return savedDetail;
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

  const handleFriendlyGenerate = async () => {
    try {
      setErrorMessage(null);
      if (!nativeAttendanceDetail) {
        setErrorMessage("Create or choose a native attendance session before generating the friendly matchday plans.");
        return;
      }

      const nextSuggestion = await buildPlannerSuggestionForReleaseFromMembers(
        players,
        nativeAttendanceAvailableMemberIds,
        nativeAttendanceDetail.session.matchCount,
        undefined,
        selectedFriendlyWicketKeeperId || undefined,
        "friendly",
        buildFriendlyMatchAvailabilityOverrides(
          manualFriendlyMatchAvailability,
          nativeAttendanceDetail.session.matchCount
        ),
        normalizedSelectedSeason ?? undefined
      );

      setGeneratedSuggestion(nextSuggestion);
      setGeneratedMode("friendly");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not generate the friendly planner."
      );
      setGeneratedSuggestion(null);
      setGeneratedMode(null);
    }
  };

  const handleFriendlySave = async () => {
    if (!selectedFriendlyWeekend || !activeSuggestion || generatedMode !== "friendly") {
      setErrorMessage("Generate the friendly planner first before saving the matchday plan.");
      return;
    }

    setIsSavingFriendlyPlan(true);
    setErrorMessage(null);

    try {
      if (hasUnsavedNativeAttendanceChanges) {
        const savedAttendanceDetail = await saveCurrentNativeAttendance();

        if (!savedAttendanceDetail) {
          return;
        }
      }

      const savedBatch = await saveFriendlyPlannerBatch({
        season: normalizedSelectedSeason,
        attendanceWorkbookName: null,
        attendanceSessionId: selectedNativeAttendanceSessionId || null,
        weekend: selectedFriendlyWeekend,
        suggestion: activeSuggestion,
        preferredWicketKeeperPlayerId: selectedFriendlyWicketKeeperId || null,
        matchAvailabilityOverrides: buildFriendlyMatchAvailabilityOverrides(
          manualFriendlyMatchAvailability,
          activeSuggestion.matchPlans.length
        )
      });

      setSaveSuccessMessage(
        `Saved the friendly matchday plan for ${selectedFriendlyWeekend.label} with ${savedBatch.savedAssignments} tracked assignments.`
      );
      resetPlannerWorkspace("friendly");
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

  const renderSuggestion = (
    plannerSuggestion: PlannerSuggestion,
    mode: PlannerMode
  ) => {
    const unavailableHeading = mode === "friendly" ? "Not Available This Week" : "Not Included For Tournament";
    const unavailableDescription = mode === "friendly"
      ? "Squad players who did not mark themselves available in the current attendance session, including no response or explicit unavailability."
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
              helper={
                mode === "friendly"
                  ? "Marked available in the native attendance session"
                  : "Manually confirmed for the tournament matchday"
              }
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
              helper={
                mode === "friendly"
                  ? "Native attendance uses direct member selection"
                  : "Not used in tournament mode"
              }
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
                    <Chip key={player.id} label={formatName(player.name)} variant="outlined" />
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
                      label={formatName(player.name)}
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
                value={selectedSeasonValue}
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
                  <CardActionArea onClick={() => resetPlannerWorkspace("friendly")} sx={{ borderRadius: 3 }}>
                    <CardContent sx={{ p: 3 }}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <SportsCricketRoundedIcon color="primary" />
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            Friendly Matches
                          </Typography>
                          <Tooltip
                            title="Friendly planning uses native attendance, manual wicket keeper selection, and reshuffling across up to 3 matches."
                            arrow
                          >
                            <Box
                              component="span"
                              sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                color: "text.secondary"
                              }}
                            >
                              <InfoOutlinedIcon fontSize="small" />
                            </Box>
                          </Tooltip>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Create or update the in-app attendance session, confirm the match count, and generate reshuffled Playing XI and 12th-man plans for the day.
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          <Chip label="Native attendance only" color="warning" variant="outlined" />
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
                  <CardActionArea onClick={() => resetPlannerWorkspace("tournament")} sx={{ borderRadius: 3 }}>
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

            {isLoadingPlayers ? (
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
                  <Grid size={{ xs: 12, lg: 12 }}>
                    <Card variant="outlined" sx={{ borderRadius: 3 }}>
                      <CardContent sx={{ p: 3 }}>
                        <Stack spacing={2.5}>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <EventAvailableRoundedIcon color="primary" />
                            <Typography variant="h5" sx={{ fontWeight: 800 }}>
                              Friendly Availability
                            </Typography>
                          </Stack>

                          <Typography variant="body2" color="text.secondary">
                            Native attendance is now the standard source of truth for friendly availability. Create a session, update attendance, and generate the matchday plan from the same workspace.
                          </Typography>

                          <Stack spacing={2}>
                              <Box
                                sx={{
                                  display: "grid",
                                  gap: 1.5,
                                  gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "repeat(2, minmax(0, 1fr))",
                                    lg: "repeat(5, minmax(0, 1fr))"
                                  },
                                  alignItems: "end"
                                }}
                              >
                                <Box>
                                  <TextField
                                    type="date"
                                    size="small"
                                    fullWidth
                                    label="Attendance Date"
                                    InputLabelProps={{ shrink: true }}
                                    value={pendingNativeAttendanceDate}
                                    onChange={(event) => setPendingNativeAttendanceDate(event.target.value)}
                                  />
                                </Box>

                                <Box>
                                  <FormControl size="small" fullWidth>
                                    <InputLabel id="planner-native-match-count-label">Matches / Day</InputLabel>
                                    <Select
                                      labelId="planner-native-match-count-label"
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
                                </Box>

                                <Box>
                                  <FormControl size="small" fullWidth>
                                    <InputLabel id="planner-native-wk-label">Wicket Keeper</InputLabel>
                                    <Select
                                      labelId="planner-native-wk-label"
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
                                          {formatName(player.name)}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Box>

                                <Box>
                                  <Button
                                    variant="contained"
                                    onClick={handleCreateNativeAttendanceSession}
                                    disabled={!pendingNativeAttendanceDate || isCreatingNativeAttendanceSession}
                                    startIcon={isCreatingNativeAttendanceSession ? <CircularProgress size={16} color="inherit" /> : <EventAvailableRoundedIcon />}
                                    sx={{ width: "100%" }}
                                  >
                                    Create Session
                                  </Button>
                                </Box>
                              </Box>

                              {isLoadingNativeAttendanceSessions && (
                                <Alert severity="info" variant="outlined">
                                  Loading native attendance sessions...
                                </Alert>
                              )}

                              {!isLoadingNativeAttendanceSessions && nativeAttendanceSessions.length === 0 && (
                                <Alert severity="info" variant="outlined">
                                  No native attendance sessions exist yet for this season. Create one to record availability directly in the app.
                                </Alert>
                              )}

                              {nativeAttendanceDetail && (
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
                                    <Stack
                                      direction={{ xs: "column", md: "row" }}
                                      spacing={1}
                                      justifyContent="space-between"
                                      alignItems={{ xs: "flex-start", md: "center" }}
                                    >
                                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                        {nativeAttendanceDetail.session.weekendLabel}
                                      </Typography>
                                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                        {nativeAttendanceStatusLabel ? (
                                          <Chip
                                            label={nativeAttendanceStatusLabel}
                                            color={hasUnsavedNativeAttendanceChanges ? "warning" : "success"}
                                            variant="filled"
                                          />
                                        ) : null}
                                        <Chip label={`${nativeAttendanceSummary.available} available`} color="success" variant="outlined" />
                                        <Chip label={`${nativeAttendanceSummary.maybe} maybe`} color="warning" variant="outlined" />
                                        <Chip label={`${nativeAttendanceSummary.notAvailable} not available`} variant="outlined" />
                                      </Stack>
                                    </Stack>

                                    {isLoadingNativeAttendanceDetail ? (
                                      <Box sx={{ py: 2, display: "flex", justifyContent: "center" }}>
                                        <CircularProgress size={24} />
                                      </Box>
                                    ) : (
                                      <Stack spacing={0}>
                                        {nativeAttendanceDetail.members.map((member) => (
                                          <Box
                                            key={`native-attendance-${member.memberId}`}
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
                                            <Grid container spacing={1.5} alignItems="center">
                                              <Grid size={{ xs: 12, md: 5 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                  {member.name}
                                                </Typography>
                                              </Grid>
                                              <Grid size={{ xs: 12, md: 7 }}>
                                                <Box
                                                  sx={{
                                                    display: "grid",
                                                    gap: 1,
                                                    alignItems: "center",
                                                    gridTemplateColumns: {
                                                      xs: "1fr",
                                                      lg: "minmax(220px, 280px) minmax(0, 1fr)"
                                                    }
                                                  }}
                                                >
                                                  <FormControl size="small" fullWidth>
                                                    <InputLabel id={`attendance-state-${member.memberId}`}>Availability</InputLabel>
                                                    <Select
                                                      labelId={`attendance-state-${member.memberId}`}
                                                      value={nativeAttendanceDraft[member.memberId] ?? member.availability}
                                                      label="Availability"
                                                      onChange={(event) =>
                                                        handleNativeAttendanceStateChange(
                                                          member.memberId,
                                                          event.target.value as AttendanceAvailabilityState
                                                        )
                                                      }
                                                    >
                                                      <MenuItem value="available">Available</MenuItem>
                                                      <MenuItem value="maybe">Maybe</MenuItem>
                                                      <MenuItem value="not_available">Not Available</MenuItem>
                                                    </Select>
                                                  </FormControl>

                                                  {(() => {
                                                    const attendanceIdentityId = member.playerId ?? member.memberId;
                                                    const memberAvailability =
                                                      nativeAttendanceDraft[member.memberId] ?? member.availability;

                                                    if (memberAvailability !== "available") {
                                                      return null;
                                                    }

                                                    const matchSlots = nativeAttendanceDetail.session.matchCount;
                                                    const playerMatchAvailability =
                                                      manualFriendlyMatchAvailability[attendanceIdentityId]
                                                      ?? Array.from({ length: matchSlots }, () => true);
                                                    const isFullDayAvailable = playerMatchAvailability.every(Boolean);

                                                    return (
                                                      <Box
                                                        sx={{
                                                          width: "100%",
                                                          borderRadius: 999,
                                                          border: "1px solid",
                                                          borderColor: "divider",
                                                          bgcolor: "rgba(255,255,255,0.02)",
                                                          px: 1,
                                                          py: 0.75,
                                                          minHeight: 40,
                                                          display: "flex",
                                                          alignItems: "center",
                                                          justifyContent: "flex-start",
                                                          "@media (min-width:1200px)": {
                                                            border: "none",
                                                            bgcolor: "transparent",
                                                            px: 0,
                                                            py: 0,
                                                            minHeight: "auto"
                                                          }
                                                        }}
                                                      >
                                                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                                                          <Chip
                                                            label="All Day"
                                                            clickable
                                                            size="small"
                                                            color={isFullDayAvailable ? "success" : "default"}
                                                            variant={isFullDayAvailable ? "filled" : "outlined"}
                                                            onClick={() => setFriendlyFullDayAvailability(attendanceIdentityId)}
                                                          />
                                                          {Array.from({ length: matchSlots }, (_, index) => (
                                                            <Chip
                                                              key={`${attendanceIdentityId}-native-match-${index + 1}`}
                                                              label={`M${index + 1}`}
                                                              clickable
                                                              size="small"
                                                              color={(playerMatchAvailability[index] ?? true) ? "success" : "default"}
                                                              variant={(playerMatchAvailability[index] ?? true) ? "filled" : "outlined"}
                                                              onClick={() => toggleFriendlyMatchAvailability(attendanceIdentityId, index)}
                                                            />
                                                          ))}
                                                        </Stack>
                                                      </Box>
                                                    );
                                                  })()}
                                                </Box>
                                              </Grid>
                                            </Grid>
                                          </Box>
                                        ))}
                                      </Stack>
                                    )}
                                  </Stack>
                                </Box>
                              )}
                            </Stack>

                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                            <Button
                              variant="contained"
                              onClick={handleFriendlyGenerate}
                              disabled={!nativeAttendanceDetail}
                              startIcon={<Groups2RoundedIcon />}
                              sx={{ width: { xs: "100%", sm: "fit-content" } }}
                            >
                              Generate Friendly Matchday Plans
                            </Button>
                            <Button
                              variant="outlined"
                              color="secondary"
                              onClick={handleFriendlySave}
                              disabled={
                                !selectedFriendlyWeekend
                                || !activeSuggestion
                                || isSavingFriendlyPlan
                              }
                              startIcon={
                                isSavingFriendlyPlan
                                  ? <CircularProgress size={16} color="inherit" />
                                  : <SaveRoundedIcon />
                              }
                              sx={{ width: { xs: "100%", sm: "fit-content" } }}
                            >
                              Save Matchday Plan
                            </Button>
                            <Button
                              variant="text"
                              color="inherit"
                              onClick={() => resetPlannerWorkspace("friendly")}
                              startIcon={<RestartAltRoundedIcon />}
                              sx={{ width: { xs: "100%", sm: "fit-content" } }}
                            >
                              Reset Planner
                            </Button>
                          </Stack>
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
                        Manually choose the players available for the tournament. The generator will build one final Playing XI and one 12th man from the selected pool using player performance signals, while profile preferences remain descriptive only.
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
                        <Button
                          variant="text"
                          color="inherit"
                          onClick={() => resetPlannerWorkspace("tournament")}
                          startIcon={<RestartAltRoundedIcon />}
                          sx={{ width: { xs: "100%", md: "fit-content" } }}
                        >
                          Reset Planner
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
                            Click a player to include or exclude them from the tournament squad pool. Final selection is based on match performance and output, not on the player&apos;s preferred role in their profile.
                          </Typography>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            {players.map((player) => {
                              const isSelected = manualTournamentAvailability[player.id] ?? false;

                              return (
                                <Chip
                                  key={player.id}
                                  label={formatName(player.name)}
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
                ) : manualTournamentSelectedCount >= 11 ? (
                  <Alert severity="info" variant="outlined">
                    Generate the tournament squad to review the final Playing XI and 12th man.
                  </Alert>
                ) : null}
              </Stack>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
