"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricketRounded";
import FlashOnRoundedIcon from "@mui/icons-material/FlashOnRounded";
import TrackChangesRoundedIcon from "@mui/icons-material/TrackChangesRounded";
import WaterDropRoundedIcon from "@mui/icons-material/WaterDropRounded";

import { currentTeamName } from "@/app/config/teamConfig";
import { formatName } from "@/app/services/formatname";
import {
  getPlayerProfile,
  getPlayerSeasons,
  PlayerProfile,
  SeasonOption
} from "@/app/services/playerProfileService";
import { formatDate } from "@/app/utils/formatDate";

const ICON_TILE_BG = "#F4F1FF";
const ICON_TILE_COLOR = "#5B5FEF";

type SummaryCardProps = {
  label: string;
  value: string | number;
  icon: React.ReactNode;
};

function SummaryCard({ label, value, icon }: SummaryCardProps) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent sx={{ px: 2.5, py: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: ICON_TILE_COLOR,
              backgroundColor: ICON_TILE_BG,
              flexShrink: 0
            }}
          >
            {icon}
          </Box>

          <Stack spacing={0.25}>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
              {label}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1 }}>
              {value}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function PlayerProfilePage() {
  const params = useParams<{ playerId: string }>();
  const playerId = Array.isArray(params.playerId) ? params.playerId[0] : params.playerId;

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadSeasons = async () => {
      try {
        const nextSeasons = await getPlayerSeasons();
        setSeasons(nextSeasons);
      } catch {
        // Keep the player profile usable even if season options fail to load.
      }
    };

    void loadSeasons();
  }, []);

  useEffect(() => {
    const loadPlayerProfile = async () => {
      if (!playerId) {
        setErrorMessage("Player not found.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const playerProfile = await getPlayerProfile(
          playerId,
          selectedSeason === "all" ? undefined : selectedSeason
        );
        setProfile(playerProfile);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not load player profile.";

        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPlayerProfile();
  }, [playerId, selectedSeason]);

  return (
    <Container maxWidth="xl">
      <Stack spacing={4}>
        <Box>
          <Button
            component={Link}
            href="/players"
            startIcon={<ArrowBackRoundedIcon />}
            variant="text"
            sx={{
              mb: 2,
              px: 0,
              minWidth: 0,
              color: "text.secondary",
              "&:hover": {
                backgroundColor: "transparent",
                color: "text.primary"
              }
            }}
          >
            Back to Squad
          </Button>

          {profile && (
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>
                    {formatName(profile.name)}
                  </Typography>

                  <Chip label={profile.role} color="primary" size="small" />
                </Stack>

                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="player-profile-season-filter-label">Season</InputLabel>
                  <Select
                    labelId="player-profile-season-filter-label"
                    value={selectedSeason}
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

              <Typography color="text.secondary">
                {currentTeamName} player profile with batting, bowling, and recent-match contributions.
              </Typography>
            </Stack>
          )}
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
        ) : profile ? (
          <>
            <Grid container spacing={3} alignItems="stretch">
              <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                <SummaryCard
                  label="Matches Played"
                  value={profile.matchesPlayed}
                  icon={<SportsCricketRoundedIcon />}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                <SummaryCard
                  label="Total Runs"
                  value={profile.totalRuns}
                  icon={<FlashOnRoundedIcon />}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                <SummaryCard
                  label="Strike Rate"
                  value={profile.strikeRate ? profile.strikeRate.toFixed(2) : "-"}
                  icon={<TrackChangesRoundedIcon />}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                <SummaryCard
                  label="Wickets / Economy"
                  value={
                    profile.totalWickets > 0 || profile.economy !== null
                      ? `${profile.totalWickets} / ${profile.economy?.toFixed(2) ?? "-"}`
                      : "-"
                  }
                  icon={<WaterDropRoundedIcon />}
                />
              </Grid>

            </Grid>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={2}>
                      <Typography variant="h5">Profile Summary</Typography>

                      <Stack direction="row" justifyContent="space-between">
                        <Typography color="text.secondary">Batting Matches</Typography>
                        <Typography fontWeight={700}>{profile.battingMatches}</Typography>
                      </Stack>

                      <Stack direction="row" justifyContent="space-between">
                        <Typography color="text.secondary">Bowling Matches</Typography>
                        <Typography fontWeight={700}>{profile.bowlingMatches}</Typography>
                      </Stack>

                      <Stack direction="row" justifyContent="space-between">
                        <Typography color="text.secondary">Primary Output</Typography>
                        <Typography fontWeight={700}>
                          {profile.role === "Bowler"
                            ? `Economy ${profile.economy?.toFixed(2) ?? "-"}`
                            : `Strike Rate ${profile.strikeRate?.toFixed(2) ?? "-"}`}
                        </Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 7 }}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 0 }}>
                    <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                      <Typography variant="h5">Recent Matches</Typography>
                    </Box>

                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Opponent</TableCell>
                            <TableCell>Runs</TableCell>
                            <TableCell>Wkts</TableCell>
                            <TableCell>Result</TableCell>
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          {profile.recentMatches.map((match) => (
                            <TableRow key={match.id}>
                              <TableCell>
                                {match.matchDate ? formatDate(match.matchDate) : "-"}
                              </TableCell>
                              <TableCell>
                                <Stack spacing={0.25}>
                                  <Typography fontWeight={600}>
                                    {match.opponentName ?? "Unknown Opponent"}
                                  </Typography>
                                  {match.matchCode && (
                                    <Typography variant="caption" color="text.secondary">
                                      {match.matchCode}
                                    </Typography>
                                  )}
                                </Stack>
                              </TableCell>
                              <TableCell>{match.runs}</TableCell>
                              <TableCell>{match.wickets}</TableCell>
                              <TableCell>
                                <Chip
                                  label={match.result ?? "Unknown"}
                                  color={
                                    match.result === "Won"
                                      ? "success"
                                      : match.result === "Lost"
                                        ? "error"
                                        : "default"
                                  }
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          ))}

                          {profile.recentMatches.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5}>
                                <Typography color="text.secondary">
                                  No recent match contributions found for this player.
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
        ) : null}
      </Stack>
    </Container>
  );
}
