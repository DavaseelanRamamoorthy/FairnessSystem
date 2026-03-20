"use client";

import { useEffect, useState } from "react";

import Alert from "@mui/material/Alert";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";

import SportsCricketIcon from "@mui/icons-material/SportsCricket";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

import { currentTeamName } from "@/app/config/teamConfig";
import DashboardCard from "@/app/components/dashboard/dashboardCard";
import SectionHeader from "@/app/components/dashboard/SectionHeader";
import RunsTrendChart from "@/app/components/dashboard/RunsTrendChart";
import WicketsTrendChart from "@/app/components/dashboard/WicketsTrendChart";
import ResponsiveTableContainer from "@/app/components/common/ResponsiveTableContainer";
import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import {
  numericTableCellSx,
  numericTableHeadCellSx
} from "@/app/components/common/tableCellStyles";
import { formatName } from "@/app/services/formatname";
import { formatDate } from "@/app/utils/formatDate";
import {
  getMatchesPlayed,
  getWinRate,
  getTopRunScorer,
  getTopWicketTaker,
  getTopRunLeaders,
  getTopWicketLeaders,
  getRunsPerMatch,
  getWicketsPerMatch
} from "@/app/services/statsService";
import { getCurrentTeamId } from "@/app/services/squadService";
import { supabase } from "@/app/services/supabaseClient";
import { getOpponentName } from "@/app/utils/matchOpponent";

type Match = {
  id: string;
  match_date: string | null;
  team_a: string | null;
  team_b: string | null;
  result: string | null;
  result_summary: string | null;
  opponent_name: string | null;
};

type RunLeader = {
  player: string;
  runs: number;
};

type WicketLeader = {
  player: string;
  wickets: number;
};

type RunsTrendPoint = {
  match: string;
  matchLabel: string;
  runs: number;
};

type WicketsTrendPoint = {
  match: string;
  matchLabel: string;
  wickets: number;
};

function getDashboardResult(match: Match) {
  const rawResult = typeof match.result === "string" ? match.result.trim() : "";
  const normalizedResult = rawResult.toLowerCase();
  const summary = typeof match.result_summary === "string"
    ? match.result_summary.trim().toLowerCase()
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

  if (match.result_summary) {
    return { label: match.result_summary, color: "default" as const };
  }

  return null;
}

