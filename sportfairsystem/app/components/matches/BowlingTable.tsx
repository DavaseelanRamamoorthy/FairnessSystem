"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  Typography
} from "@mui/material";

interface BowlingStat {
  player_name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
}

interface BowlingTableProps {
  bowlingStats: BowlingStat[];
}

export default function BowlingTable({ bowlingStats }: BowlingTableProps) {
  if (!bowlingStats || bowlingStats.length === 0) {
    return (
      <Typography variant="body2" sx={{ mt: 2 }}>
        No bowling data available
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ mt: 3 }}>
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
          {bowlingStats.map((bowler, index) => (
            <TableRow key={index}>
              <TableCell>{bowler.player_name}</TableCell>
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
  );
}