"use client";

import { useEffect, useState } from "react";

import {
  Alert,
  Box,
  Card,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import SportsScoreRoundedIcon from "@mui/icons-material/SportsScoreRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import FlashOnRoundedIcon from "@mui/icons-material/FlashOnRounded";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricketRounded";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import AirlineSeatReclineNormalRoundedIcon from "@mui/icons-material/AirlineSeatReclineNormalRounded";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { useAuth } from "@/app/context/AuthContext";
import { formatName } from "@/app/services/formatname";
import {
  AnalyticsSnapshot,
  getAnalyticsSnapshot
} from "@/app/services/analyticsService";

const ICON_TILE_BG = "#F4F1FF";
const ICON_TILE_COLOR = "#5B5FEF";

type MetricCardProps = {
  label: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
  accent: string;
};

function MetricCard({ label, value, helper, icon, accent }: MetricCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        borderColor: "divider",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)"
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: ICON_TILE_COLOR,
                  backgroundColor: ICON_TILE_BG
                }}
              >
                {icon}
              </Box>

              <Typography variant="subtitle2" color="text.secondary">
                {label}
              </Typography>
            </Stack>

            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: accent,
                boxShadow: `0 0 0 5px ${accent}22`
              }}
            />
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1 }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {helper}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { isAdmin } = useAuth();
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [selectedSeason, setSelectedSeason] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setSnapshot(null);
      setIsLoading(false);
      return;
    }

    const loadAnalytics = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextSnapshot = await getAnalyticsSnapshot(
          selectedSeason === "all" ? undefined : selectedSeason
        );
        setSnapshot(nextSnapshot);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not load analytics.";

        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadAnalytics();
  }, [isAdmin, selectedSeason]);

  return (
    <Container maxWidth="xl">
      <Stack spacing={4}>
        {!isAdmin && (
          <Alert severity="info" variant="outlined">
            Analytics is available to admin users only.
          </Alert>
        )}

        {isAdmin && (
        <Stack direction="row" justifyContent="flex-end">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="analytics-season-filter-label">Season</InputLabel>
            <Select
              labelId="analytics-season-filter-label"
              value={selectedSeason}
              label="Season"
              onChange={(event) => setSelectedSeason(event.target.value)}
            >
              <MenuItem value="all">All Seasons</MenuItem>
              {snapshot?.seasons.map((season) => (
                <MenuItem key={season.value} value={season.value}>
                  {season.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        )}

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        {isAdmin && isLoading ? (
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
        ) : isAdmin && snapshot ? (
          <>
            <Grid container spacing={3} alignItems="stretch">
              <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                <MetricCard
                  label="Matches"
                  value={snapshot.metrics.matches}
                  helper={`${snapshot.metrics.wins} wins and ${snapshot.metrics.losses} losses`}
                  icon={<SportsScoreRoundedIcon />}
                  accent="#2E6FF2"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                <MetricCard
                  label="Win Rate"
                  value={`${snapshot.metrics.winRate}%`}
                  helper="Based on saved match results"
                  icon={<TrendingUpRoundedIcon />}
                  accent="#15A05C"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                <MetricCard
                  label="Total Runs"
                  value={snapshot.metrics.totalRuns}
                  helper={`Average score ${snapshot.metrics.averageScore}`}
                  icon={<FlashOnRoundedIcon />}
                  accent="#FF9800"
                />
              </Grid>

                <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                  <MetricCard
                    label="Wickets Taken"
                  value={snapshot.metrics.totalWickets}
                  helper="Aggregated from bowling figures"
                  icon={<SportsCricketRoundedIcon />}
                  accent="#8B5CF6"
                  />
                </Grid>
              </Grid>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 0 }}>
                    <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        justifyContent="space-between"
                      >
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <AirlineSeatReclineNormalRoundedIcon color="primary" />
                          <Typography variant="h5">Bench Stats</Typography>
                        </Stack>

                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Chip
                            label={`${snapshot.benchStats.totalBenchSelections} unused appearances`}
                            color="warning"
                            size="small"
                          />
                          <Chip
                            label={`${snapshot.benchStats.uniquePlayers} players affected`}
                            color="default"
                            size="small"
                          />
                        </Stack>
                      </Stack>
                    </Box>

                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Player</TableCell>
                            <TableCell>Unused Matches</TableCell>
                            <TableCell>XI Matches</TableCell>
                            <TableCell>Unused Rate</TableCell>
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          {snapshot.benchStats.topBenchPlayers.map((player) => (
                            <TableRow key={player.player}>
                              <TableCell>
                                <Typography fontWeight={700}>
                                  {formatName(player.player)}
                                </Typography>
                              </TableCell>
                              <TableCell>{player.benchMatches}</TableCell>
                              <TableCell>{player.totalSquadMatches}</TableCell>
                              <TableCell>{player.benchRate}%</TableCell>
                            </TableRow>
                          ))}

                          {snapshot.benchStats.topBenchPlayers.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <Typography color="text.secondary">
                                  No unused playing-eleven appearances found for this season.
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {snapshot.metrics.matches === 0 ? (
              <Alert severity="info">
                No analytics data found for this season yet.
              </Alert>
            ) : (
              <>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 7 }} sx={{ minWidth: 0 }}>
                    <Card variant="outlined" sx={{ height: "100%", minWidth: 0 }}>
                      <CardContent sx={{ p: 0 }}>
                        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <QueryStatsRoundedIcon color="primary" />
                            <Typography variant="h5">Match Trend</Typography>
                          </Stack>
                        </Box>

                        <Box sx={{ px: 2, pb: 2, height: 320, minWidth: 0 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={snapshot.matchTrend}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="label" tickLine={false} axisLine={false} />
                              <YAxis tickLine={false} axisLine={false} />
                              <Tooltip />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="runs"
                                name="Runs"
                                stroke="#2E6FF2"
                                strokeWidth={3}
                                dot={{ r: 3 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="wickets"
                                name="Wickets"
                                stroke="#8B5CF6"
                                strokeWidth={3}
                                dot={{ r: 3 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid size={{ xs: 12, md: 5 }} sx={{ minWidth: 0 }}>
                    <Card variant="outlined" sx={{ height: "100%", minWidth: 0 }}>
                      <CardContent sx={{ p: 0 }}>
                        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <EmojiEventsRoundedIcon color="primary" />
                            <Typography variant="h5">Result Breakdown</Typography>
                          </Stack>
                        </Box>

                        <Box sx={{ px: 2, pb: 2, height: 320, minWidth: 0 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={snapshot.resultBreakdown}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="label" tickLine={false} axisLine={false} />
                              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                              <Tooltip />
                              <Bar dataKey="value" name="Matches" radius={[8, 8, 0, 0]}>
                                {snapshot.resultBreakdown.map((entry) => (
                                  <Cell
                                    key={entry.label}
                                    fill={
                                      entry.label === "Won"
                                        ? "#15A05C"
                                        : entry.label === "Lost"
                                          ? "#FF5C35"
                                          : "#94A3B8"
                                    }
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, lg: 6 }}>
                    <Card variant="outlined">
                      <CardContent sx={{ p: 0 }}>
                        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                          <Typography variant="h5">Top Batters</Typography>
                        </Box>

                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>Player</TableCell>
                                <TableCell>Runs</TableCell>
                                <TableCell>Matches</TableCell>
                                <TableCell>Strike Rate</TableCell>
                              </TableRow>
                            </TableHead>

                            <TableBody>
                              {snapshot.topBatters.map((player) => (
                                <TableRow key={player.player}>
                                  <TableCell>
                                    <Typography fontWeight={700}>
                                      {formatName(player.player)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>{player.runs}</TableCell>
                                  <TableCell>{player.matches}</TableCell>
                                  <TableCell>
                                    {player.strikeRate ? player.strikeRate.toFixed(2) : "-"}
                                  </TableCell>
                                </TableRow>
                              ))}

                              {snapshot.topBatters.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={4}>
                                    <Typography color="text.secondary">
                                      No batting data available for this season.
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid size={{ xs: 12, lg: 6 }}>
                    <Card variant="outlined">
                      <CardContent sx={{ p: 0 }}>
                        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                          <Typography variant="h5">Top Bowlers</Typography>
                        </Box>

                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>Player</TableCell>
                                <TableCell>Wickets</TableCell>
                                <TableCell>Matches</TableCell>
                                <TableCell>Economy</TableCell>
                              </TableRow>
                            </TableHead>

                            <TableBody>
                              {snapshot.topBowlers.map((player) => (
                                <TableRow key={player.player}>
                                  <TableCell>
                                    <Typography fontWeight={700}>
                                      {formatName(player.player)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>{player.wickets}</TableCell>
                                  <TableCell>{player.matches}</TableCell>
                                  <TableCell>
                                    {player.economy ? player.economy.toFixed(2) : "-"}
                                  </TableCell>
                                </TableRow>
                              ))}

                              {snapshot.topBowlers.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={4}>
                                    <Typography color="text.secondary">
                                      No bowling data available for this season.
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </>
            )}
          </>
        ) : null}
      </Stack>
    </Container>
  );
}
