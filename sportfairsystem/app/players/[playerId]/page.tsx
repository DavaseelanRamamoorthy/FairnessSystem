"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  alpha,
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
  Pagination,
  Select,
  Stack,
  Typography
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AirlineSeatReclineNormalRoundedIcon from "@mui/icons-material/AirlineSeatReclineNormalRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricketRounded";
import FlashOnRoundedIcon from "@mui/icons-material/FlashOnRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
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
import MatchDetailPanel from "@/app/components/matches/MatchDetailPanel";

const PLAYER_NAVY = "#0A1A49";
const PLAYER_NAVY_DEEP = "#061230";
const PLAYER_RED = "#E53935";
const PLAYER_GOLD = "#F0A202";
const PLAYER_CORAL = "#FF6B57";
const KPI_CARD_STYLES = {
  navy: {
    topGradient: "linear-gradient(135deg, #2F6FED 0%, #5B5FEF 100%)",
    topTint: "rgba(255,255,255,0.1)",
    iconBg: "rgba(255,255,255,0.18)",
    valueColor: "#FFFFFF",
    footerBg: "#F6F8FF",
    footerText: "#3E4CC9"
  },
  red: {
    topGradient: "linear-gradient(135deg, #E53935 0%, #FF6B57 100%)",
    topTint: "rgba(255,255,255,0.1)",
    iconBg: "rgba(255,255,255,0.18)",
    valueColor: "#FFFFFF",
    footerBg: "#FFF1F0",
    footerText: "#C62F2B"
  },
  coral: {
    topGradient: "linear-gradient(135deg, #FF6B57 0%, #FF8B70 100%)",
    topTint: "rgba(255,255,255,0.1)",
    iconBg: "rgba(255,255,255,0.18)",
    valueColor: "#FFFFFF",
    footerBg: "#FFF4F1",
    footerText: "#D95B46"
  },
  gold: {
    topGradient: "linear-gradient(135deg, #D89B00 0%, #F0A202 100%)",
    topTint: "rgba(255,255,255,0.14)",
    iconBg: "rgba(255,255,255,0.22)",
    valueColor: "#FFFFFF",
    footerBg: "#FFF7E5",
    footerText: "#A86B00"
  },
  emerald: {
    topGradient: "linear-gradient(135deg, #0F9D58 0%, #29C77A 100%)",
    topTint: "rgba(255,255,255,0.1)",
    iconBg: "rgba(255,255,255,0.18)",
    valueColor: "#FFFFFF",
    footerBg: "#EEFBF4",
    footerText: "#11864B"
  },
  violet: {
    topGradient: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
    topTint: "rgba(255,255,255,0.1)",
    iconBg: "rgba(255,255,255,0.18)",
    valueColor: "#FFFFFF",
    footerBg: "#F5EEFF",
    footerText: "#7C3AED"
  },
  deep: {
    topGradient: "linear-gradient(135deg, #061230 0%, #0A1A49 65%, #102969 100%)",
    topTint: "rgba(255,255,255,0.08)",
    iconBg: "rgba(255,255,255,0.16)",
    valueColor: "#FFFFFF",
    footerBg: "#EEF3FF",
    footerText: "#102969"
  }
} as const;
const RECENT_MATCHES_PAGE_SIZE = 5;

type KpiCardTone = keyof typeof KPI_CARD_STYLES;

type ProfileKpiCardProps = {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  footer: string;
  tone?: KpiCardTone;
  compactValue?: boolean;
};

function getMetadataChipSx(kind: "role" | "captain" | "keeper" | "tag" | "style") {
  if (kind === "captain") {
    return {
      color: "#FFFFFF",
      backgroundColor: PLAYER_RED
    };
  }

  if (kind === "keeper") {
    return {
      color: PLAYER_NAVY_DEEP,
      backgroundColor: alpha(PLAYER_GOLD, 0.28)
    };
  }

  if (kind === "role") {
    return {
      color: "#FFFFFF",
      backgroundColor: PLAYER_CORAL
    };
  }

  return {
    color: PLAYER_NAVY,
    backgroundColor: alpha("#DCE7FF", 0.52),
    borderColor: alpha(PLAYER_NAVY, 0.14)
  };
}

