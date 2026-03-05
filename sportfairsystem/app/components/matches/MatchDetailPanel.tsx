"use client";

import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  TableContainer,
  Divider
} from "@mui/material";

import { formatName } from "@/app/services/formatname";

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

      {/* MATCH HEADER */}

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

      {/* INNINGS LOOP */}

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

        // Run Rate Calculation
        const runRate =
          inn.overs && inn.runs
            ? (inn.runs / inn.overs).toFixed(2)
            : null;

        return (

          <Box key={inn.id} sx={{ mb: 6 }}>

            {/* INNINGS HEADER */}

            <Box sx={{ mb: 2 }}>

              <Typography variant="h5">
                {formatName(inn.team_name)} — {inn.runs}/{inn.wickets} ({inn.overs} Ov)
              </Typography>

              <Typography variant="body2" color="text.secondary">
                CRR: {runRate} • Extras: {inn.extras ?? 0}
              </Typography>

            </Box>

            {/* ========================= */}
            {/* BATTING TABLE */}
            {/* ========================= */}

            <TableContainer component={Paper} sx={{ mb: 3 }}>

              <Typography variant="h6" sx={{ p: 2 }}>
                Batting
              </Typography>

              <Table size="small">

                <TableHead>
                  <TableRow>
                    <TableCell>Batsman</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>R</TableCell>
                    <TableCell>B</TableCell>
                    <TableCell>4s</TableCell>
                    <TableCell>6s</TableCell>
                    <TableCell>SR</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>

                  {battingStats.map((batsman: any, index: number) => (

                    <TableRow key={index}>

                      <TableCell>
                        {formatName(batsman.player_name)}
                      </TableCell>

                      <TableCell>
                        {batsman.dismissal ?? "not out"}
                      </TableCell>

                      <TableCell>{batsman.runs}</TableCell>
                      <TableCell>{batsman.balls}</TableCell>
                      <TableCell>{batsman.fours}</TableCell>
                      <TableCell>{batsman.sixes}</TableCell>
                      <TableCell>{batsman.strike_rate}</TableCell>

                    </TableRow>

                  ))}

                </TableBody>

              </Table>

            </TableContainer>

            {/* ========================= */}
            {/* YET TO BAT */}
            {/* ========================= */}

            {yetToBat.length > 0 && (

              <Typography sx={{ mb: 3 }}>
                Yet to Bat: {yetToBat.map(formatName).join(", ")}
              </Typography>

            )}

            {/* ========================= */}
            {/* BOWLING TABLE */}
            {/* ========================= */}

            <TableContainer component={Paper} sx={{ mb: 3 }}>

              <Typography variant="h6" sx={{ p: 2 }}>
                Bowling
              </Typography>

              <Table size="small">

                <TableHead>
                  <TableRow>
                    <TableCell>Bowler</TableCell>
                    <TableCell>Overs</TableCell>
                    <TableCell>M</TableCell>
                    <TableCell>Runs</TableCell>
                    <TableCell>Wkts</TableCell>
                    <TableCell>Eco</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>

                  {bowlingStats.map((bowler: any, index: number) => (

                    <TableRow key={index}>

                      <TableCell>
                        {formatName(bowler.player_name)}
                      </TableCell>

                      <TableCell>{bowler.overs}</TableCell>
                      <TableCell>{bowler.maidens}</TableCell>
                      <TableCell>{bowler.runs}</TableCell>
                      <TableCell>{bowler.wickets}</TableCell>
                      <TableCell>{bowler.economy}</TableCell>

                    </TableRow>

                  ))}

                </TableBody>

              </Table>

            </TableContainer>

            {/* ========================= */}
            {/* FALL OF WICKETS */}
            {/* ========================= */}

            {fallOfWickets.length > 0 && (

              <Box>

                <Typography variant="h6" sx={{ mb: 1 }}>
                  Fall of Wickets
                </Typography>

                {fallOfWickets.map((f: any, i: number) => (

                  <Typography key={i} variant="body2">
                    {f.score}/{f.wicket_number} — {formatName(f.batsman)} ({f.over})
                  </Typography>

                ))}

              </Box>

            )}

          </Box>

        );

      })}

    </Box>
  );
}