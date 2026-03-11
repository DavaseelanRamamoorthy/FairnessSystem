"use client";

import {
  Box,
  Typography,
  Grid,
  Stack,
  Paper,
  Chip,
  Button
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { formatName } from "@/app/services/formatname";
import { Innings } from "@/app/types/match.types";
import { formatDate } from "@/app/utils/formatDate";

import BattingTable from "./BattingTable";
import BowlingTable from "./BowlingTable";
import FallOfWickets from "./FallofWickets";

const JERSEY_NAVY = "#0A1A49";
const JERSEY_NAVY_DEEP = "#061230";
const JERSEY_RED = "#E53935";
const JERSEY_RED_DARK = "#B32622";
const JERSEY_LINE = "#203A7A";

type MatchPlayer = {
  team_name: string | null;
  player_name: string;
};

type MatchInnings = {
  id?: string;
  team_name: string | null;
  runs: number | null;
  wickets: number | null;
  overs: number | null;
  extras?: number | null;
  batting_stats?: NonNullable<Innings["battingStats"]>;
  bowling_stats?: NonNullable<Innings["bowlingStats"]>;
  fall_of_wickets?: Array<{
    score: number;
    wicket_number: number;
    batsman: string;
    over: number;
  }>;
};

interface MatchDetailPanelProps {
  match: {
    id?: string;
    team_a: string | null;
    team_b: string | null;
    match_date: string | null;
    result: string | null;
    winner?: string | null;
    match_code?: string | null;
    innings?: MatchInnings[];
    match_players?: MatchPlayer[];
  };
  onDelete?: () => void;
}

function getResultTone(result: string | null) {
  if (result === "Won") return "success";
  if (result === "Lost") return "error";
  return "default";
}

function getDisplayName(name: string | null | undefined) {
  if (!name) {
    return "Unknown Team";
  }

  return formatName(name);
}

export default function MatchDetailPanel({ match, onDelete }: MatchDetailPanelProps) {

  if (!match) {
    return (
      <Box p={3}>
        <Typography>Select a match to view details</Typography>
      </Box>
    );
  }

  const innings = match.innings || [];
  const resultTone = getResultTone(match.result);

  return (
    <Box>

      <Paper
        variant="outlined"
        sx={() => ({
          p: 3,
          mb: 3,
          borderRadius: 3,
          color: "#F7F9FC",
          background: `linear-gradient(135deg, ${JERSEY_NAVY_DEEP} 0%, ${JERSEY_NAVY} 52%, #102969 100%)`,
          borderColor: alpha(JERSEY_RED, 0.22),
          overflow: "hidden",
          position: "relative",
          boxShadow: `0 18px 42px ${alpha(JERSEY_NAVY_DEEP, 0.28)}`,
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            background: [
              `radial-gradient(circle at top right, ${alpha(JERSEY_RED, 0.24)}, transparent 22%)`,
              `radial-gradient(circle at bottom left, ${alpha(JERSEY_RED_DARK, 0.2)}, transparent 20%)`,
              `linear-gradient(90deg, transparent 0%, ${alpha(JERSEY_LINE, 0.2)} 100%)`
            ].join(", "),
            pointerEvents: "none"
          }
        })}
      >

        <Stack spacing={2} sx={{ position: "relative", zIndex: 1 }}>

          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
          >

            <Box>
              <Typography variant="h4">
                {match.team_a} vs {match.team_b}
              </Typography>

              <Typography
                variant="body2"
                sx={{ mt: 0.75, color: alpha("#FFFFFF", 0.72) }}
              >
                {match.match_date ? formatDate(match.match_date) : "Date unavailable"}
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              alignItems="center"
              justifyContent={{ xs: "flex-start", md: "flex-end" }}
            >
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {match.match_code && (
                  <Chip
                    label={match.match_code}
                    variant="outlined"
                    size="small"
                    sx={{
                      color: "#FFFFFF",
                      borderColor: alpha("#FFFFFF", 0.22),
                      backgroundColor: alpha("#FFFFFF", 0.04)
                    }}
                  />
                )}

                <Chip
                  label={match.result || "Unknown"}
                  color={resultTone}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    ...(resultTone === "default" && {
                      color: "#FFFFFF",
                      backgroundColor: alpha("#FFFFFF", 0.12)
                    })
                  }}
                />
              </Stack>

              {onDelete && (
                <Button
                  onClick={onDelete}
                  startIcon={<DeleteOutlineRoundedIcon />}
                  variant="outlined"
                  size="small"
                  sx={{
                    color: "#FFFFFF",
                    borderColor: alpha("#FFFFFF", 0.24),
                    backgroundColor: alpha("#FFFFFF", 0.04),
                    "&:hover": {
                      borderColor: alpha("#FFFFFF", 0.32),
                      backgroundColor: alpha(JERSEY_RED, 0.16)
                    }
                  }}
                >
                  Delete Match
                </Button>
              )}
            </Stack>

          </Stack>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            flexWrap="wrap"
          >

            {match.winner && (
              <Chip
                label={`Winner: ${formatName(match.winner)}`}
                color={resultTone}
                sx={{ fontWeight: 700 }}
              />
            )}

          </Stack>

        </Stack>

      </Paper>

      {innings.map((inn, index) => {

        const battingStats = inn.batting_stats || [];
        const bowlingStats = inn.bowling_stats || [];
        const fallOfWickets = inn.fall_of_wickets || [];

        const players =
          match.match_players?.filter(
            (player) => player.team_name === inn.team_name
          ) || [];

        const playersWhoBatted = new Set(
          battingStats.map((batter) => batter.player_name)
        );

        const yetToBat = players
          .map((player) => player.player_name)
          .filter((name: string) => !playersWhoBatted.has(name));

        const runRate =
          inn.overs && inn.runs
            ? (inn.runs / inn.overs).toFixed(2)
            : null;

        const tone = index % 2 === 0 ? "primary" : "warning";

        return (
          <Paper
            key={inn.id || `${inn.team_name}-${index}`}
            variant="outlined"
            sx={() => ({
              mb: 4,
              p: 3,
              borderRadius: 3,
              borderColor: alpha(JERSEY_LINE, 0.18),
              background: `linear-gradient(180deg, ${alpha(JERSEY_NAVY, 0.05)} 0%, rgba(255,255,255,1) 18%)`
            })}
          >

            <Stack spacing={3}>

              <Stack
                direction={{ xs: "column", lg: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", lg: "center" }}
                spacing={2}
              >

                <Box>
                  <Typography variant="h5" sx={{ mb: 1 }}>
                    {getDisplayName(inn.team_name)} Innings
                  </Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={`${inn.runs ?? "-"} / ${inn.wickets ?? "-"}`}
                      color={tone}
                      sx={{
                        fontWeight: 700,
                        backgroundColor: JERSEY_RED,
                        color: "#FFFFFF"
                      }}
                    />
                    <Chip
                      label={`${inn.overs ?? "-"} Overs`}
                      variant="outlined"
                      sx={{ borderColor: alpha(JERSEY_NAVY, 0.18) }}
                    />
                    <Chip
                      label={`CRR ${runRate ?? "-"}`}
                      variant="outlined"
                      sx={{ borderColor: alpha(JERSEY_NAVY, 0.18) }}
                    />
                    <Chip
                      label={`Extras ${inn.extras ?? 0}`}
                      variant="outlined"
                      sx={{ borderColor: alpha(JERSEY_NAVY, 0.18) }}
                    />
                  </Stack>
                </Box>

              </Stack>

              <Grid container spacing={3} alignItems="stretch">

                <Grid size={{ xs: 12, md: 6 }} sx={{ display: "flex" }}>
                  <BattingTable battingStats={battingStats} />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }} sx={{ display: "flex" }}>
                  <BowlingTable bowlingStats={bowlingStats} />
                </Grid>

              </Grid>

              {yetToBat.length > 0 && (
                <Paper
                  variant="outlined"
                  sx={() => ({
                    px: 2,
                    py: 1.5,
                    borderRadius: 2.5,
                    backgroundColor: alpha(JERSEY_RED, 0.04),
                    borderColor: alpha(JERSEY_RED, 0.12)
                  })}
                >
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Yet To Bat
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    {yetToBat.map(formatName).join(", ")}
                  </Typography>
                </Paper>
              )}

              <FallOfWickets fallOfWickets={fallOfWickets} />

            </Stack>

          </Paper>
        );

      })}

    </Box>
  );

}
