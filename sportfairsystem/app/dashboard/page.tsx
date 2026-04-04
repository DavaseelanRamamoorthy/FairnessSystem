"use client";

import { useEffect, useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";

import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SportsCricketIcon from "@mui/icons-material/SportsCricket";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";

import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import ResponsiveTableContainer from "@/app/components/common/ResponsiveTableContainer";
import {
  numericTableCellSx,
  numericTableHeadCellSx
} from "@/app/components/common/tableCellStyles";
import DashboardCard from "@/app/components/dashboard/dashboardCard";
import OpportunityTrendChart from "@/app/components/dashboard/OpportunityTrendChart";
import RunsTrendChart from "@/app/components/dashboard/RunsTrendChart";
import SectionHeader from "@/app/components/dashboard/SectionHeader";
import WicketsTrendChart from "@/app/components/dashboard/WicketsTrendChart";
import { useAuth } from "@/app/context/AuthContext";
import {
  getCurrentTeamMembershipAccess,
  getCurrentWorkspaceAccessSnapshot
} from "@/app/services/accessControlService";
import { DashboardFairnessStatus } from "@/app/services/fairnessSummaryService";
import { formatName } from "@/app/services/formatname";
import {
  getOrganiserDashboardData,
  OrganiserDashboardData
} from "@/app/services/organiserDashboardService";
import {
  getPlayerDashboardData,
  PlayerDashboardData
} from "@/app/services/playerDashboardService";
import { formatDate } from "@/app/utils/formatDate";

type DashboardMode = "team" | "mine";

type DashboardAccessState = {
  hasTeam: boolean;
  hasMember: boolean;
  canToggleTeamView: boolean;
};

function SummaryMetricCard({
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

function getResultChip(match: { result: string | null; resultSummary?: string | null }) {
  const rawResult = typeof match.result === "string" ? match.result.trim() : "";
  const normalizedResult = rawResult.toLowerCase();
  const summary = typeof match.resultSummary === "string"
    ? match.resultSummary.trim().toLowerCase()
    : "";

  if (normalizedResult === "won") {
    return { label: "Won", color: "success" as const };
  }

  if (normalizedResult === "lost") {
    return { label: "Lost", color: "error" as const };
  }

  if (normalizedResult === "draw" || summary.includes("draw")) {
    return { label: "Draw", color: "warning" as const };
  }

  if (normalizedResult === "tie" || summary.includes("tie")) {
    return { label: "Tie", color: "info" as const };
  }

  if (rawResult) {
    return { label: rawResult, color: "default" as const };
  }

  if (match.resultSummary) {
    return { label: match.resultSummary, color: "default" as const };
  }

  return null;
}

function getDisplayFirstName(name: string) {
  return formatName(name).split(/\s+/)[0] ?? formatName(name);
}

function getFairnessChipColor(status: DashboardFairnessStatus) {
  switch (status) {
    case "Balanced":
      return "success" as const;
    case "Underused":
      return "warning" as const;
    case "Overused":
      return "error" as const;
    case "Bench Heavy":
      return "secondary" as const;
    case "Recently Unused":
      return "info" as const;
    default:
      return "default" as const;
  }
}

function getPlannerAssignmentLabel(assignment: "xi" | "twelfth" | "bench" | "unavailable") {
  if (assignment === "xi") {
    return "Playing XI";
  }

  if (assignment === "twelfth") {
    return "12th Man";
  }

  if (assignment === "bench") {
    return "Bench";
  }

  return "Unavailable";
}

function getPlannerAssignmentColor(assignment: "xi" | "twelfth" | "bench" | "unavailable") {
  if (assignment === "xi") {
    return "success" as const;
  }

  if (assignment === "twelfth") {
    return "warning" as const;
  }

  if (assignment === "bench") {
    return "secondary" as const;
  }

  return "default" as const;
}

type PlannerWeekMatch = NonNullable<PlayerDashboardData["plannerWeek"]>["matches"][number];

function getPlannerSummaryCounts(matches: PlannerWeekMatch[]) {
  return {
    xi: matches.filter((match) => match.assignment === "xi").length,
    twelfth: matches.filter((match) => match.assignment === "twelfth").length,
    bench: matches.filter((match) => match.assignment === "bench").length,
    unavailable: matches.filter((match) => match.assignment === "unavailable").length
  };
}

function formatSnapshotValue(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function DashboardPage() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>("mine");
  const [expandedFairnessPlayerId, setExpandedFairnessPlayerId] = useState<string | false>(false);
  const [accessState, setAccessState] = useState<DashboardAccessState>({
    hasTeam: false,
    hasMember: false,
    canToggleTeamView: false
  });
  const [teamData, setTeamData] = useState<OrganiserDashboardData | null>(null);
  const [myData, setMyData] = useState<PlayerDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teamErrorMessage, setTeamErrorMessage] = useState<string | null>(null);
  const [myErrorMessage, setMyErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const initializeDashboard = async () => {
      setIsLoading(true);
      setTeamErrorMessage(null);
      setMyErrorMessage(null);

      try {
        const [membershipAccess, workspaceAccess] = await Promise.all([
          getCurrentTeamMembershipAccess(),
          getCurrentWorkspaceAccessSnapshot()
        ]);
        const hasTeam = Boolean(membershipAccess.teamId);
        const hasMember = Boolean(membershipAccess.memberId);
        const canUseTeamView = hasMember && (
          membershipAccess.teamRole === "organiser"
          || membershipAccess.teamRole === "captain"
          || membershipAccess.legacyMembershipRole === "captain"
          || workspaceAccess.canAccessAnalytics
          || workspaceAccess.canSeeFairness
          || membershipAccess.permissions.includes("planner_manage")
          || membershipAccess.permissions.includes("stats_manage")
        );

        if (!isActive) {
          return;
        }

        setAccessState({
          hasTeam,
          hasMember,
          canToggleTeamView: canUseTeamView
        });
        setDashboardMode(canUseTeamView ? "team" : "mine");

        if (!hasMember) {
          setTeamData(null);
          setMyData(null);
          return;
        }

        const [teamResult, myResult] = await Promise.allSettled([
          canUseTeamView ? getOrganiserDashboardData() : Promise.resolve(null),
          getPlayerDashboardData(profile?.playerId ?? null)
        ]);

        if (!isActive) {
          return;
        }

        if (teamResult.status === "fulfilled") {
          setTeamData(teamResult.value);
        } else {
          setTeamErrorMessage(
            teamResult.reason instanceof Error
              ? teamResult.reason.message
              : "Could not load the organiser dashboard."
          );
        }

        if (myResult.status === "fulfilled") {
          setMyData(myResult.value);
        } else {
          setMyErrorMessage(
            myResult.reason instanceof Error
              ? myResult.reason.message
              : "Could not load your player dashboard."
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void initializeDashboard();

    return () => {
      isActive = false;
    };
  }, [profile?.playerId]);

  const sectionCardSx = {
    borderRadius: 3,
    backgroundColor: "background.paper"
  } as const;
  const fairnessColumns = useMemo(() => {
    const fairnessEntries = [...(teamData?.fairnessTable ?? [])]
      .sort((left, right) => left.name.localeCompare(right.name));

    return fairnessEntries.reduce<
      [OrganiserDashboardData["fairnessTable"], OrganiserDashboardData["fairnessTable"]]
    >((columns, player, index) => {
      columns[index % 2].push(player);
      return columns;
    }, [[], []]);
  }, [teamData?.fairnessTable]);

  const currentErrorMessage = dashboardMode === "team" ? teamErrorMessage : myErrorMessage;
  const headerTitle = dashboardMode === "team" ? "Team Dashboard" : "My Dashboard";
  const headerDescription = dashboardMode === "team"
    ? "Team performance, fairness visibility, and planner outcomes in one organiser view."
    : "Your opportunity visibility, fairness transparency, and personal contribution in one player view.";
  const plannerWeekSummary = myData?.plannerWeek
    ? getPlannerSummaryCounts(myData.plannerWeek.matches)
    : null;

  if (isLoading) {
    return (
      <Container maxWidth="xl">
        <Box
          sx={{
            minHeight: 420,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Stack spacing={4}>
        <TeamPageHeader
          eyebrow="Dashboard"
          title={headerTitle}
          description={headerDescription}
          action={(
            accessState.canToggleTeamView ? (
              <ToggleButtonGroup
                exclusive
                value={dashboardMode}
                onChange={(_event, nextMode: DashboardMode | null) => {
                  if (nextMode) {
                    setDashboardMode(nextMode);
                  }
                }}
              >
                <ToggleButton value="team">Team View</ToggleButton>
                <ToggleButton value="mine">My View</ToggleButton>
              </ToggleButtonGroup>
            ) : null
          )}
        />

        {currentErrorMessage ? <Alert severity="error">{currentErrorMessage}</Alert> : null}

        {!accessState.hasTeam ? (
          <Alert severity="info" variant="outlined">
            Your account is not connected to a team yet. Join or create a team to unlock the dashboard.
          </Alert>
        ) : null}

        {accessState.hasTeam && !accessState.hasMember ? (
          <Alert severity="info" variant="outlined">
            Your account is connected to a team, but not linked to a team member yet. The dashboard will unlock once your membership is linked.
          </Alert>
        ) : null}

        {accessState.hasMember && dashboardMode === "team" && teamData ? (
          <>
            <Grid container spacing={3} alignItems="stretch">
              <Grid size={{ xs: 12, md: 3 }} sx={{ display: "flex" }}>
                <DashboardCard
                  title="Matches Played"
                  value={teamData.summary.matchesPlayed}
                  icon={<SportsCricketIcon color="primary" />}
                  color="primary"
                  layout="metric"
                />
              </Grid>

              <Grid size={{ xs: 12, md: 3 }} sx={{ display: "flex" }}>
                <DashboardCard
                  title="Win Ratio"
                  value={`${teamData.summary.winRate}%`}
                  icon={<TrendingUpIcon color="success" />}
                  color="success"
                  layout="metric"
                />
              </Grid>

              <Grid size={{ xs: 12, md: 3 }} sx={{ display: "flex" }}>
                <DashboardCard
                  title="Top Run Scorer"
                  value={teamData.summary.topRunScorer ? getDisplayFirstName(teamData.summary.topRunScorer.player) : "-"}
                  icon={<EmojiEventsIcon color="warning" />}
                  color="warning"
                  layout="leader"
                />
              </Grid>

              <Grid size={{ xs: 12, md: 3 }} sx={{ display: "flex" }}>
                <DashboardCard
                  title="Top Wicket Taker"
                  value={teamData.summary.topWicketTaker ? getDisplayFirstName(teamData.summary.topWicketTaker.player) : "-"}
                  icon={<EmojiEventsIcon color="secondary" />}
                  color="secondary"
                  layout="leader"
                />
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={sectionCardSx}>
                  <CardContent sx={{ p: 0 }}>
                    <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                      <SectionHeader title="Top Run Leaders" />
                    </Box>
                    <ResponsiveTableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={numericTableHeadCellSx}>Rank</TableCell>
                            <TableCell>Player</TableCell>
                            <TableCell sx={numericTableHeadCellSx}>Runs</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {teamData.leaders.runLeaders.map((player, index) => (
                            <TableRow key={`${player.player}-${index}`}>
                              <TableCell sx={numericTableCellSx}>{index + 1}</TableCell>
                              <TableCell>{formatName(player.player)}</TableCell>
                              <TableCell sx={numericTableCellSx}>{player.runs}</TableCell>
                            </TableRow>
                          ))}
                          {teamData.leaders.runLeaders.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3}>
                                <Typography color="text.secondary">
                                  No run leaders available yet.
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </ResponsiveTableContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={sectionCardSx}>
                  <CardContent sx={{ p: 0 }}>
                    <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                      <SectionHeader title="Top Wicket Leaders" />
                    </Box>
                    <ResponsiveTableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={numericTableHeadCellSx}>Rank</TableCell>
                            <TableCell>Player</TableCell>
                            <TableCell sx={numericTableHeadCellSx}>Wickets</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {teamData.leaders.wicketLeaders.map((player, index) => (
                            <TableRow key={`${player.player}-${index}`}>
                              <TableCell sx={numericTableCellSx}>{index + 1}</TableCell>
                              <TableCell>{formatName(player.player)}</TableCell>
                              <TableCell sx={numericTableCellSx}>{player.wickets}</TableCell>
                            </TableRow>
                          ))}
                          {teamData.leaders.wicketLeaders.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3}>
                                <Typography color="text.secondary">
                                  No wicket leaders available yet.
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </ResponsiveTableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={sectionCardSx}>
                  <CardContent>
                    <SectionHeader title="Runs Trend" />
                    <RunsTrendChart data={teamData.trends.runs} />
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={sectionCardSx}>
                  <CardContent>
                    <SectionHeader title="Wickets Trend" />
                    <WicketsTrendChart data={teamData.trends.wickets} />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card variant="outlined" sx={sectionCardSx}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                  <SectionHeader title="Fairness Overview" />
                </Box>
                <Grid container spacing={1.5} alignItems="flex-start" sx={{ px: 1.5, pb: 1.5 }}>
                  {fairnessColumns.map((columnPlayers, columnIndex) => (
                    <Grid key={`fairness-column-${columnIndex}`} size={{ xs: 12, md: 6 }}>
                      <Stack spacing={1.25}>
                        {columnPlayers.map((player) => (
                          <Accordion
                            key={player.playerId}
                            expanded={expandedFairnessPlayerId === player.playerId}
                            onChange={(_, isExpanded) => setExpandedFairnessPlayerId(isExpanded ? player.playerId : false)}
                            disableGutters
                            sx={{
                              borderRadius: "20px !important",
                              overflow: "hidden",
                              border: "1px solid",
                              borderColor: "divider",
                              backgroundColor: "background.paper",
                              "&::before": {
                                display: "none"
                              }
                            }}
                          >
                            <AccordionSummary
                              expandIcon={<ExpandMoreRoundedIcon />}
                              sx={{
                                px: 2,
                                py: 1.25,
                                "& .MuiAccordionSummary-content": {
                                  my: 0
                                }
                              }}
                            >
                              <Stack
                                direction="row"
                                spacing={1.25}
                                justifyContent="space-between"
                                alignItems="center"
                                sx={{ width: "100%", minWidth: 0, pr: 1 }}
                              >
                                <Typography sx={{ fontWeight: 800, color: "text.primary" }}>
                                  {formatName(player.name)}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={player.fairnessStatus}
                                  color={getFairnessChipColor(player.fairnessStatus)}
                                />
                              </Stack>
                            </AccordionSummary>

                            <AccordionDetails sx={{ px: 1.5, pb: 1.5, pt: 0 }}>
                              <Divider sx={{ mb: 1.5 }} />

                              <Grid container spacing={1.25}>
                                <Grid size={{ xs: 6, md: 4 }}>
                                  <SummaryMetricCard label="XI" value={player.xiCount} helper="Selections" />
                                </Grid>
                                <Grid size={{ xs: 6, md: 4 }}>
                                  <SummaryMetricCard label="12th" value={player.twelfthCount} helper="12th man" />
                                </Grid>
                                <Grid size={{ xs: 6, md: 4 }}>
                                  <SummaryMetricCard label="Bench" value={player.benchCount} helper="Bench count" />
                                </Grid>
                                <Grid size={{ xs: 6, md: 4 }}>
                                  <SummaryMetricCard label="Unused" value={player.unusedInXiCount} helper="In XI, not used" />
                                </Grid>
                                <Grid size={{ xs: 6, md: 4 }}>
                                  <SummaryMetricCard label="Bat" value={player.batCount} helper="Batted" />
                                </Grid>
                                <Grid size={{ xs: 6, md: 4 }}>
                                  <SummaryMetricCard label="Bowl" value={player.bowlCount} helper="Bowled" />
                                </Grid>
                              </Grid>
                            </AccordionDetails>
                          </Accordion>
                        ))}
                      </Stack>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, lg: 6 }}>
                <Card variant="outlined" sx={{ ...sectionCardSx, height: "100%" }}>
                  <CardContent>
                    <Stack spacing={2}>
                      <SectionHeader title="Underused Players" />
                      {teamData.underusedPlayers.length > 0 ? teamData.underusedPlayers.map((player) => (
                        <Box key={player.playerId}>
                          <Typography fontWeight={700}>{formatName(player.name)}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {player.reason}
                          </Typography>
                        </Box>
                      )) : (
                        <Alert severity="success" variant="outlined">
                          No strong underuse signals detected right now.
                        </Alert>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, lg: 6 }}>
                <Card variant="outlined" sx={{ ...sectionCardSx, height: "100%" }}>
                  <CardContent>
                    <Stack spacing={2}>
                      <SectionHeader title="Overused Players" />
                      {teamData.overusedPlayers.length > 0 ? teamData.overusedPlayers.map((player) => (
                        <Box key={player.playerId}>
                          <Typography fontWeight={700}>{formatName(player.name)}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {player.reason}
                          </Typography>
                        </Box>
                      )) : (
                        <Alert severity="info" variant="outlined">
                          No strong overuse patterns are showing yet.
                        </Alert>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card variant="outlined" sx={sectionCardSx}>
              <CardContent>
                <Stack spacing={2.5}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                    spacing={1.5}
                  >
                    <SectionHeader title="Planner Outcome Snapshot" />
                    {teamData.plannerSnapshot ? (
                      <Chip
                        label={`${teamData.plannerSnapshot.label} • ${teamData.plannerSnapshot.matchCount} matches`}
                        color={teamData.plannerSnapshot.mismatch ? "warning" : "success"}
                        variant="outlined"
                      />
                    ) : null}
                  </Stack>

                  {teamData.plannerSnapshot ? (
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <SummaryMetricCard
                          label="Planned XI / Match"
                          value={formatSnapshotValue(teamData.plannerSnapshot.averagePlannedXiCount)}
                          helper={`${teamData.plannerSnapshot.totalPlannedXiCount} total XI slots across ${teamData.plannerSnapshot.matchCount} matches.`}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <SummaryMetricCard
                          label="Utilized / Match"
                          value={formatSnapshotValue(teamData.plannerSnapshot.averageActualUtilizedCount)}
                          helper={`${teamData.plannerSnapshot.totalActualUtilizedCount} utilized XI slots across ${teamData.plannerSnapshot.linkedActualMatchCount} linked matches.`}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <SummaryMetricCard
                          label="Unused In XI / Match"
                          value={formatSnapshotValue(teamData.plannerSnapshot.averageUnusedInXiCount)}
                          helper={teamData.plannerSnapshot.mismatch
                            ? `${teamData.plannerSnapshot.totalUnusedInXiCount} total unused XI slots detected.`
                            : "Planner and actual usage stayed aligned."}
                        />
                      </Grid>
                    </Grid>
                  ) : (
                    <Alert severity="info" variant="outlined">
                      No saved friendly planner batch is available yet for a planner snapshot.
                    </Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={sectionCardSx}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                  <SectionHeader title="Recent Matches" />
                </Box>
                <ResponsiveTableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Opponent</TableCell>
                        <TableCell>Result</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {teamData.recentMatches.map((match) => {
                        const resultChip = getResultChip({
                          result: match.result,
                          resultSummary: match.resultSummary
                        });

                        return (
                          <TableRow key={match.id}>
                            <TableCell>{match.matchDate ? formatDate(match.matchDate) : "-"}</TableCell>
                            <TableCell>{match.opponentName ?? "-"}</TableCell>
                            <TableCell>
                              {resultChip ? (
                                <Chip label={resultChip.label} size="small" color={resultChip.color} />
                              ) : (
                                "-"
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ResponsiveTableContainer>
              </CardContent>
            </Card>
          </>
        ) : null}
        {accessState.hasMember && dashboardMode === "mine" && myData ? (
          <Stack spacing={3}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <SummaryMetricCard
                  label="Matches Played"
                  value={myData.summary.matchesPlayed}
                  helper="Linked scorecard appearances."
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <SummaryMetricCard
                  label="Total Runs"
                  value={myData.summary.totalRuns}
                  helper="Career team runs so far."
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <SummaryMetricCard
                  label="Total Wickets"
                  value={myData.summary.totalWickets}
                  helper="Career team wickets so far."
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <SummaryMetricCard
                  label="Fairness Status"
                  value={myData.summary.fairnessStatus}
                  helper="Your latest opportunity signal."
                />
              </Grid>
            </Grid>

            <Card variant="outlined" sx={sectionCardSx}>
              <CardContent>
                <Stack spacing={2.5}>
                  <SectionHeader title="Opportunity Breakdown" />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
                      <SummaryMetricCard
                        label="XI Appearances"
                        value={myData.opportunityBreakdown.xiAppearances}
                        helper="Tracked actual XI usage."
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
                      <SummaryMetricCard
                        label="12th Man"
                        value={myData.opportunityBreakdown.twelfthCount}
                        helper="12th-man assignments."
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
                      <SummaryMetricCard
                        label="Bench"
                        value={myData.opportunityBreakdown.benchCount}
                        helper="Bench outcomes across tracked weeks."
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
                      <SummaryMetricCard
                        label="Unused In XI"
                        value={myData.opportunityBreakdown.unusedInXiCount}
                        helper="Listed but did not bat or bowl."
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
                      <SummaryMetricCard
                        label="Unavailable"
                        value={myData.opportunityBreakdown.unavailableCount}
                        helper="Unavailable tracked match slots."
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={sectionCardSx}>
              <CardContent>
                <Stack spacing={2.5}>
                  <SectionHeader title="Personal Performance" />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                          <SummaryMetricCard
                            label="Total Runs"
                            value={myData.performance.totalRuns}
                            helper="All linked batting runs."
                          />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                          <SummaryMetricCard
                            label="Total Wickets"
                            value={myData.performance.totalWickets}
                            helper="All linked bowling wickets."
                          />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                      <SummaryMetricCard
                        label="Strike Rate"
                        value={formatSnapshotValue(myData.performance.strikeRate)}
                        helper="Linked batting strike rate."
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                      <SummaryMetricCard
                        label="Economy"
                        value={formatSnapshotValue(myData.performance.economy)}
                        helper="Linked bowling economy."
                      />
                    </Grid>
                  </Grid>

                  <Divider />

                  <Stack spacing={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Recent Contribution Summary
                    </Typography>
                    <Typography>{myData.performance.recentContributionSummary}</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={sectionCardSx}>
              <CardContent>
                <Stack spacing={2.5}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        spacing={1.5}
                      >
                        <SectionHeader title="Current Week Friendly Matchday Plan" />
                        {!accessState.canToggleTeamView ? (
                          <Chip label="Read Only" icon={<VisibilityRoundedIcon />} variant="outlined" />
                        ) : null}
                      </Stack>

                      {myData.plannerWeek ? (
                        <>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            <Chip label={myData.plannerWeek.weekendLabel} color="primary" variant="outlined" />
                            <Chip label={`${myData.plannerWeek.matchCount} upcoming match${myData.plannerWeek.matchCount === 1 ? "" : "es"}`} variant="outlined" />
                          </Stack>

                          <Typography variant="body2" color="text.secondary">
                            The latest saved friendly planner is shown here so you can see the complete weekly plan transparently, including the full Playing XI for Match 1, Match 2, and Match 3.
                          </Typography>

                          {plannerWeekSummary ? (
                            <Grid container spacing={1.25}>
                              <Grid size={{ xs: 6, md: 3 }}>
                                <SummaryMetricCard
                                  label="Playing XI"
                                  value={plannerWeekSummary.xi}
                                  helper="Matches selected in XI"
                                />
                              </Grid>
                              <Grid size={{ xs: 6, md: 3 }}>
                                <SummaryMetricCard
                                  label="12th Man"
                                  value={plannerWeekSummary.twelfth}
                                  helper="12th-man assignments"
                                />
                              </Grid>
                              <Grid size={{ xs: 6, md: 3 }}>
                                <SummaryMetricCard
                                  label="Bench"
                                  value={plannerWeekSummary.bench}
                                  helper="Bench assignments"
                                />
                              </Grid>
                              <Grid size={{ xs: 6, md: 3 }}>
                                <SummaryMetricCard
                                  label="Unavailable"
                                  value={plannerWeekSummary.unavailable}
                                  helper="Unavailable match slots"
                                />
                              </Grid>
                            </Grid>
                          ) : null}

                          <Grid container spacing={2}>
                            {myData.plannerWeek.matches.map((match) => (
                              <Grid key={`planner-week-${match.matchNumber}`} size={{ xs: 12, lg: 4 }}>
                                <Card
                                  variant="outlined"
                                  sx={{
                                    height: "100%",
                                    borderRadius: 3,
                                    backgroundColor: alpha(theme.palette.primary.main, 0.04)
                                  }}
                                >
                                  <CardContent sx={{ p: 2.5 }}>
                                    <Stack spacing={1.5}>
                                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                          Match {match.matchNumber}
                                        </Typography>
                                        <Chip
                                          label={getPlannerAssignmentLabel(match.assignment)}
                                          color={getPlannerAssignmentColor(match.assignment)}
                                          size="small"
                                        />
                                      </Stack>
                                      <Typography variant="body2" color="text.secondary">
                                        {match.assignment === "xi"
                                          ? "You are selected in the planned XI for this match."
                                          : match.assignment === "twelfth"
                                            ? "You are planned as 12th man for this match."
                                            : match.assignment === "bench"
                                              ? "You are on the bench for this planned match."
                                              : "You are marked unavailable for this match."}
                                      </Typography>
                                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                        {match.isCaptain ? <Chip label="Captain" size="small" variant="outlined" /> : null}
                                        {match.isWicketKeeper ? <Chip label="Wicket Keeper" size="small" variant="outlined" /> : null}
                                      </Stack>

                                      <Divider />

                                      <Stack spacing={1}>
                                        <Typography variant="subtitle2" color="text.secondary">
                                          Planned Playing XI
                                        </Typography>
                                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                          {match.xiPlayers
                                            .slice()
                                            .sort((left, right) => formatName(left).localeCompare(formatName(right)))
                                            .map((playerName) => (
                                            <Chip
                                              key={`planner-week-${match.matchNumber}-${playerName}`}
                                              label={formatName(playerName)}
                                              size="small"
                                              variant="outlined"
                                            />
                                          ))}
                                        </Stack>
                                      </Stack>
                                    </Stack>
                                  </CardContent>
                                </Card>
                              </Grid>
                            ))}
                          </Grid>

                          {myData.plannerWeek.notes.length > 0 ? (
                            <>
                              <Divider />
                              <Stack spacing={1}>
                                <Typography variant="subtitle2" color="text.secondary">
                                  Planner Notes
                                </Typography>
                                {myData.plannerWeek.notes.map((note) => (
                                  <Typography key={note} variant="body2" color="text.secondary">
                                    {note}
                                  </Typography>
                                ))}
                              </Stack>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <Alert severity="info" variant="outlined">
                          No current saved friendly planner week includes you yet.
                        </Alert>
                      )}
                    </Stack>
                  </CardContent>
                </Card>

            <Card variant="outlined" sx={sectionCardSx}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                  <SectionHeader title="Recent Opportunity Timeline" />
                </Box>
                <ResponsiveTableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Opponent</TableCell>
                        <TableCell>Planned Status</TableCell>
                        <TableCell>Actual Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {myData.timeline.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.date ? formatDate(item.date) : "-"}</TableCell>
                          <TableCell>{item.opponent ?? "-"}</TableCell>
                          <TableCell>{item.plannedStatus}</TableCell>
                          <TableCell>{item.actualStatus}</TableCell>
                        </TableRow>
                      ))}
                      {myData.timeline.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4}>
                            <Typography color="text.secondary">
                              No recent opportunity timeline is available yet.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </ResponsiveTableContainer>
              </CardContent>
            </Card>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6, xl: 4 }}>
                <Card variant="outlined" sx={sectionCardSx}>
                  <CardContent>
                    <SectionHeader title="Runs Trend" />
                    <RunsTrendChart data={myData.trends.runs} />
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6, xl: 4 }}>
                <Card variant="outlined" sx={sectionCardSx}>
                  <CardContent>
                    <SectionHeader title="Wickets Trend" />
                    <WicketsTrendChart data={myData.trends.wickets} />
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, xl: 4 }}>
                <Card variant="outlined" sx={sectionCardSx}>
                  <CardContent>
                    <SectionHeader title="Opportunity Trend" />
                    <OpportunityTrendChart data={myData.trends.opportunity} />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card variant="outlined" sx={sectionCardSx}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                  <SectionHeader title="Recent Matches" />
                </Box>
                <ResponsiveTableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Opponent</TableCell>
                        <TableCell>Result</TableCell>
                        <TableCell>Player Status</TableCell>
                        <TableCell>Contribution</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {myData.recentMatches.map((match) => {
                        const resultChip = getResultChip({
                          result: match.result,
                          resultSummary: match.resultSummary
                        });

                        return (
                          <TableRow key={match.id}>
                            <TableCell>{match.date ? formatDate(match.date) : "-"}</TableCell>
                            <TableCell>{match.opponent ?? "-"}</TableCell>
                            <TableCell>
                              {resultChip ? (
                                <Chip label={resultChip.label} size="small" color={resultChip.color} />
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>{match.playerStatus}</TableCell>
                            <TableCell>{match.contribution}</TableCell>
                          </TableRow>
                        );
                      })}
                      {myData.recentMatches.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <Typography color="text.secondary">
                              No linked recent matches are available yet.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </ResponsiveTableContainer>
              </CardContent>
            </Card>
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
}