function getBestFitLabel(profile: PlayerProfile) {
  if (profile.battingMatches > 0 && profile.bowlingMatches > 0) {
    return "All-Rounder";
  }

  if (profile.bowlingMatches > profile.battingMatches) {
    return "Bowler";
  }

  if (profile.battingMatches > 0) {
    return "Batter";
  }

  return "Player";
}

function formatUsageFooter(profile: PlayerProfile) {
  if (profile.totalTeamMatches === 0) {
    return "No team matches in scope";
  }

  return `${profile.matchesPlayed} of ${profile.totalTeamMatches} selected matches`;
}

function formatActiveUsageFooter(profile: PlayerProfile) {
  if (profile.totalTeamMatches === 0) {
    return "No team matches in scope";
  }

  return `${profile.activeMatches} of ${profile.totalTeamMatches} active matches`;
}

function formatBenchFooter(profile: PlayerProfile) {
  if (profile.matchesPlayed === 0) {
    return "No selected matches in scope";
  }

  const benchRate = Math.round((profile.benchMatches / profile.matchesPlayed) * 100);
  return `${benchRate}% of selected matches were unused`;
}

function buildPlayerSummaryText(profile: PlayerProfile, usagePercent: number, activeUsagePercent: number) {
  const name = formatName(profile.name);
  const bestFit = getBestFitLabel(profile);
  const selectionLine = `${profile.matchesPlayed} of ${profile.totalTeamMatches} team matches`;
  const activeLine = `${profile.activeMatches} active matches`;
  const battingLine = profile.totalRuns > 0
    ? `${profile.totalRuns} runs at SR ${profile.strikeRate?.toFixed(2) ?? "-"}`
    : "no major batting output yet";
  const bowlingLine = profile.totalWickets > 0
    ? `${profile.totalWickets} wickets at EC ${profile.economy?.toFixed(2) ?? "-"}`
    : "limited bowling output so far";

  if (bestFit === "All-Rounder") {
    return `${name} is currently profiling as an All-Rounder for ${currentTeamName}, with selection usage at ${usagePercent}% and active usage at ${activeUsagePercent}%. Across ${selectionLine}, the player has delivered ${battingLine} and ${bowlingLine}, making them a two-phase contributor in the current scope.`;
  }

  if (bestFit === "Bowler") {
    return `${name} is currently profiling as a Bowler for ${currentTeamName}. The player has been selected in ${selectionLine}, with ${activeLine} and ${activeUsagePercent}% active usage. The strongest return is ${bowlingLine}, while batting impact is currently ${battingLine}.`;
  }

  if (bestFit === "Batter") {
    return `${name} is currently profiling as a Batter for ${currentTeamName}, with selection usage at ${usagePercent}% and active usage at ${activeUsagePercent}%. Across ${selectionLine}, the primary output is ${battingLine}, while bowling impact remains ${bowlingLine}.`;
  }

  return `${name} is still developing into a clearer role fit. The player has been selected in ${selectionLine}, with ${activeLine}, and currently shows ${battingLine} alongside ${bowlingLine}.`;
}

