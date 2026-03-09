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

interface BowlingStat {
  player_name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
}

interface Props {
  bowlingStats: BowlingStat[];
}

export default function BowlingTable({ bowlingStats }: Props) {

  return (

    <Card sx={{ flex: 1 }}>

      <CardHeader title="Bowling" />

      <Divider />

      <CardContent sx={{ p: 0 }}>

        <TableContainer>

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

      </CardContent>

    </Card>

  );
}