export default function DashboardPage() {
  const theme = useTheme();
  const [matchesPlayed, setMatchesPlayed] = useState(0);
  const [winRate, setWinRate] = useState(0);
  const [topRunScorer, setTopRunScorer] = useState<RunLeader | null>(null);
  const [topWicketTaker, setTopWicketTaker] = useState<WicketLeader | null>(null);

  const [matches, setMatches] = useState<Match[]>([]);
  const [runLeaders, setRunLeaders] = useState<RunLeader[]>([]);
  const [wicketLeaders, setWicketLeaders] = useState<WicketLeader[]>([]);
  const [runsTrend, setRunsTrend] = useState<RunsTrendPoint[]>([]);
  const [wicketsTrend, setWicketsTrend] = useState<WicketsTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboardStats = async () => {
    const matchesPlayedValue = await getMatchesPlayed();
    const winRateValue = await getWinRate();
    const runScorer = await getTopRunScorer();
    const wicketTaker = await getTopWicketTaker();

    const leaders = await getTopRunLeaders(5);
    const wickets = await getTopWicketLeaders(5);

    const runs = await getRunsPerMatch(currentTeamName);
    const wicketsTrendData = await getWicketsPerMatch(currentTeamName);

    setMatchesPlayed(matchesPlayedValue);
    setWinRate(winRateValue);
    setTopRunScorer(runScorer);
    setTopWicketTaker(wicketTaker);
    setRunLeaders(leaders);
    setWicketLeaders(wickets);
    setRunsTrend(runs);
    setWicketsTrend(wicketsTrendData);
  };

  const loadMatches = async () => {
    const teamId = await getCurrentTeamId();
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("team_id", teamId)
      .order("match_date", { ascending: false });

    if (error) {
      throw new Error("Could not load recent matches.");
    }

    setMatches(
      (data || []).map((match) => ({
        ...match,
        opponent_name: getOpponentName(match.team_a, match.team_b, currentTeamName)
      }))
    );
  };

  useEffect(() => {
    const initializeDashboard = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        await Promise.all([
          loadDashboardStats(),
          loadMatches()
        ]);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not load the dashboard.";

        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    };

    void initializeDashboard();
  }, []);

  const recentMatches = matches.slice(0, 5);
  const sectionCardSx = {
    borderRadius: 3,
    backgroundColor: "background.paper"
  } as const;

  const getLeaderboardAccent = (index: number) => {
    if (index === 0) {
      return theme.palette.warning.main;
    }

    if (index === 1) {
      return alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.72 : 0.56);
    }

    if (index === 2) {
      return theme.palette.secondary.main;
    }

    return null;
  };

  return (
    <Container maxWidth="xl">
      <Stack spacing={4}>
        <Box sx={{ display: { xs: "block", md: "none" } }}>
          <TeamPageHeader
            eyebrow="Team Hub"
            description="Track fixtures, leaders, and recent match trends from one mobile-ready home view."
          />
        </Box>

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        {isLoading ? (
          <Box
            sx={{
              minHeight: 320,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <>
        <Grid container spacing={3} alignItems="stretch">
          <Grid size={{ xs: 12, md: 3 }} sx={{ display: "flex" }}>
            <DashboardCard
              title="Matches Played"
              value={matchesPlayed}
              icon={<SportsCricketIcon color="primary" />}
              color="primary"
              layout="metric"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 3 }} sx={{ display: "flex" }}>
            <DashboardCard
              title="Win Ratio"
              value={`${winRate}%`}
              icon={<TrendingUpIcon color="success" />}
              color="success"
              layout="metric"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 3 }} sx={{ display: "flex" }}>
            <DashboardCard
              title="Top Run Scorer"
              value={topRunScorer ? formatName(topRunScorer.player) : "-"}
              icon={<EmojiEventsIcon color="warning" />}
              color="warning"
              layout="leader"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 3 }} sx={{ display: "flex" }}>
            <DashboardCard
              title="Top Wicket Taker"
              value={topWicketTaker ? formatName(topWicketTaker.player) : "-"}
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
                      {runLeaders.map((player, index) => (
                        <TableRow key={player.player}>
                          <TableCell sx={numericTableCellSx}>
                            {index < 3 && (
                              <EmojiEventsIcon sx={{ color: getLeaderboardAccent(index) ?? "text.secondary" }} />
                            )}
                            {index > 2 && index + 1}
                          </TableCell>

                          <TableCell>
                            <Typography fontWeight={600}>
                              {formatName(player.player)}
                            </Typography>
                          </TableCell>

                          <TableCell sx={numericTableCellSx}>
                            <Typography fontWeight={600}>
                              {player.runs}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}

                      {runLeaders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3}>
                            <Typography color="text.secondary">
                              No batting leaders available yet.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
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
                      {wicketLeaders.map((player, index) => (
                        <TableRow key={player.player}>
                          <TableCell sx={numericTableCellSx}>
                            {index < 3 && (
                              <EmojiEventsIcon sx={{ color: getLeaderboardAccent(index) ?? "text.secondary" }} />
                            )}
                            {index > 2 && index + 1}
                          </TableCell>

                          <TableCell>
                            <Typography fontWeight={600}>
                              {formatName(player.player)}
                            </Typography>
                          </TableCell>

                          <TableCell sx={numericTableCellSx}>
                            <Typography fontWeight={600}>
                              {player.wickets}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}

                      {wicketLeaders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3}>
                            <Typography color="text.secondary">
                              No bowling leaders available yet.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
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
                <RunsTrendChart data={runsTrend} />
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined" sx={sectionCardSx}>
              <CardContent>
                <SectionHeader title="Wickets Trend" />
                <WicketsTrendChart data={wicketsTrend} />
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
                  </TableRow>
                </TableHead>

                <TableBody>
                  {recentMatches.map((match) => {
                    const displayResult = getDashboardResult(match);

                    return (
                      <TableRow key={match.id}>
                        <TableCell>
                          {match.match_date ? formatDate(match.match_date) : "-"}
                        </TableCell>

                        <TableCell>
                          {match.opponent_name}
                        </TableCell>

                        <TableCell>
                          {displayResult ? (
                            <Chip
                              label={displayResult.label}
                              color={displayResult.color}
                              size="small"
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {recentMatches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography color="text.secondary">
                          No recent matches found for {currentTeamName}.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </CardContent>
        </Card>
          </>
        )}
      </Stack>
    </Container>
  );
}
