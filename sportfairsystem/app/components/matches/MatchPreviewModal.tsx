"use client";

import React from "react";
import {
  Box,
  Typography,
  Stack,
  Paper,
  Modal,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  Tooltip
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { varAlpha } from "minimal-shared/utils";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import PersonRemoveRoundedIcon from "@mui/icons-material/PersonRemoveRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";

import MatchDetailPanel from "@/app/components/matches/MatchDetailPanel";
import { ParsedMatch, Innings } from "@/app/types/match.types";
import { formatName } from "@/app/services/formatname";

type PreviewPlayer = {
  name: string;
  exists: boolean;
  isGuest: boolean;
  addToSquad: boolean;
};

type PreviewMatchDetailShape = {
  team_a: string | null;
  team_b: string | null;
  match_date: string | null;
  result: string;
  innings: Array<{
    id: string;
    team_name: string | null;
    runs: number | null;
    wickets: number | null;
    overs: number | null;
    extras: number;
    batting_stats: NonNullable<Innings["battingStats"]>;
    bowling_stats: NonNullable<Innings["bowlingStats"]>;
    fall_of_wickets: NonNullable<Innings["fallOfWickets"]>;
  }>;
  match_players: Array<{
    id: string;
    team_name: string | null;
    player_name: string;
  }>;
};

type Props = {
  open: boolean;
  previewMatch: ParsedMatch | null;
  previewMatchId: string;
  previewPlayers: PreviewPlayer[];
  previewTitle?: string;
  previewQueueLabel?: string;
  onToggleAddToSquad: (playerName: string) => void;
  onClose: () => void;
  onSave: () => void;
  getYetToBat: (innings: Innings | undefined) => string[];
};

function buildPreviewMatchForDetail(
  previewMatch: ParsedMatch,
  previewPlayers: PreviewPlayer[],
  getYetToBat: (innings: Innings | undefined) => string[]
): PreviewMatchDetailShape {

  const innings = previewMatch.innings.map((inn, index) => {
    const battingStats = inn.battingStats ?? [];
    const bowlingStats = inn.bowlingStats ?? [];
    const fallOfWickets = inn.fallOfWickets ?? [];
    const yetToBat = getYetToBat(inn);
    const knownBatters = battingStats.map((player) => player.player_name);
    const teamPlayers = [...knownBatters, ...yetToBat]
      .filter((name, playerIndex, allNames) => allNames.indexOf(name) === playerIndex)
      .map((name, playerIndex) => ({
        id: `${index}-player-${playerIndex}`,
        team_name: inn.teamName,
        player_name: name
      }));

    return {
      id: `preview-innings-${index}`,
      team_name: inn.teamName,
      runs: inn.runs,
      wickets: inn.wickets,
      overs: inn.overs,
      extras: inn.extras ?? 0,
      batting_stats: battingStats,
      bowling_stats: bowlingStats,
      fall_of_wickets: fallOfWickets,
      teamPlayers
    };
  });

  const matchPlayers = innings.flatMap((inn) => inn.teamPlayers);

  if (matchPlayers.length === 0) {
    previewPlayers.forEach((player, index) => {
      matchPlayers.push({
        id: `preview-player-${index}`,
        team_name: previewMatch.innings[0]?.teamName ?? null,
        player_name: player.name
      });
    });
  }

  return {
    team_a: previewMatch.teamA,
    team_b: previewMatch.teamB,
    match_date: previewMatch.matchDate,
    result: previewMatch.matchResult,
    innings: innings.map((inn) => ({
      id: inn.id,
      team_name: inn.team_name,
      runs: inn.runs,
      wickets: inn.wickets,
      overs: inn.overs,
      extras: inn.extras,
      batting_stats: inn.batting_stats,
      bowling_stats: inn.bowling_stats,
      fall_of_wickets: inn.fall_of_wickets
    })),
    match_players: matchPlayers
  };

}

export default function MatchPreviewModal({
  open,
  previewMatch,
  previewMatchId,
  previewPlayers,
  previewTitle,
  previewQueueLabel,
  onToggleAddToSquad,
  onClose,
  onSave,
  getYetToBat
}: Props) {

  if (!previewMatch) return null;

  const previewDetailMatch = buildPreviewMatchForDetail(
    previewMatch,
    previewPlayers,
    getYetToBat
  );

  const newPlayers = previewPlayers.filter((player) => !player.exists || player.isGuest);

  return (

    <Modal open={open} onClose={onClose}>

      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          bgcolor: "background.paper",
          borderRadius: 3,
          width: "95%",
          maxWidth: 1280,
          maxHeight: "94vh",
          overflowY: "auto",
          boxShadow: 24,
          outline: "none"
        }}
      >

        <Stack spacing={0}>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={2}
            sx={{ px: { xs: 2, md: 4 }, py: 3 }}
          >

            <Stack spacing={0.5}>
              <Typography variant="h5">
                Match Preview
              </Typography>

              {previewTitle && (
                <Typography variant="body2" color="text.secondary">
                  {previewTitle}
                </Typography>
              )}
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              {previewQueueLabel && (
                <Chip
                  label={previewQueueLabel}
                  variant="outlined"
                  size="small"
                />
              )}

              <Chip
                label={previewMatchId}
                color="primary"
                size="small"
              />
            </Stack>

          </Stack>

          <Divider />

          <Box sx={{ px: { xs: 2, md: 4 }, py: 4 }}>
            <MatchDetailPanel match={previewDetailMatch} />
          </Box>

          {newPlayers.length > 0 && (

            <>
              <Divider />

              <Paper
                square
                elevation={0}
                sx={{ px: { xs: 2, md: 4 }, py: 3 }}
              >

                <Stack spacing={2}>

                  <Typography variant="h6">
                    New Players Detected
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Select players to add or promote into the main squad before saving this match.
                  </Typography>

                  <Grid container spacing={2}>

                    {newPlayers.map((player) => (

                      <Grid
                        key={player.name}
                        size={{ xs: 12, md: 6 }}
                      >

                        <Paper
                          variant="outlined"
                          sx={{
                            px: 2.5,
                            py: 2,
                            borderRadius: 3,
                            borderColor: player.addToSquad
                              ? (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.28)
                              : undefined,
                            backgroundColor: player.addToSquad
                              ? (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.05)
                              : "background.paper"
                          }}
                        >

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
                                  backgroundColor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.12),
                                  flexShrink: 0
                                }}
                              >
                                <PersonOutlineRoundedIcon />
                              </Box>

                              <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                                  {formatName(player.name)}
                                </Typography>

                                <Typography variant="caption" color="text.secondary">
                                  {player.addToSquad
                                    ? "Selected for squad"
                                    : player.isGuest
                                      ? "Currently tracked as guest"
                                      : "Available to add"}
                                </Typography>
                              </Stack>
                            </Stack>

                            <Tooltip
                              title={
                                player.addToSquad
                                  ? "Remove from Squad"
                                  : player.isGuest
                                    ? "Promote to Squad"
                                    : "Add to Squad"
                              }
                            >
                              <IconButton
                                onClick={() => onToggleAddToSquad(player.name)}
                                sx={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: "50%",
                                  color: "#FFFFFF",
                                  background: (theme) =>
                                    player.addToSquad
                                      ? `linear-gradient(135deg, ${theme.vars.palette.error.dark} 0%, ${theme.vars.palette.error.main} 100%)`
                                      : "linear-gradient(135deg, var(--app-header-start) 0%, var(--app-header-mid) 62%, var(--app-header-end) 100%)",
                                  boxShadow: (theme) =>
                                    player.addToSquad
                                      ? theme.vars.customShadows.error
                                      : theme.vars.customShadows.primary,
                                  "&:hover": player.addToSquad
                                    ? {
                                      background: (theme) =>
                                        `linear-gradient(135deg, ${theme.vars.palette.error.dark} 0%, ${theme.vars.palette.error.main} 100%)`
                                    }
                                    : {
                                      background: "linear-gradient(135deg, var(--app-header-start) 0%, var(--app-header-mid) 62%, var(--app-header-end) 100%)"
                                    }
                                }}
                              >
                                {player.addToSquad ? (
                                  <PersonRemoveRoundedIcon />
                                ) : (
                                  <PersonAddAlt1RoundedIcon />
                                )}
                              </IconButton>
                            </Tooltip>

                          </Stack>

                        </Paper>

                      </Grid>

                    ))}

                  </Grid>

                </Stack>

              </Paper>
            </>

          )}

          <Divider />

          <Stack
            direction="row"
            justifyContent="flex-end"
            spacing={2}
            sx={{ px: { xs: 2, md: 4 }, py: 3 }}
          >

            <Button
              variant="text"
              onClick={onClose}
              sx={{
                minWidth: 112,
                borderRadius: 999
              }}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              onClick={onSave}
              sx={{
                minWidth: 136,
                borderRadius: 999
              }}
            >
              Save Match
            </Button>

          </Stack>

        </Stack>

      </Box>

    </Modal>

  );

}
