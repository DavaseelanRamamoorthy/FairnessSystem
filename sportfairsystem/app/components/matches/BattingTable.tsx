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

import {
  numericTableCellSx,
  numericTableHeadCellSx
} from "@/app/components/common/tableCellStyles";
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

      <CardContent sx={{ p: 0 }}>

        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <Box
            component="h6"
            sx={{
              m: 0,
              typography: "h6"
            }}
          >
            Batting
          </Box>
        </Box>

        <TableContainer>

          <Table size="small">

            <TableHead>
              <TableRow>
                <TableCell>Batsman</TableCell>
                <TableCell>Status</TableCell>
                <TableCell sx={numericTableHeadCellSx}>R</TableCell>
                <TableCell sx={numericTableHeadCellSx}>B</TableCell>
                <TableCell sx={numericTableHeadCellSx}>4s</TableCell>
                <TableCell sx={numericTableHeadCellSx}>6s</TableCell>
                <TableCell sx={numericTableHeadCellSx}>SR</TableCell>
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

                  <TableCell sx={numericTableCellSx}>{batsman.runs}</TableCell>
                  <TableCell sx={numericTableCellSx}>{batsman.balls}</TableCell>
                  <TableCell sx={numericTableCellSx}>{batsman.fours}</TableCell>
                  <TableCell sx={numericTableCellSx}>{batsman.sixes}</TableCell>
                  <TableCell sx={numericTableCellSx}>{batsman.strike_rate}</TableCell>

                </TableRow>

              ))}

            </TableBody>

          </Table>

        </TableContainer>

      </CardContent>

    </Card>

  );
}
