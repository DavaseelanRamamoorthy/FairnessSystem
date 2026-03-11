"use client";

import {
  Box,
  Card,
  CardContent,
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

      <CardContent sx={{ p: 0 }}>

        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <Box
            component="h6"
            sx={{
              m: 0,
              typography: "h6"
            }}
          >
            Bowling
          </Box>
        </Box>

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
