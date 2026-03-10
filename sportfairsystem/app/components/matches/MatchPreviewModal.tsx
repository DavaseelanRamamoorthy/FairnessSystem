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
  Divider
} from "@mui/material";

import MatchDetailPanel from "@/app/components/matches/MatchDetailPanel";
import { ParsedMatch, Innings } from "@/app/types/match.types";
import { formatName } from "@/app/services/formatname";

type PreviewPlayer = {
  name: string;
  exists: boolean;
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

  const newPlayers = previewPlayers.filter((player) => !player.exists);

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

            <Typography variant="h5">
              Match Preview
            </Typography>

            <Chip
              label={previewMatchId}
              color="primary"
              size="small"
            />

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

                  <Stack spacing={1}>

                    {newPlayers.map((player) => (

                      <Stack
                        key={player.name}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >

                        <Typography>
                          {formatName(player.name)}
                        </Typography>

                        <Chip
                          label="New Player"
                          color="warning"
                          size="small"
                        />

                      </Stack>

                    ))}

                  </Stack>

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
              variant="outlined"
              onClick={onClose}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              onClick={onSave}
            >
              Save Match
            </Button>

          </Stack>

        </Stack>

      </Box>

    </Modal>

  );

}
