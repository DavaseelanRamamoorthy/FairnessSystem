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

const CARD_LILAC = "#F4F1FF";
const CARD_INDIGO = "#5B5FEF";
const PLAYER_NAVY = "#0A1A49";
const PLAYER_NAVY_DEEP = "#061230";
const PLAYER_RED = "#E53935";
const PLAYER_GOLD = "#F0A202";
const PLAYER_CORAL = "#FF6B57";

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

function getPerformanceChipStyles(player: PlayerSummary) {
  if (player.role === "Bowler") {
    return {
      color: PLAYER_NAVY_DEEP,
      backgroundColor: alpha(PLAYER_GOLD, 0.96)
    };
  }

  return {
    color: "#FFFFFF",
    backgroundColor: PLAYER_CORAL
  };
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
  const [selectedSeason, setSelectedSeason] = useState("all");
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
        {successMessage && <Alert severity="success">{successMessage}</Alert>}

        {squadAdminEnabled && metadataColumnsReady === false && (
          <Alert severity="warning" variant="outlined">
            Squad admin UI is enabled, but the database columns are not ready yet. Run
            `database/phase4_squad_metadata.sql` before editing captain, wicket keeper, or role
            tags.
          </Alert>
        )}

        {showAdminControls && (
          <Alert severity="info" variant="outlined">
            Squad metadata is editable here for the current team.
          </Alert>
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
        ) : visiblePlayers.length === 0 ? (
          <Alert severity="info">
            {selectedSeason === "all"
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
                    <Typography variant="h5" sx={{ fontWeight: 800, color: PLAYER_NAVY_DEEP }}>
                      {section.title}
                    </Typography>
                    <Chip
                      label={`${section.players.length} players`}
                      size="small"
                      sx={{
                        color: PLAYER_NAVY,
                        backgroundColor: alpha("#DCE7FF", 0.52),
                        borderColor: alpha(PLAYER_NAVY, 0.14)
                      }}
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
                            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
                            transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
                            "&:hover": {
                              transform: "translateY(-2px)",
                              borderColor: "#0E63FF",
                              boxShadow: "0 16px 30px rgba(15, 23, 42, 0.08)"
                            },
                            "&:hover .player-card-body, &:hover .player-card-footer": {
                              backgroundColor: alpha("#DCE7FF", 0.34)
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
                                backgroundColor: "#FFFFFF",
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
                                            color: PLAYER_NAVY_DEEP,
                                            fontWeight: 800,
                                            lineHeight: 1.1
                                          }}
                                        >
                                          {formatName(player.name)}
                                        </Typography>

                                        <Chip
                                          label={getPerformanceChipLabel(player.performanceLabel)}
                                          size="small"
                                          sx={{
                                            width: "fit-content",
                                            height: 20,
                                            color: getPerformanceChipStyles(player).color,
                                            backgroundColor: getPerformanceChipStyles(player).backgroundColor,
                                            "& .MuiChip-label": {
                                              px: 1,
                                              fontSize: "0.72rem",
                                              fontWeight: 600
                                            }
                                          }}
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
                                              sx={{
                                                color: chip.color === "primary"
                                                  ? "#FFFFFF"
                                                  : chip.color === "success"
                                                    ? PLAYER_NAVY_DEEP
                                                    : PLAYER_NAVY,
                                                backgroundColor: chip.color === "primary"
                                                  ? PLAYER_RED
                                                  : chip.color === "success"
                                                    ? alpha(PLAYER_GOLD, 0.28)
                                                    : alpha("#DCE7FF", 0.52),
                                                borderColor: alpha(PLAYER_NAVY, 0.14)
                                              }}
                                            />
                                          ))
                                        ) : (
                                          <Chip
                                            label="No squad tags yet"
                                            size="small"
                                            variant="outlined"
                                            sx={{ color: PLAYER_NAVY, borderColor: alpha(PLAYER_NAVY, 0.16) }}
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
                                        color: PLAYER_NAVY
                                      }}
                                    >
                                      {player.matchesPlayed}
                                    </Typography>

                                    <Typography
                                      variant="caption"
                                      sx={{
                                        mt: 0.35,
                                        lineHeight: 1.1,
                                        color: alpha(PLAYER_NAVY, 0.78)
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
                              backgroundColor: "#FFFFFF",
                              transition: "background-color .18s ease"
                            }}
                          >
                            <Button
                              component={Link}
                              href={`/players/${player.id}`}
                              size="small"
                              sx={{ color: "#0E63FF", fontWeight: 700 }}
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
                                sx={{ color: "#0E63FF", fontWeight: 700 }}
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