function ProfileKpiCard({
  label,
  value,
  icon,
  footer,
  tone = "navy",
  compactValue = false
}: ProfileKpiCardProps) {
  const style = KPI_CARD_STYLES[tone];

  return (
    <Card
      variant="outlined"
      sx={{
        width: "100%",
        height: "100%",
        minHeight: 184,
        borderRadius: 3,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderColor: "transparent"
      }}
    >
      <Box
        sx={{
          minHeight: 122,
          flex: 1,
          px: 2.5,
          py: 2.25,
          color: "#FFFFFF",
          background: style.topGradient,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background: [
              `radial-gradient(circle at top right, ${style.topTint}, transparent 28%)`,
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 100%)"
            ].join(", ")
          }
        }}
      >
        <Stack
          sx={{
            position: "relative",
            zIndex: 1,
            height: "100%",
            justifyContent: "space-between"
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            spacing={2}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: style.iconBg,
                flexShrink: 0
              }}
            >
              {icon}
            </Box>

            <Stack spacing={0.75} sx={{ alignItems: "flex-end", textAlign: "right", minWidth: 0 }}>
              <Typography
                variant="overline"
                sx={{
                  color: alpha("#FFFFFF", 0.82),
                  letterSpacing: 1.1,
                  lineHeight: 1.2
                }}
              >
                {label}
              </Typography>
              <Typography
                sx={{
                  fontWeight: 800,
                  lineHeight: 0.95,
                  color: style.valueColor,
                  fontSize: compactValue
                    ? "clamp(1.8rem, 2.2vw, 2.5rem)"
                    : "clamp(2.6rem, 3.4vw, 3.5rem)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {value}
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </Box>

      <Box
        sx={{
          px: 2.5,
          py: 1.25,
          bgcolor: style.footerBg,
          borderTop: "1px solid",
          borderColor: alpha(style.footerText, 0.12)
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: style.footerText
          }}
        >
          {footer}
        </Typography>
      </Box>
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
  const [recentMatchesPage, setRecentMatchesPage] = useState(0);
  const [expandedMatchId, setExpandedMatchId] = useState<string | false>(false);

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

  useEffect(() => {
    setRecentMatchesPage(0);
  }, [selectedSeason, profile?.id]);

  const usagePercent = profile && profile.totalTeamMatches > 0
    ? Math.round((profile.matchesPlayed / profile.totalTeamMatches) * 100)
    : 0;
  const activeUsagePercent = profile && profile.totalTeamMatches > 0
    ? Math.round((profile.activeMatches / profile.totalTeamMatches) * 100)
    : 0;
  const playerSummaryText = profile
    ? buildPlayerSummaryText(profile, usagePercent, activeUsagePercent)
    : "";

  const recentMatchesPageCount = profile
    ? Math.max(1, Math.ceil(profile.recentMatches.length / RECENT_MATCHES_PAGE_SIZE))
    : 1;

  useEffect(() => {
    const visibleMatches = profile
      ? profile.recentMatches.slice(
        recentMatchesPage * RECENT_MATCHES_PAGE_SIZE,
        recentMatchesPage * RECENT_MATCHES_PAGE_SIZE + RECENT_MATCHES_PAGE_SIZE
      )
      : [];

    if (visibleMatches.length === 0) {
      setExpandedMatchId(false);
      return;
    }

    setExpandedMatchId((currentExpandedMatchId) => {
      if (
        currentExpandedMatchId
        && visibleMatches.some((match) => match.id === currentExpandedMatchId)
      ) {
        return currentExpandedMatchId;
      }

      return visibleMatches[0].id;
    });
  }, [profile, recentMatchesPage]);

  const paginatedRecentMatches = profile
    ? profile.recentMatches.slice(
      recentMatchesPage * RECENT_MATCHES_PAGE_SIZE,
      recentMatchesPage * RECENT_MATCHES_PAGE_SIZE + RECENT_MATCHES_PAGE_SIZE
    )
    : [];

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
              color: alpha(PLAYER_NAVY, 0.76),
              "&:hover": {
                backgroundColor: "transparent",
                color: PLAYER_NAVY
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
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="h3" sx={{ fontWeight: 800, color: PLAYER_NAVY_DEEP }}>
                      {formatName(profile.name)}
                    </Typography>

                    <Chip label={profile.role} size="small" sx={getMetadataChipSx("role")} />
                    {profile.isCaptain && (
                      <Chip label="Captain" size="small" sx={getMetadataChipSx("captain")} />
                    )}
                    {profile.isWicketKeeper && (
                      <Chip
                        label="Wicket Keeper"
                        size="small"
                        sx={getMetadataChipSx("keeper")}
                      />
                    )}
                  </Stack>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {profile.roleTags.map((roleTag) => (
                      <Chip
                        key={roleTag}
                        label={roleTag}
                        size="small"
                        variant="outlined"
                        sx={getMetadataChipSx("tag")}
                      />
                    ))}

                    {profile.battingStyle && (
                      <Chip
                        label={profile.battingStyle}
                        size="small"
                        variant="outlined"
                        sx={getMetadataChipSx("style")}
                      />
                    )}
                  </Stack>
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

              <Card
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  borderColor: alpha(PLAYER_NAVY, 0.12),
                  background: `linear-gradient(180deg, ${alpha("#DCE7FF", 0.16)} 0%, #FFFFFF 100%)`
                }}
              >
                <CardContent sx={{ px: 2.5, py: 2.25 }}>
                  <Stack spacing={1}>
                    <Typography
                      variant="overline"
                      sx={{ color: PLAYER_CORAL, letterSpacing: 1.1, fontWeight: 800 }}
                    >
                      AI Summary
                    </Typography>
                    <Typography sx={{ color: PLAYER_NAVY, lineHeight: 1.7 }}>
                      {playerSummaryText}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
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
              <Grid size={{ xs: 12, sm: 6, lg: 3, xl: 3 }} sx={{ display: "flex" }}>
                <ProfileKpiCard
                  label="Matches Played"
                  value={profile.matchesPlayed}
                  icon={<SportsCricketRoundedIcon />}
                  tone="navy"
                  footer="Moonwalkers appearances"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3, xl: 3 }} sx={{ display: "flex" }}>
                <ProfileKpiCard
                  label="Selection Usage"
                  value={`${usagePercent}%`}
                  icon={<GroupsRoundedIcon />}
                  tone="deep"
                  footer={formatUsageFooter(profile)}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3, xl: 3 }} sx={{ display: "flex" }}>
                <ProfileKpiCard
                  label="Active Usage"
                  value={`${activeUsagePercent}%`}
                  icon={<TrackChangesRoundedIcon />}
                  tone="emerald"
                  footer={formatActiveUsageFooter(profile)}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3, xl: 3 }} sx={{ display: "flex" }}>
                <ProfileKpiCard
                  label="Bench Stats"
                  value={profile.benchMatches}
                  icon={<AirlineSeatReclineNormalRoundedIcon />}
                  tone="coral"
                  footer={formatBenchFooter(profile)}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3, xl: 3 }} sx={{ display: "flex" }}>
                <ProfileKpiCard
                  label="Batting Matches"
                  value={profile.battingMatches}
                  icon={<FlashOnRoundedIcon />}
                  tone="red"
                  footer="Matches with batting involvement"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3, xl: 3 }} sx={{ display: "flex" }}>
                <ProfileKpiCard
                  label="Bowling Matches"
                  value={profile.bowlingMatches}
                  icon={<WaterDropRoundedIcon />}
                  tone="gold"
                  footer="Matches with bowling involvement"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3, xl: 3 }} sx={{ display: "flex" }}>
                <ProfileKpiCard
                  label="Total Runs"
                  value={profile.totalRuns}
                  icon={<FlashOnRoundedIcon />}
                  tone="red"
                  footer="Batting contribution"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3, xl: 3 }} sx={{ display: "flex" }}>
                <ProfileKpiCard
                  label="SR"
                  value={profile.strikeRate ? profile.strikeRate.toFixed(2) : "-"}
                  icon={<TrackChangesRoundedIcon />}
                  tone="violet"
                  footer="Strike rate in scope"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3, xl: 3 }} sx={{ display: "flex" }}>
                <ProfileKpiCard
                  label="Wkts / EC"
                  value={
                    profile.totalWickets > 0 || profile.economy !== null
                      ? `${profile.totalWickets} / ${profile.economy?.toFixed(2) ?? "-"}`
                      : "-"
                  }
                  icon={<WaterDropRoundedIcon />}
                  tone="gold"
                  footer="Bowling contribution"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3, xl: 3 }} sx={{ display: "flex" }}>
                <ProfileKpiCard
                  label="Best Fit"
                  value={getBestFitLabel(profile)}
                  icon={<TrackChangesRoundedIcon />}
                  tone="violet"
                  footer="Best-fit role signal"
                  compactValue
                />
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    borderColor: alpha(PLAYER_NAVY, 0.12)
                  }}
                >
                  <CardContent sx={{ p: 0 }}>
                    <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                      <Typography variant="h5" sx={{ color: PLAYER_NAVY_DEEP, fontWeight: 800 }}>
                        Matches Played
                      </Typography>
                    </Box>

                    <Stack spacing={1.25} sx={{ px: 2, pb: 2 }}>
                      {paginatedRecentMatches.map((match) => (
                        <Accordion
                          key={match.id}
                          expanded={expandedMatchId === match.id}
                          onChange={(_event, isExpanded) => {
                            setExpandedMatchId(isExpanded ? match.id : false);
                          }}
                          disableGutters
                          sx={{
                            borderRadius: 3,
                            overflow: "hidden",
                            border: "1px solid",
                            borderColor: alpha(PLAYER_NAVY, 0.1),
                            boxShadow: "none",
                            "&::before": {
                              display: "none"
                            }
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMoreRoundedIcon sx={{ color: PLAYER_NAVY }} />}
                            sx={{
                              px: 2,
                              py: 1.25,
                              backgroundColor: alpha("#DCE7FF", 0.14),
                              "& .MuiAccordionSummary-content": {
                                my: 0
                              }
                            }}
                          >
                            <Stack
                              direction={{ xs: "column", md: "row" }}
                              spacing={2}
                              alignItems={{ xs: "flex-start", md: "center" }}
                              justifyContent="space-between"
                              sx={{ width: "100%", pr: 1 }}
                            >
                              <Stack spacing={0.35}>
                                <Typography sx={{ fontWeight: 700, color: PLAYER_NAVY_DEEP }}>
                                  {match.opponentName ?? "Unknown Opponent"}
                                </Typography>
                                <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
                                  <Typography variant="body2" color="text.secondary">
                                    {match.matchDate ? formatDate(match.matchDate) : "-"}
                                  </Typography>
                                  {match.matchCode && (
                                    <Typography variant="body2" color="text.secondary">
                                      {match.matchCode}
                                    </Typography>
                                  )}
                                </Stack>
                              </Stack>

                              <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                                <Chip
                                  label={`${match.runs} Runs`}
                                  size="small"
                                  sx={{
                                    color: "#FFFFFF",
                                    backgroundColor: PLAYER_CORAL
                                  }}
                                />
                                <Chip
                                  label={`${match.wickets} Wkts`}
                                  size="small"
                                  sx={{
                                    color: PLAYER_NAVY_DEEP,
                                    backgroundColor: alpha(PLAYER_GOLD, 0.28)
                                  }}
                                />
                                <Chip
                                  label={match.result ?? "Unknown"}
                                  size="small"
                                  sx={
                                    match.result === "Won"
                                      ? {
                                        color: PLAYER_NAVY_DEEP,
                                        backgroundColor: alpha(PLAYER_GOLD, 0.28)
                                      }
                                      : match.result === "Lost"
                                        ? {
                                          color: "#FFFFFF",
                                          backgroundColor: PLAYER_RED
                                        }
                                        : {
                                          color: PLAYER_NAVY,
                                          backgroundColor: alpha("#DCE7FF", 0.52)
                                        }
                                  }
                                />
                              </Stack>
                            </Stack>
                          </AccordionSummary>

                          <AccordionDetails sx={{ p: 2 }}>
                            <MatchDetailPanel match={match.scorecard} />
                          </AccordionDetails>
                        </Accordion>
                      ))}

                      {profile.recentMatches.length === 0 && (
                        <Box sx={{ px: 1, py: 2 }}>
                          <Typography color="text.secondary">
                            No match appearances found for this player.
                          </Typography>
                        </Box>
                      )}
                    </Stack>

                    {profile.recentMatches.length > RECENT_MATCHES_PAGE_SIZE && (
                      <Box
                        sx={{
                          px: 2.5,
                          py: 2,
                          borderTop: "1px solid",
                          borderColor: alpha(PLAYER_NAVY, 0.08),
                          display: "flex",
                          justifyContent: "center"
                        }}
                      >
                        <Pagination
                          count={recentMatchesPageCount}
                          page={recentMatchesPage + 1}
                          onChange={(_event, nextPage) => setRecentMatchesPage(nextPage - 1)}
                          color="primary"
                          shape="rounded"
                        />
                      </Box>
                    )}
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
