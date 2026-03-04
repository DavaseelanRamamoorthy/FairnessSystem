'use client';

import {
  Paper,
  Typography,
  Stack,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";

import { Innings } from "@/app/types/match.types";

type BattingStat = {
  player_name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strike_rate: number;
};

type MatchPlayer = {
  player_name: string;
  team_name: string;
};

export type MatchWithStats = {
  id: string;
  team_a: string;
  team_b: string;
  match_date: string;
  result: "Won" | "Lost" | "Unknown";

  innings?: Innings[];
  match_players?: MatchPlayer[];
};

type Props = {
  match: MatchWithStats | null;
  teamName: string;
};

export default function MatchDetailPanel({ match, teamName }: Props) {

  if (!match) {
    return (
      <Paper sx={{ p: 4, minHeight: 400 }}>
        <Typography variant="h5" color="text.secondary">
          Click Matches to display in Detail
        </Typography>
      </Paper>
    );
  }

  const innings: Innings[] = match.innings || [];

  // Collect batting stats from innings
  const batting: BattingStat[] =
    innings.flatMap((inn: any) => inn.batting_stats || []);

  const battingMap = new Map<string, BattingStat>(
    batting.map((b) => [b.player_name, b])
  );

  // Filter players only from our team
  const players =
    match.match_players?.filter(
      (p) => p.team_name === teamName
    ) ?? [];

  return (
    <Paper sx={{ p: 4 }}>

      {/* MATCH HEADER */}
      <Stack spacing={1}>
        <Typography variant="h4">
          {match.team_a} vs {match.team_b}
        </Typography>

        <Typography color="text.secondary">
          {match.match_date}
        </Typography>

        <Typography
          variant="h6"
          color={match.result === "Won" ? "success.main" : "error.main"}
        >
          {match.result}
        </Typography>
      </Stack>

      <Divider sx={{ my: 3 }} />

      {/* INNINGS SUMMARY */}
      <Stack spacing={1}>
        {innings.map((inn, index) => (
          <Typography key={index}>
            {inn.teamName} {inn.runs}/{inn.wickets} ({inn.overs})
          </Typography>
        ))}
      </Stack>

      <Divider sx={{ my: 3 }} />

      {/* BATTING TABLE */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Batting
      </Typography>

      <Table size="small">

        <TableHead>
          <TableRow>
            <TableCell>Player</TableCell>
            <TableCell align="right">R</TableCell>
            <TableCell align="right">B</TableCell>
            <TableCell align="right">4s</TableCell>
            <TableCell align="right">6s</TableCell>
            <TableCell align="right">SR</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>

          {players.map((player) => {

            const stats = battingMap.get(player.player_name);

            if (!stats) {
              return (
                <TableRow key={player.player_name}>
                  <TableCell>{player.player_name}</TableCell>
                  <TableCell colSpan={5}>
                    Yet to bat
                  </TableCell>
                </TableRow>
              );
            }

            return (
              <TableRow key={player.player_name}>
                <TableCell>{player.player_name}</TableCell>
                <TableCell align="right">{stats.runs}</TableCell>
                <TableCell align="right">{stats.balls}</TableCell>
                <TableCell align="right">{stats.fours}</TableCell>
                <TableCell align="right">{stats.sixes}</TableCell>
                <TableCell align="right">{stats.strike_rate}</TableCell>
              </TableRow>
            );
          })}

        </TableBody>

      </Table>

    </Paper>
  );
}