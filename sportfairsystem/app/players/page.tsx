"use client";

import Link from "next/link";
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
  Typography
} from "@mui/material";
import FlashOnRoundedIcon from "@mui/icons-material/FlashOnRounded";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricketRounded";

import { formatName } from "@/app/services/formatname";
import {
  SeasonOption,
  PlayerSummary,
  getPlayerSeasons,
  getSquadPlayerSummaries
} from "@/app/services/playerProfileService";

const CARD_LILAC = "#F4F1FF";
const CARD_INDIGO = "#5B5FEF";

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
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
        // Keep the player view usable even if season options fail to load.
      }
    };

    void loadSeasons();
  }, []);

  useEffect(() => {
    const loadSquad = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const playerCards = await getSquadPlayerSummaries(
          selectedSeason === "all" ? undefined : selectedSeason
        );
        setPlayers(playerCards);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not load squad players.";

        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSquad();
  }, [selectedSeason]);

  return (
    <Container maxWidth="lg">
      <Stack spacing={4}>
        <Stack direction="row" justifyContent="flex-end">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="players-season-filter-label">Season</InputLabel>
            <Select
              labelId="players-season-filter-label"
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
        ) : players.length === 0 ? (
          <Alert severity="info">
            No squad players found yet. Add players from the match preview flow.
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {players.map((player) => (
              <Grid key={player.id} size={{ xs: 12, md: 6 }}>
                <Link
                  href={`/players/${player.id}`}
                  style={{ display: "block", textDecoration: "none", color: "inherit" }}
                >
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
                      transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        borderColor: "primary.main",
                        boxShadow: "0 16px 30px rgba(15, 23, 42, 0.08)"
                      }
                    }}
                  >
                    <CardContent sx={{ px: 2.5, py: 2 }}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        spacing={1.5}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: 2,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: CARD_INDIGO,
                              backgroundColor: CARD_LILAC,
                              flexShrink: 0
                            }}
                          >
                            {player.role === "Bowler" ? (
                              <SportsCricketRoundedIcon />
                            ) : (
                              <FlashOnRoundedIcon />
                            )}
                          </Box>

                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ minWidth: 0, flexWrap: "wrap" }}
                          >
                            <Typography
                              variant="h5"
                              sx={{
                                fontWeight: 800,
                                lineHeight: 1.1
                              }}
                            >
                              {formatName(player.name)}
                            </Typography>

                          <Chip
                            label={player.performanceLabel}
                            color={player.performanceColor}
                            size="small"
                            sx={{
                              width: "fit-content",
                              height: 20,
                              "& .MuiChip-label": {
                                px: 1,
                                fontSize: "0.72rem",
                                fontWeight: 600
                              }
                            }}
                            />
                          </Stack>
                        </Stack>

                        <Stack spacing={0} alignItems="flex-end" sx={{ flexShrink: 0 }}>
                          <Typography
                            variant="h4"
                            sx={{
                              lineHeight: 1,
                              fontWeight: 800,
                              color: CARD_INDIGO
                            }}
                          >
                            {player.matchesPlayed}
                          </Typography>

                          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>
                            MATCHES
                          </Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Link>
              </Grid>
            ))}
          </Grid>
        )}

        <Alert severity="info" variant="outlined">
          Captain and wicket keeper assignment should be added in Phase 4 with team-admin controls and persisted fields.
        </Alert>
      </Stack>
    </Container>
  );
}
