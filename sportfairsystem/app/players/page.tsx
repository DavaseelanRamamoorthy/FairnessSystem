"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
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
  Typography
} from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FlashOnRoundedIcon from "@mui/icons-material/FlashOnRounded";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricketRounded";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import SquadMetadataDialog from "@/app/components/players/SquadMetadataDialog";
import { useAuth } from "@/app/context/AuthContext";
import { squadAdminEnabled } from "@/app/config/teamConfig";
import { formatName } from "@/app/services/formatname";
import {
  SeasonOption,
  PlayerSummary,
  getPlayerSeasons,
  getSquadPlayerSummaries
} from "@/app/services/playerProfileService";
import {
  hasSquadMetadataColumns,
  SquadMetadataValues,
  updateSquadPlayerMetadata
} from "@/app/services/squadService";
import { getLatestSeasonValue } from "@/app/utils/seasonSelection";
import { readStoredSeasonFilter, storeSeasonFilter } from "@/app/utils/seasonFilterStorage";

const PLAYERS_SEASON_STORAGE_KEY = "sportfairsystem:season-filter:players";

type PlayerSortOption = "a-z" | "z-a";

function getPerformanceChipLabel(label: string) {
  if (label.startsWith("Strike Rate ")) {
    return label.replace("Strike Rate ", "SR ");
  }

  if (label.startsWith("Economy ")) {
    return label.replace("Economy ", "EC ");
  }

  return label;
}

function buildMetadataChips(player: PlayerSummary) {
  const chips: Array<{ key: string; label: string; color?: "primary" | "success" | "default" }> = [];

  if (player.isCaptain) {
    chips.push({ key: "captain", label: "Captain", color: "primary" });
  }

  if (player.isWicketKeeper) {
    chips.push({ key: "wicket-keeper", label: "Wicket Keeper", color: "success" });
  }

  player.roleTags.forEach((roleTag) => {
    chips.push({ key: `tag-${roleTag}`, label: roleTag, color: "default" });
  });

  if (player.battingStyle) {
    chips.push({ key: "batting-style", label: player.battingStyle, color: "default" });
  }

  return chips;
}

