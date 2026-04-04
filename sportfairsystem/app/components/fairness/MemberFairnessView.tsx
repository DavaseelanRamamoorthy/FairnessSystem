"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import { useAuth } from "@/app/context/AuthContext";
import { useActiveTeamBranding } from "@/app/layout/useActiveTeamBranding";
import { canAccessFairnessWorkspace } from "@/app/services/accessControlService";
import { formatName } from "@/app/services/formatname";
import {
  getCurrentMemberFairnessSnapshot,
  getPlannerFairnessMemberSnapshot,
  PlannerFairnessAlert,
  PlannerFairnessHistoryEntry,
  PlannerFairnessMemberSnapshot,
  PlannerFairnessPlayerSummary
} from "@/app/services/plannerFairnessService";
import { getPlayerSeasons, SeasonOption } from "@/app/services/playerProfileService";
import { getLatestSeasonValue } from "@/app/utils/seasonSelection";
import { readStoredSeasonFilter, storeSeasonFilter } from "@/app/utils/seasonFilterStorage";

const MEMBER_FAIRNESS_SEASON_STORAGE_KEY = "sportfairsystem:season-filter:my-fairness";

const headerActionButtonSx = {
  color: "#FFFFFF",
  borderColor: alpha("#FFFFFF", 0.26),
  backgroundColor: alpha("#FFFFFF", 0.06),
  "&:hover": {
    borderColor: alpha("#FFFFFF", 0.4),
    backgroundColor: alpha("#FFFFFF", 0.12)
  }
} as const;

