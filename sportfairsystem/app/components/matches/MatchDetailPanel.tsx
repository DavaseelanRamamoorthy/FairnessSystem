"use client";

import {
  Box,
  Typography,
  Grid,
  Stack,
  Paper,
  Chip,
  IconButton,
  Tooltip
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { varAlpha } from "minimal-shared/utils";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { formatName } from "@/app/services/formatname";
import { Innings } from "@/app/types/match.types";
import { formatDate } from "@/app/utils/formatDate";

import BattingTable from "./BattingTable";
import BowlingTable from "./BowlingTable";
import FallOfWickets from "./FallofWickets";

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
    result_summary?: string | null;
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
  if (result === "Tie") return "info";
  if (result === "Draw") return "warning";
  return "default";
}

function inferTieFromInnings(innings: MatchInnings[] | undefined) {
  if (!innings || innings.length < 2) {
    return false;
  }

  const inningsTotals = innings
    .slice(0, 2)
    .map((entry) => entry.runs)
    .filter((runs): runs is number => typeof runs === "number");

  if (inningsTotals.length < 2) {
    return false;
  }

  return inningsTotals[0] === inningsTotals[1];
}

function getDisplayResult(match: MatchDetailPanelProps["match"]) {
  const rawResult = typeof match.result === "string" ? match.result.trim() : "";
  const normalizedResult = rawResult.toLowerCase();
  const summary = typeof match.result_summary === "string"
    ? match.result_summary.trim().toLowerCase()
    : "";
  const tiedOnScore = inferTieFromInnings(match.innings);

  if (normalizedResult === "won") {
    return "Won";
  }

  if (normalizedResult === "lost") {
    return "Lost";
  }

  if (
    normalizedResult === "tie"
    || summary.includes("tie")
    || summary.includes("scores level")
    || tiedOnScore
  ) {
    return "Tie";
  }

  if (normalizedResult === "draw" || summary.includes("draw")) {
    return "Draw";
  }

  if (rawResult && normalizedResult !== "unknown") {
    return rawResult;
  }

  return "Unknown";
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
  const displayResult = getDisplayResult(match);
  const resultTone = getResultTone(displayResult);

  return (
    <Box>

      <Paper
        variant="outlined"
        sx={(theme) => ({
          p: 3,
          mb: 2,
          borderRadius: 4,
          color: "#F7F9FC",
          background: "linear-gradient(135deg, var(--app-header-start) 0%, var(--app-header-mid) 52%, var(--app-header-end) 100%)",
          borderColor: varAlpha(theme.vars.palette.error.mainChannel, 0.18),
          overflow: "hidden",
          position: "relative",
          boxShadow: `0 18px 42px ${varAlpha(theme.vars.palette.grey["900Channel"], 0.24)}`,
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: [
              `linear-gradient(90deg, transparent 0%, ${varAlpha(theme.vars.palette.primary.mainChannel, 0.22)} 48%, transparent 100%)`,
              `radial-gradient(circle at 12% 88%, ${varAlpha(theme.vars.palette.error.mainChannel, 0.18)}, transparent 22%)`,
              `radial-gradient(circle at 82% 24%, ${varAlpha(theme.vars.palette.error.mainChannel, 0.12)}, transparent 18%)`
            ].join(", ")
          },
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage: [
              `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.28)} 0 0)`,
              `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.28)} 0 0)`,
              `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.28)} 0 0)`,
              `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.28)} 0 0)`,
              `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.2)} 0 0)`,
              `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.2)} 0 0)`,
              `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.2)} 0 0)`,
              `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.2)} 0 0)`,
              `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.14)} 0 0)`,
              `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.14)} 0 0)`,
              `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.14)} 0 0)`,
              `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.14)} 0 0)`
            ].join(", "),
            backgroundRepeat: "no-repeat",
            backgroundSize: [
              "64px 3px",
              "3px 64px",
              "40px 3px",
              "3px 40px",
              "76px 2px",
              "2px 76px",
              "48px 2px",
              "2px 48px",
              "90px 2px",
              "2px 90px",
              "54px 2px",
              "2px 54px"
            ].join(", "),
            backgroundPosition: [
              "82% 22%",
              "82% 22%",
              "86% 28%",
              "86% 28%",
              "14% 82%",
              "14% 82%",
              "18% 74%",
              "18% 74%",
              "64% 58%",
              "64% 58%",
              "70% 66%",
              "70% 66%"
            ].join(", ")
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
                {getDisplayName(match.team_a)} vs {getDisplayName(match.team_b)}
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
                  label={displayResult}
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
                <Tooltip title="Delete Match">
                  <IconButton
                    onClick={onDelete}
                    size="small"
                    sx={(theme) => ({
                      color: "#FFFFFF",
                      border: "1px solid",
                      borderColor: alpha("#FFFFFF", 0.24),
                      backgroundColor: alpha("#FFFFFF", 0.04),
                      "&:hover": {
                        borderColor: alpha("#FFFFFF", 0.32),
                        backgroundColor: varAlpha(theme.vars.palette.error.mainChannel, 0.16)
                      }
                    })}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
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
            sx={(theme) => ({
              mb: 4,
              p: 3,
              borderRadius: 3,
              borderColor:
                theme.palette.mode === "dark"
                  ? alpha("#FFFFFF", 0.08)
                  : varAlpha(theme.vars.palette.primary.mainChannel, 0.18),
              background:
                theme.palette.mode === "dark"
                  ? theme.vars.palette.background.paper
                  : `linear-gradient(180deg, ${varAlpha(theme.vars.palette.primary.mainChannel, 0.06)} 0%, rgba(255,255,255,0.98) 18%)`,
              boxShadow: "none"
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
                      sx={(theme) => ({
                        fontWeight: 700,
                        backgroundColor: theme.vars.palette.error.main,
                        color: "#FFFFFF"
                      })}
                    />
                    <Chip
                      label={`${inn.overs ?? "-"} Overs`}
                      variant="outlined"
                      sx={(theme) => ({
                        borderColor:
                          theme.palette.mode === "dark"
                            ? alpha("#FFFFFF", 0.14)
                            : varAlpha(theme.vars.palette.primary.mainChannel, 0.18)
                      })}
                    />
                    <Chip
                      label={`CRR ${runRate ?? "-"}`}
                      variant="outlined"
                      sx={(theme) => ({
                        borderColor:
                          theme.palette.mode === "dark"
                            ? alpha("#FFFFFF", 0.14)
                            : varAlpha(theme.vars.palette.primary.mainChannel, 0.18)
                      })}
                    />
                    <Chip
                      label={`Extras ${inn.extras ?? 0}`}
                      variant="outlined"
                      sx={(theme) => ({
                        borderColor:
                          theme.palette.mode === "dark"
                            ? alpha("#FFFFFF", 0.14)
                            : varAlpha(theme.vars.palette.primary.mainChannel, 0.18)
                      })}
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
                  sx={(theme) => ({
                    px: 2,
                    py: 1.5,
                    borderRadius: 2.5,
                    backgroundColor:
                      theme.palette.mode === "dark"
                        ? alpha("#FFFFFF", 0.04)
                        : varAlpha(theme.vars.palette.error.mainChannel, 0.04),
                    borderColor:
                      theme.palette.mode === "dark"
                        ? alpha("#FFFFFF", 0.1)
                        : varAlpha(theme.vars.palette.error.mainChannel, 0.12)
                  })}
                >
                  <Typography variant="subtitle2" sx={{ mb: 0.5, color: "text.primary", fontWeight: 700 }}>
                    Yet To Bat
                  </Typography>

                  <Typography variant="body2" sx={{ color: "text.primary" }}>
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
