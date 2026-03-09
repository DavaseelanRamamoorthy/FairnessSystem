"use client";

import {
  Card,
  CardHeader,
  CardContent,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer
} from "@mui/material";

import { formatName } from "@/app/services/formatname";

interface BattingStat {
  player_name: string;
  dismissal?: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strike_rate: number;
}

interface Props {
  battingStats: BattingStat[];
}

export default function BattingTable({ battingStats }: Props) {

  return (

    <Card sx={{ flex: 1 }}>

      <CardHeader title="Batting" />

      <Divider />

      <CardContent sx={{ p: 0 }}>

        <TableContainer>

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

              {battingStats.map((batsman, index) => (

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

      </CardContent>

    </Card>

  );
}