type MemberFairnessViewProps = {
  mode: "self" | "leadership";
  memberId?: string;
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

function EmptyStateMessage({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ px: 1, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
    </Box>
  );
}

function buildFairnessRoleLabel(player: PlannerFairnessPlayerSummary) {
  const tags = [
    player.isCaptain ? "C" : null,
    player.isWicketKeeper ? "WK" : null
  ].filter(Boolean);

  return tags.length > 0 ? `${formatName(player.name)} - ${tags.join(", ")}` : formatName(player.name);
}

function buildFairnessHistoryLabel(entry: PlannerFairnessHistoryEntry) {
  const plannedMatches = entry.availableMatchCount;

  if (plannedMatches <= 0) {
    return "Unavailable for this week.";
  }

  if (entry.pendingMatchCount === plannedMatches) {
    return `Planned for ${plannedMatches} match${plannedMatches > 1 ? "es" : ""}. Actual scorecards are still pending.`;
  }

  if (entry.pendingMatchCount > 0) {
    return `Used in ${entry.xiCount} of ${plannedMatches} planned match${plannedMatches > 1 ? "es" : ""} so far. ${entry.pendingMatchCount} match result${entry.pendingMatchCount > 1 ? "s are" : " is"} still pending.`;
  }

  if (entry.xiCount === plannedMatches) {
    return `Used in all ${plannedMatches} planned match${plannedMatches > 1 ? "es" : ""}.`;
  }

  if (entry.xiCount > 0) {
    return `Used in ${entry.xiCount} of ${plannedMatches} planned match${plannedMatches > 1 ? "es" : ""}.`;
  }

  if (entry.twelfthCount > 0) {
    return `Planned for ${plannedMatches} match${plannedMatches > 1 ? "es" : ""}, but stayed as 12th man.`;
  }

  if (entry.benchCount > 0) {
    return `Planned for ${plannedMatches} match${plannedMatches > 1 ? "es" : ""}, but stayed on the bench.`;
  }

  return `Planned for ${plannedMatches} match${plannedMatches > 1 ? "es" : ""}, with no tracked XI use recorded.`;
}

function buildFairnessHistorySummaryLabel(entry: PlannerFairnessHistoryEntry) {
  if (entry.availableMatchCount <= 0) {
    return "Unavailable";
  }

  if (entry.pendingMatchCount === entry.availableMatchCount) {
    return `Planned for ${entry.availableMatchCount} match${entry.availableMatchCount > 1 ? "es" : ""}`;
  }

  if (entry.pendingMatchCount > 0) {
    return `${entry.pendingMatchCount} result${entry.pendingMatchCount > 1 ? "s" : ""} pending`;
  }

  return `Available for ${entry.availableMatchCount} match${entry.availableMatchCount > 1 ? "es" : ""}`;
}

function stripLeadingPlayerNameFromAlert(alert: PlannerFairnessAlert) {
  const message = alert.message.trim();
  const formattedName = formatName(alert.playerName);

  if (message.startsWith(formattedName)) {
    return message.slice(formattedName.length).trimStart();
  }

  if (typeof alert.playerName === "string" && message.startsWith(alert.playerName)) {
    return message.slice(alert.playerName.length).trimStart();
  }

  return message;
}

export default function MemberFairnessView({
  mode,
  memberId
}: MemberFairnessViewProps) {
  const router = useRouter();
  const { isAuthenticated, profile } = useAuth();
  const { teamName } = useActiveTeamBranding();
  const [canSeeLeadership, setCanSeeLeadership] = useState(false);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(() => readStoredSeasonFilter(MEMBER_FAIRNESS_SEASON_STORAGE_KEY) ?? "");
  const [hasResolvedSeason, setHasResolvedSeason] = useState(false);
  const [snapshot, setSnapshot] = useState<PlannerFairnessMemberSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadSeasons = async () => {
      try {
        const nextSeasons = await getPlayerSeasons();

        if (!isActive) {
          return;
        }

        setSeasons(nextSeasons);
        const storedSeason = readStoredSeasonFilter(MEMBER_FAIRNESS_SEASON_STORAGE_KEY);
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
      storeSeasonFilter(MEMBER_FAIRNESS_SEASON_STORAGE_KEY, selectedSeason);
    }
  }, [selectedSeason]);

  useEffect(() => {
    let isActive = true;

    if (mode !== "self" || !isAuthenticated) {
      setCanSeeLeadership(false);
      return () => {
        isActive = false;
      };
    }

    const loadLeadershipVisibility = async () => {
      try {
        const nextVisibility = await canAccessFairnessWorkspace();

        if (isActive) {
          setCanSeeLeadership(nextVisibility);
        }
      } catch {
        if (isActive) {
          setCanSeeLeadership(false);
        }
      }
    };

    void loadLeadershipVisibility();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, mode]);

  useEffect(() => {
    let isActive = true;

    const loadSnapshot = async () => {
      if (!isAuthenticated || !hasResolvedSeason) {
        return;
      }

      if (mode === "leadership" && !memberId) {
        setSnapshot(null);
        setErrorMessage("No member was selected for fairness detail.");
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const normalizedSeason = !selectedSeason || selectedSeason === "all" ? undefined : selectedSeason;
        const nextSnapshot = mode === "self"
          ? await getCurrentMemberFairnessSnapshot(normalizedSeason)
          : await getPlannerFairnessMemberSnapshot(memberId as string, normalizedSeason);

        if (isActive) {
          setSnapshot(nextSnapshot);
        }
      } catch (error) {
        if (isActive) {
          setSnapshot(null);
          setErrorMessage(error instanceof Error ? error.message : "Could not load fairness detail.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadSnapshot();

    return () => {
      isActive = false;
    };
  }, [hasResolvedSeason, isAuthenticated, memberId, mode, selectedSeason]);

  const member = snapshot?.member ?? null;
  const quotaProgressValue = useMemo(() => {
    if (!member) {
      return 0;
    }

    return Math.min(100, Math.round((member.xiCount / 5) * 100));
  }, [member]);
  const pageTitle = mode === "self"
    ? "My Fairness"
    : member
      ? `${formatName(member.name)} Fairness`
      : "Member Fairness";
  const pageDescription = mode === "self"
    ? "Your member-only fairness history for available weeks, actual XI chances, bench outcomes, and quota progress."
    : "Leadership-only fairness detail for one member, focused on their own history without opening the full team workspace.";

  return (
    <Container maxWidth="lg">
      <Stack spacing={4}>
        <TeamPageHeader
          eyebrow="Fairness"
          title={pageTitle}
          description={pageDescription}
          action={(
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              {mode === "self" && canSeeLeadership ? (
                <ToggleButtonGroup
                  exclusive
                  value="mine"
                  onChange={(_event, nextValue) => {
                    if (nextValue === "team") {
                      router.push("/fairness");
                    }
                  }}
                >
                  <ToggleButton value="team">Team View</ToggleButton>
                  <ToggleButton value="mine">My View</ToggleButton>
                </ToggleButtonGroup>
              ) : null}

              <FormControl size="small">
                <InputLabel id={`${mode}-fairness-season-label`}>Season</InputLabel>
                <Select
                  labelId={`${mode}-fairness-season-label`}
                  label="Season"
                  value={selectedSeason}
                  onChange={(event) => setSelectedSeason(event.target.value)}
                >
                  <MenuItem value="all">All Seasons</MenuItem>
                  {seasons.map((season) => (
                    <MenuItem key={`${mode}-season-${season.value}`} value={season.value}>
                      {season.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {mode === "leadership" ? (
                <Button
                  component={Link}
                  href="/fairness"
                  variant="outlined"
                  startIcon={<ArrowBackRoundedIcon />}
                  sx={headerActionButtonSx}
                >
                  Back to Fairness
                </Button>
              ) : null}

              {mode === "self" && canSeeLeadership ? (
                null
              ) : null}
            </Stack>
          )}
        />

        {mode === "self" && profile?.teamId && !profile?.playerId && (
          <Alert severity="info" variant="outlined">
            Your self-view resolves from your logged-in team membership. A linked squad player still helps match historical scorecards more accurately.
          </Alert>
        )}

        {errorMessage ? (
          <Alert severity="error">{errorMessage}</Alert>
        ) : null}

        {isLoading ? (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={1.5}
            sx={{ minHeight: 280 }}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading fairness detail...
            </Typography>
          </Stack>
        ) : member ? (
          <Stack spacing={3}>
            <Card variant="outlined" sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2.5}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                  >
                    <Stack spacing={1}>
                      <Typography variant="h4" sx={{ fontWeight: 800 }}>
                        {buildFairnessRoleLabel(member)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {teamName} fairness history based on saved matchdays and authentic participation reconciliation when linked scorecards exist.
                      </Typography>
                    </Stack>

                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip
                        label={member.xiCount >= 5 ? "Quota Complete" : `${member.quotaRemaining} XI to go`}
                        color={member.xiCount >= 5 ? "success" : member.xiCount === 0 ? "warning" : "default"}
                        variant={member.xiCount >= 5 ? "filled" : "outlined"}
                      />
                      <Chip
                        label={`${snapshot?.savedMatchdays ?? 0} upcoming match${(snapshot?.savedMatchdays ?? 0) === 1 ? "" : "es"}`}
                        variant="outlined"
                      />
                      {mode === "leadership" ? (
                        <Chip label="Leadership Detail" color="primary" variant="outlined" />
                      ) : null}
                    </Stack>
                  </Stack>

                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2" color="text.secondary">
                        Quota Progress
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {member.xiCount}/5 XI
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={quotaProgressValue}
                      sx={{ height: 10, borderRadius: 999 }}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                <MetricCard
                  label="Available Weeks"
                  value={member.availableMatchdays}
                  helper="Saved matchdays where you were available for selection."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                <MetricCard
                  label="Actual XI Chances"
                  value={member.xiCount}
                  helper="Actual XI appearances counted from linked scorecards when available, otherwise saved XI assignments."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                <MetricCard
                  label="12th Count"
                  value={member.twelfthCount}
                  helper="Saved or reconciled 12th-man outcomes in the tracked history."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                <MetricCard
                  label="Bench Count"
                  value={member.benchCount}
                  helper="Tracked bench outcomes across saved matchdays."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                <MetricCard
                  label="Unavailable Count"
                  value={member.unavailableCount}
                  helper="Saved matchday outcomes marked unavailable."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                <MetricCard
                  label="Quota Progress"
                  value={`${member.xiCount}/5`}
                  helper={member.xiCount >= 5 ? "You have reached the current XI baseline." : `${member.quotaRemaining} more XI opportunities to reach the baseline.`}
                />
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, lg: 7 }}>
                <Card variant="outlined" sx={{ borderRadius: 4, height: "100%" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        Recent Week-by-Week History
                      </Typography>
                      {member.recentHistory.length === 0 ? (
                        <EmptyStateMessage>
                          No saved matchday history is available yet for this member in the selected season.
                        </EmptyStateMessage>
                      ) : (
                        <Stack spacing={1.25}>
                          {member.recentHistory.map((entry) => (
                            <Card key={`${member.memberId}-${entry.batchId}`} variant="outlined" sx={{ borderRadius: 3 }}>
                              <CardContent sx={{ p: 2.25 }}>
                                <Stack spacing={1.25}>
                                  <Stack
                                    direction={{ xs: "column", sm: "row" }}
                                    spacing={1}
                                    justifyContent="space-between"
                                    alignItems={{ xs: "flex-start", sm: "center" }}
                                  >
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                      {entry.weekendLabel}
                                    </Typography>
                                    <Chip
                                      label={buildFairnessHistorySummaryLabel(entry)}
                                      size="small"
                                      variant="outlined"
                                    />
                                  </Stack>
                                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                    <Chip
                                      label={entry.pendingMatchCount === entry.availableMatchCount ? `Planned XI ${entry.plannedXiCount}` : `XI ${entry.xiCount}`}
                                      size="small"
                                      color="primary"
                                      variant="outlined"
                                    />
                                    <Chip
                                      label={entry.pendingMatchCount === entry.availableMatchCount ? `Planned 12th ${entry.plannedTwelfthCount}` : `12th ${entry.twelfthCount}`}
                                      size="small"
                                      variant="outlined"
                                    />
                                    <Chip
                                      label={entry.pendingMatchCount === entry.availableMatchCount ? `Planned Bench ${entry.plannedBenchCount}` : `Bench ${entry.benchCount}`}
                                      size="small"
                                      variant="outlined"
                                    />
                                    {entry.pendingMatchCount > 0 && entry.pendingMatchCount !== entry.availableMatchCount ? (
                                      <Chip label={`Pending ${entry.pendingMatchCount}`} size="small" color="warning" variant="outlined" />
                                    ) : null}
                                    <Chip label={`Unavailable ${entry.unavailableCount}`} size="small" variant="outlined" />
                                  </Stack>
                                  <Typography variant="body2" color="text.secondary">
                                    {buildFairnessHistoryLabel(entry)}
                                  </Typography>
                                </Stack>
                              </CardContent>
                            </Card>
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, lg: 5 }}>
                <Card variant="outlined" sx={{ borderRadius: 4, height: "100%" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        {mode === "self" ? "My Fairness Notes" : "Member Fairness Notes"}
                      </Typography>
                      {snapshot?.alerts.length ? (
                        <Stack spacing={1.25}>
                          {snapshot.alerts.map((alert) => (
                            <Alert
                              key={alert.id}
                              severity={alert.severity}
                              variant="outlined"
                            >
                              {stripLeadingPlayerNameFromAlert(alert)}
                            </Alert>
                          ))}
                        </Stack>
                      ) : (
                        <EmptyStateMessage>
                          No active fairness warnings are attached to this member in the selected season.
                        </EmptyStateMessage>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Stack>
        ) : (
          <Card variant="outlined" sx={{ borderRadius: 4 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={1.5}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  No Fairness History Yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {mode === "self"
                    ? "Your logged-in membership does not have fairness history for the selected season yet. Once saved matchdays are tracked for your member record, this page will show your XI, 12th, bench, unavailable, and quota progress."
                    : "This member does not have fairness history for the selected season yet."}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
