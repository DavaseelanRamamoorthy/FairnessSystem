"use client";

import {
  Box,
  Typography,
  Divider,
  Grid
} from "@mui/material";

import { formatName } from "@/app/services/formatname";

import BattingTable from "./BattingTable";
import BowlingTable from "./BowlingTable";
import FallOfWickets from "./FallofWickets";

interface MatchDetailPanelProps {
  match: any;
}

export default function MatchDetailPanel({ match }: MatchDetailPanelProps) {

  if (!match) {
    return (
      <Box p={3}>
        <Typography>Select a match to view details</Typography>
      </Box>
    );
  }

  const innings = match.innings || [];

  return (
    <Box>

      <Typography variant="h4" gutterBottom>
        {match.team_a} vs {match.team_b}
      </Typography>

      <Typography gutterBottom>
        Date: {match.match_date}
      </Typography>

      <Typography
        variant="h6"
        color={match.result === "Won" ? "success.main" : "error.main"}
      >
        Result: {match.result}
      </Typography>

      <Divider sx={{ my: 3 }} />

      {innings.map((inn: any) => {

        const battingStats = inn.batting_stats || [];
        const bowlingStats = inn.bowling_stats || [];
        const fallOfWickets = inn.fall_of_wickets || [];

        const players =
          match.match_players?.filter(
            (p: any) => p.team_name === inn.team_name
          ) || [];

        const playersWhoBatted = new Set(
          battingStats.map((b: any) => b.player_name)
        );

        const yetToBat = players
          .map((p: any) => p.player_name)
          .filter((name: string) => !playersWhoBatted.has(name));

        const runRate =
          inn.overs && inn.runs
            ? (inn.runs / inn.overs).toFixed(2)
            : null;

        return (
          <Box key={inn.id} sx={{ mb: 6 }}>

            <Typography variant="h5" sx={{ mb: 1 }}>
              {formatName(inn.team_name)} Innings
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {inn.runs}/{inn.wickets} ({inn.overs} Ov) • CRR: {runRate} • Extras: {inn.extras ?? 0}
            </Typography>

            <Grid container spacing={3} alignItems="stretch" sx={{ mb: 3 }}>

              <Grid size={{ xs: 12, md: 6 }} sx={{ display: "flex" }}>
                <BattingTable battingStats={battingStats} />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }} sx={{ display: "flex" }}>
                <BowlingTable bowlingStats={bowlingStats} />
              </Grid>

            </Grid>

            {yetToBat.length > 0 && (
              <Typography sx={{ mb: 3 }}>
                <strong>Yet to Bat:</strong> {yetToBat.map(formatName).join(", ")}
              </Typography>
            )}

            <FallOfWickets fallOfWickets={fallOfWickets} />

          </Box>
        );

      })}

    </Box>
  );
}