function getPlayerGroup(player: PlayerSummary): "batters" | "bowlers" | "all-rounders" | null {
  const normalizedTags = player.roleTags.map((tag) => tag.trim().toLowerCase());
  const hasAllRounderTag = normalizedTags.includes("all-rounder") || normalizedTags.includes("all rounder");
  const hasBatterTag = normalizedTags.includes("batter");
  const hasBowlerTag = normalizedTags.includes("bowler");

  if (hasAllRounderTag || (hasBatterTag && hasBowlerTag)) {
    return "all-rounders";
  }

  if (hasBatterTag || player.role === "Batter") {
    return "batters";
  }

  if (hasBowlerTag || player.role === "Bowler") {
    return "bowlers";
  }

  return "batters";
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedSort, setSelectedSort] = useState<PlayerSortOption>("a-z");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<PlayerSummary | null>(null);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [metadataColumnsReady, setMetadataColumnsReady] = useState<boolean | null>(
    squadAdminEnabled ? null : false
  );
  const { isAdmin } = useAuth();

  useEffect(() => {
    const loadSeasons = async () => {
      try {
        const nextSeasons = await getPlayerSeasons();
        setSeasons(nextSeasons);
        const storedSeason = readStoredSeasonFilter(PLAYERS_SEASON_STORAGE_KEY);
        const nextSeasonValues = new Set(nextSeasons.map((season) => season.value));
        const resolvedSeason = storedSeason && nextSeasonValues.has(storedSeason)
          ? storedSeason
          : getLatestSeasonValue(nextSeasons);
        setSelectedSeason((currentSeason) =>
          currentSeason || resolvedSeason
        );
      } catch {
        // Keep the player view usable even if season options fail to load.
      }
    };

    void loadSeasons();
  }, []);

  useEffect(() => {
    if (!squadAdminEnabled) {
      return;
    }

    const loadMetadataSupport = async () => {
      try {
        setMetadataColumnsReady(await hasSquadMetadataColumns());
      } catch {
        setMetadataColumnsReady(false);
      }
    };

    void loadMetadataSupport();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      storeSeasonFilter(PLAYERS_SEASON_STORAGE_KEY, selectedSeason);
    }
  }, [selectedSeason]);

  useEffect(() => {
    const loadSquad = async () => {
      setIsLoading(true);
      setPlayers([]);
      setErrorMessage(null);

      try {
        const playerCards = await getSquadPlayerSummaries(
          !selectedSeason || selectedSeason === "all" ? undefined : selectedSeason
        );
        setPlayers(playerCards);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not load squad players.";

        setPlayers([]);
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSquad();
  }, [selectedSeason]);

  const canEditSquadMetadata = squadAdminEnabled && metadataColumnsReady === true;
  const showAdminControls = canEditSquadMetadata && isAdmin;
  const visiblePlayers = [...players].sort((left, right) => {
      const direction = selectedSort === "a-z" ? 1 : -1;
      return left.name.localeCompare(right.name) * direction;
    });
  const groupedPlayers = {
    batters: visiblePlayers.filter((player) => getPlayerGroup(player) === "batters"),
    bowlers: visiblePlayers.filter((player) => getPlayerGroup(player) === "bowlers"),
    allRounders: visiblePlayers.filter((player) => getPlayerGroup(player) === "all-rounders")
  };

  useEffect(() => {
    if (!isAdmin) {
      setEditingPlayer(null);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successMessage]);

  const handleSaveSquadMetadata = async (
    playerId: string,
    values: SquadMetadataValues
  ) => {
    try {
      setIsSavingMetadata(true);
      setErrorMessage(null);

      const updatedPlayer = await updateSquadPlayerMetadata(playerId, values);

      setPlayers((currentPlayers) => currentPlayers.map((player) => {
        if (player.id !== playerId) {
          return player;
        }

        return {
          ...player,
          battingStyle: updatedPlayer.battingStyle,
          isCaptain: updatedPlayer.isCaptain,
          isWicketKeeper: updatedPlayer.isWicketKeeper,
          roleTags: updatedPlayer.roleTags
        };
      }));

      setEditingPlayer((currentPlayer) => {
        if (!currentPlayer || currentPlayer.id !== playerId) {
          return null;
        }

        return {
          ...currentPlayer,
          battingStyle: updatedPlayer.battingStyle,
          isCaptain: updatedPlayer.isCaptain,
          isWicketKeeper: updatedPlayer.isWicketKeeper,
          roleTags: updatedPlayer.roleTags
        };
      });

      setSuccessMessage(`${formatName(updatedPlayer.name)} metadata updated.`);
      setEditingPlayer(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not update squad metadata.";

      setErrorMessage(message);
    } finally {
      setIsSavingMetadata(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Stack spacing={4}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
        >
          <Box />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: { xs: "100%", md: "auto" } }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="players-season-filter-label">Season</InputLabel>
              <Select
                labelId="players-season-filter-label"
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

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="players-sort-filter-label">Sort</InputLabel>
              <Select
                labelId="players-sort-filter-label"
                value={selectedSort}
                label="Sort"
                onChange={(event) => setSelectedSort(event.target.value as PlayerSortOption)}
              >
                <MenuItem value="a-z">A-Z</MenuItem>
                <MenuItem value="z-a">Z-A</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Stack>

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {successMessage && (
          <AutoHideAlert severity="success" resetKey={successMessage}>
            {successMessage}
          </AutoHideAlert>
        )}

        {squadAdminEnabled && metadataColumnsReady === false && (
          <AutoHideAlert severity="warning" variant="outlined">
            Squad metadata editing is not available in this environment yet.
          </AutoHideAlert>
        )}

        {showAdminControls && (
          <AutoHideAlert severity="info" variant="outlined">
            Squad metadata is editable here for the current team.
          </AutoHideAlert>
        )}

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
        ) : errorMessage ? null : visiblePlayers.length === 0 ? (
          <Alert severity="info">
            {!selectedSeason || selectedSeason === "all"
              ? "No squad players found yet. Add players from the match preview flow."
              : `No squad players found for the ${selectedSeason} season.`}
          </Alert>
        ) : (
          <Stack spacing={4}>
            {[
              { key: "batters", title: "Batters", players: groupedPlayers.batters },
              { key: "bowlers", title: "Bowlers", players: groupedPlayers.bowlers },
              { key: "all-rounders", title: "All-Rounders", players: groupedPlayers.allRounders }
            ].map((section) => {
              if (section.players.length === 0) {
                return null;
              }

              return (
                <Stack key={section.key} spacing={2.25}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary" }}>
                      {section.title}
                    </Typography>
                    <Chip
                      label={`${section.players.length} players`}
                      size="small"
                                              sx={(theme) => ({
                                                color: "text.primary",
                                                backgroundColor:
                                                  theme.palette.mode === "dark"
                                                    ? alpha("#FFFFFF", 0.08)
                                                    : alpha("#DCE7FF", 0.52),
                                                borderColor:
                                                  theme.palette.mode === "dark"
                                                    ? alpha("#FFFFFF", 0.12)
                                                    : alpha(theme.palette.primary.main, 0.14)
                                              })}
                                            />
                  </Stack>

                  <Grid container spacing={3}>
                    {section.players.map((player) => (
                      <Grid key={player.id} size={{ xs: 12, md: 6 }}>
                        <Card
                          variant="outlined"
                          sx={{
                            borderRadius: 3,
                            overflow: "hidden",
                            boxShadow: (theme) => theme.vars.customShadows.card,
                            transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
                            "&:hover": {
                              borderColor: (theme) => alpha(theme.palette.primary.main, 0.42),
                              boxShadow: (theme) => theme.vars.customShadows.z8
                            },
                            "&:hover .player-card-body, &:hover .player-card-footer": {
                              backgroundColor: "action.hover"
                            }
                          }}
                        >
                          <CardActionArea
                            component={Link}
                            href={`/players/${player.id}`}
                            sx={{
                              alignItems: "stretch",
                              borderRadius: 0,
                              "&:hover": {
                                backgroundColor: "transparent"
                              },
                              "& .MuiCardActionArea-focusHighlight": {
                                backgroundColor: "transparent"
                              }
                            }}
                          >
                            <CardContent
                              className="player-card-body"
                              sx={{
                                px: 2.5,
                                py: 2.25,
                                backgroundColor: "background.paper",
                                transition: "background-color .18s ease"
                              }}
                            >
                              <Stack spacing={2}>
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
                                        color: "primary.main",
                                        backgroundColor: (theme) =>
                                          alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.12),
                                        flexShrink: 0
                                      }}
                                    >
                                      {player.role === "Bowler" ? (
                                        <SportsCricketRoundedIcon />
                                      ) : (
                                        <FlashOnRoundedIcon />
                                      )}
                                    </Box>

                                    <Stack spacing={1} sx={{ minWidth: 0 }}>
                                      <Stack
                                        direction="row"
                                        spacing={1}
                                        alignItems="center"
                                        sx={{ minWidth: 0, flexWrap: "wrap" }}
                                      >
                                        <Typography
                                          variant="h5"
                                          sx={{
                                            color: "text.primary",
                                            fontWeight: 800,
                                            lineHeight: 1.1
                                          }}
                                        >
                                          {formatName(player.name)}
                                        </Typography>

                                        <Chip
                                          label={getPerformanceChipLabel(player.performanceLabel)}
                                          size="small"
                                          sx={(theme) => ({
                                            width: "fit-content",
                                            height: 20,
                                            color: player.role === "Bowler"
                                              ? theme.palette.warning.contrastText
                                              : theme.palette.error.contrastText,
                                            backgroundColor: player.role === "Bowler"
                                              ? theme.palette.warning.main
                                              : theme.palette.error.main,
                                            "& .MuiChip-label": {
                                              px: 1,
                                              fontSize: "0.72rem",
                                              fontWeight: 600
                                            }
                                          })}
                                        />
                                      </Stack>

                                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                        {buildMetadataChips(player).length > 0 ? (
                                          buildMetadataChips(player).map((chip) => (
                                            <Chip
                                              key={chip.key}
                                              label={chip.label}
                                              size="small"
                                              variant={chip.color ? "filled" : "outlined"}
                                              sx={(theme) => ({
                                                color: chip.color === "primary"
                                                  ? "#FFFFFF"
                                                  : chip.color === "success"
                                                    ? "text.primary"
                                                    : "text.primary",
                                                backgroundColor: chip.color === "primary"
                                                  ? theme.palette.error.main
                                                  : chip.color === "success"
                                                    ? alpha(theme.palette.warning.main, 0.28)
                                                    : (theme.palette.mode === "dark"
                                                      ? alpha("#FFFFFF", 0.08)
                                                      : alpha(theme.palette.primary.main, 0.08)),
                                                borderColor:
                                                  theme.palette.mode === "dark"
                                                    ? alpha("#FFFFFF", 0.12)
                                                    : alpha(theme.palette.primary.main, 0.14)
                                              })}
                                            />
                                          ))
                                        ) : (
                                          <Chip
                                            label="No squad tags yet"
                                            size="small"
                                            variant="outlined"
                                            sx={(theme) => ({
                                              color: "text.primary",
                                              borderColor:
                                                theme.palette.mode === "dark"
                                                  ? alpha("#FFFFFF", 0.14)
                                                  : alpha(theme.palette.primary.main, 0.16)
                                            })}
                                          />
                                        )}
                                      </Stack>
                                    </Stack>
                                  </Stack>

                                  <Stack spacing={0} alignItems="flex-end" sx={{ flexShrink: 0 }}>
                                    <Typography
                                      variant="h4"
                                      sx={{
                                        lineHeight: 1,
                                        fontWeight: 800,
                                        color: "text.primary"
                                      }}
                                    >
                                      {player.matchesPlayed}
                                    </Typography>

                                    <Typography
                                      variant="caption"
                                      sx={{
                                        mt: 0.35,
                                        lineHeight: 1.1,
                                        color: "text.secondary"
                                      }}
                                    >
                                      MATCHES
                                    </Typography>
                                  </Stack>
                                </Stack>
                              </Stack>
                            </CardContent>
                          </CardActionArea>

                          <Divider />

                          <CardActions
                            className="player-card-footer"
                            sx={{
                              px: 2.5,
                              py: 1.5,
                              justifyContent: "space-between",
                              backgroundColor: "background.paper",
                              transition: "background-color .18s ease"
                            }}
                          >
                            <Button
                              component={Link}
                              href={`/players/${player.id}`}
                              size="small"
                              sx={{ color: "primary.main", fontWeight: 700 }}
                            >
                              View Profile
                            </Button>

                            {showAdminControls && (
                              <Button
                                size="small"
                                startIcon={<EditRoundedIcon />}
                                onClick={() => {
                                  setSuccessMessage(null);
                                  setEditingPlayer(player);
                                }}
                                sx={{ color: "primary.main", fontWeight: 700 }}
                              >
                                Edit Metadata
                              </Button>
                            )}
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Stack>
              );
            })}
          </Stack>
        )}

        <SquadMetadataDialog
          open={!!editingPlayer}
          player={editingPlayer}
          isSaving={isSavingMetadata}
          onClose={() => setEditingPlayer(null)}
          onSave={handleSaveSquadMetadata}
        />
      </Stack>
    </Container>
  );
}
