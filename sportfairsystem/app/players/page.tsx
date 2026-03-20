"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Drawer,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  useMediaQuery,
  Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import FrontHandRoundedIcon from "@mui/icons-material/FrontHandRounded";
import SportsBaseballRoundedIcon from "@mui/icons-material/SportsBaseballRounded";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricketRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";

import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import { formatName } from "@/app/services/formatname";
import {
  SeasonOption,
  PlayerSummary,
  getPlayerSeasons,
  getSquadPlayerSummaries
} from "@/app/services/playerProfileService";
import { getLatestSeasonValue } from "@/app/utils/seasonSelection";
import { readStoredSeasonFilter, storeSeasonFilter } from "@/app/utils/seasonFilterStorage";

const PLAYERS_SEASON_STORAGE_KEY = "sportfairsystem:season-filter:players";

type PlayerSortOption = "a-z" | "z-a";

function buildMetadataChips(player: PlayerSummary) {
  const chips: Array<{ key: string; label: string; color?: "primary" | "success" | "default" }> = [];

  if (player.isCaptain) {
    chips.push({ key: "captain", label: "Captain", color: "primary" });
  }

  if (player.isWicketKeeper) {
    chips.push({ key: "wicket-keeper", label: "Wicket Keeper", color: "success" });
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

function getPlayerCardIcon(player: PlayerSummary) {
  if (player.isWicketKeeper) {
    return <FrontHandRoundedIcon />;
  }

  if (player.role === "Bowler") {
    return <SportsBaseballRoundedIcon />;
  }

  return <SportsCricketRoundedIcon />;
}

export default function PlayersPage() {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [hasResolvedSeason, setHasResolvedSeason] = useState(false);
  const [selectedSort, setSelectedSort] = useState<PlayerSortOption>("a-z");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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
      } finally {
        setHasResolvedSeason(true);
      }
    };

    void loadSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      storeSeasonFilter(PLAYERS_SEASON_STORAGE_KEY, selectedSeason);
    }
  }, [selectedSeason]);

  useEffect(() => {
    if (!hasResolvedSeason && !selectedSeason) {
      return;
    }

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
  }, [hasResolvedSeason, selectedSeason]);

  const visiblePlayers = [...players].sort((left, right) => {
      const direction = selectedSort === "a-z" ? 1 : -1;
      return left.name.localeCompare(right.name) * direction;
    });
  const groupedPlayers = {
    batters: visiblePlayers.filter((player) => getPlayerGroup(player) === "batters"),
    bowlers: visiblePlayers.filter((player) => getPlayerGroup(player) === "bowlers"),
    allRounders: visiblePlayers.filter((player) => getPlayerGroup(player) === "all-rounders")
  };

  const filterControls = (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      sx={{ width: "100%" }}
    >
      <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 180 } }}>
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

      <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
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
  );

  return (
    <Container maxWidth="lg">
      <Stack spacing={4}>
        <Box sx={{ display: { xs: "block", md: "none" } }}>
          <TeamPageHeader
            eyebrow="Squad Directory"
            description="Browse player profiles, review squad tags, and jump into the current season quickly."
            action={(
              <Button
                variant="outlined"
                startIcon={<TuneRoundedIcon />}
                onClick={() => setMobileFiltersOpen(true)}
                sx={{
                  width: { xs: "100%", sm: "auto" },
                  alignSelf: "flex-start",
                  color: "#FFFFFF",
                  borderColor: alpha("#FFFFFF", 0.22),
                  backgroundColor: alpha("#FFFFFF", 0.04),
                  "&:hover": {
                    borderColor: alpha("#FFFFFF", 0.34),
                    backgroundColor: alpha("#FFFFFF", 0.08)
                  }
                }}
              >
                Filters
              </Button>
            )}
          />
        </Box>

        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
        >
          <Box />

          <Box sx={{ display: { xs: "none", md: "block" }, width: { md: "auto" } }}>
            {filterControls}
          </Box>
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
                          <Box
                            role="link"
                            tabIndex={0}
                            onClick={() => router.push(`/players/${player.id}`)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                router.push(`/players/${player.id}`);
                              }
                            }}
                            sx={{
                              backgroundColor: "background.paper",
                              transition: "background-color .18s ease",
                              cursor: "pointer",
                              "&:focus-visible": {
                                outline: "2px solid",
                                outlineColor: "primary.main",
                                outlineOffset: -2
                              }
                            }}
                          >
                            <CardContent
                              className="player-card-body"
                              sx={{
                                px: { xs: 2, sm: 2.5 },
                                py: { xs: 2, sm: 2.25 }
                              }}
                            >
                              <Stack spacing={1.75}>
                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  justifyContent="space-between"
                                  alignItems={{ xs: "center", sm: "center" }}
                                  spacing={1.5}
                                >
                                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, width: "100%" }}>
                                    <Box
                                      sx={{
                                        width: { xs: 42, sm: 44 },
                                        height: { xs: 42, sm: 44 },
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
                                      {getPlayerCardIcon(player)}
                                    </Box>

                                    <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                                      <Stack
                                        direction="row"
                                        spacing={0.75}
                                        useFlexGap
                                        flexWrap="wrap"
                                        alignItems="center"
                                        sx={{ minWidth: 0 }}
                                      >
                                        <Typography
                                          variant="h5"
                                          sx={{
                                            color: "text.primary",
                                            fontWeight: 800,
                                            lineHeight: 1.12,
                                            fontSize: { xs: "1.15rem", sm: "1.45rem" },
                                            wordBreak: "break-word"
                                          }}
                                        >
                                          {formatName(player.name)}
                                        </Typography>

                                        {buildMetadataChips(player).map((chip) => (
                                          <Chip
                                            key={chip.key}
                                            label={chip.label}
                                            size="small"
                                            variant={chip.color ? "filled" : "outlined"}
                                            sx={(theme) => ({
                                              color: chip.color === "primary"
                                                ? "#FFFFFF"
                                                : "text.primary",
                                              backgroundColor: chip.color === "primary"
                                                ? theme.palette.error.main
                                                : alpha(theme.palette.warning.main, 0.28),
                                              borderColor:
                                                theme.palette.mode === "dark"
                                                  ? alpha("#FFFFFF", 0.12)
                                                  : alpha(theme.palette.primary.main, 0.14)
                                            })}
                                          />
                                        ))}
                                      </Stack>
                                    </Stack>
                                  </Stack>

                                  <Stack
                                    spacing={0.35}
                                    alignItems={{ xs: "flex-start", sm: "flex-end" }}
                                    sx={{
                                      flexShrink: 0,
                                      minWidth: { xs: "auto", sm: 80 }
                                    }}
                                  >
                                    <Typography
                                      variant="overline"
                                      sx={{
                                        lineHeight: 1,
                                        color: "text.secondary",
                                        letterSpacing: 0.8
                                      }}
                                    >
                                      Matches
                                    </Typography>

                                    <Typography
                                      variant="h4"
                                      sx={{
                                        lineHeight: 1,
                                        fontWeight: 800,
                                        color: "text.primary",
                                        fontSize: { xs: "1.5rem", sm: "2rem" }
                                      }}
                                    >
                                      {player.matchesPlayed}
                                    </Typography>
                                  </Stack>
                                </Stack>
                              </Stack>
                            </CardContent>
                          </Box>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Stack>
              );
            })}
          </Stack>
        )}

      </Stack>

      <Drawer
        anchor="bottom"
        open={isMobile && mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            px: 2.25,
            pt: 1.5,
            pb: "calc(20px + env(safe-area-inset-bottom))"
          }
        }}
      >
        <Stack spacing={2.25}>
          <Box
            sx={{
              width: 44,
              height: 4,
              borderRadius: 999,
              backgroundColor: "divider",
              alignSelf: "center"
            }}
          />

          <Stack spacing={0.5}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Player Filters
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Narrow the squad view by season and sort order.
            </Typography>
          </Stack>

          {filterControls}

          <Button
            variant="contained"
            onClick={() => setMobileFiltersOpen(false)}
            sx={{ alignSelf: "stretch" }}
          >
            Apply Filters
          </Button>
        </Stack>
      </Drawer>
    </Container>
  );
}
