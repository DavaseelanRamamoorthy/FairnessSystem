"use client";

import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableCellProps,
  TableHead,
  TableRow
} from "@mui/material";

import ResponsiveTableContainer from "@/app/components/common/ResponsiveTableContainer";
import {
  numericTableCellSx,
  numericTableHeadCellSx
} from "@/app/components/common/tableCellStyles";
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
  const mobileTextCellSx: TableCellProps["sx"] = {
    minWidth: { xs: 128, sm: "auto" },
    px: { xs: 1.5, sm: 2 },
    py: { xs: 1.4, sm: 1.8 },
    verticalAlign: "top"
  };

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

        <ResponsiveTableContainer>

          <Table
            size="small"
            sx={{
              "& .MuiTableCell-root": {
                px: { xs: 1.5, sm: 2 },
                py: { xs: 1.35, sm: 1.6 }
              }
            }}
          >

            <TableHead>
              <TableRow>
                <TableCell sx={mobileTextCellSx}>Bowler</TableCell>
                <TableCell sx={numericTableHeadCellSx}>Overs</TableCell>
                <TableCell sx={numericTableHeadCellSx}>M</TableCell>
                <TableCell sx={numericTableHeadCellSx}>Runs</TableCell>
                <TableCell sx={numericTableHeadCellSx}>Wkts</TableCell>
                <TableCell sx={numericTableHeadCellSx}>Eco</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>

              {bowlingStats.map((bowler, index) => (

                <TableRow key={index}>

                  <TableCell sx={mobileTextCellSx}>
                    {formatName(bowler.player_name)}
                  </TableCell>

                  <TableCell sx={numericTableCellSx}>{bowler.overs}</TableCell>
                  <TableCell sx={numericTableCellSx}>{bowler.maidens}</TableCell>
                  <TableCell sx={numericTableCellSx}>{bowler.runs}</TableCell>
                  <TableCell sx={numericTableCellSx}>{bowler.wickets}</TableCell>
                  <TableCell sx={numericTableCellSx}>{bowler.economy}</TableCell>

                </TableRow>

              ))}

            </TableBody>

          </Table>

        </ResponsiveTableContainer>

      </CardContent>

    </Card>

  );
}
