"use client";

import { Box, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { formatName } from "@/app/services/formatname";

interface FallOfWicket {
  score: number;
  wicket_number: number;
  batsman: string;
  over: number;
}

interface Props {
  fallOfWickets: FallOfWicket[];
}

export default function FallOfWickets({ fallOfWickets }: Props) {

  if (!fallOfWickets || fallOfWickets.length === 0) return null;

  const orderedFallOfWickets = [...fallOfWickets].sort((left, right) => {
    if (left.wicket_number !== right.wicket_number) {
      return left.wicket_number - right.wicket_number;
    }

    return left.over - right.over;
  });

  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        px: 2,
        py: 1.5,
        borderRadius: 2.5,
        backgroundColor:
          theme.palette.mode === "dark"
            ? alpha("#FFFFFF", 0.04)
            : alpha("#0A1A49", 0.02),
        borderColor:
          theme.palette.mode === "dark"
            ? alpha("#FFFFFF", 0.1)
            : alpha("#0A1A49", 0.1)
      })}
    >
      <Typography variant="subtitle2" sx={{ mb: 0.5, color: "text.primary", fontWeight: 700 }}>
        Fall of Wickets
      </Typography>

      <Stack
        sx={{
          mt: 1,
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(5, minmax(0, 1fr))"
          },
          gap: 1
        }}
      >
        {orderedFallOfWickets.map((wicket, index) => (
          <Box
            key={`${wicket.score}-${wicket.wicket_number}-${wicket.batsman}-${index}`}
            sx={(theme) => ({
              minWidth: 0,
              width: "100%",
              px: { xs: 1, sm: 1.15 },
              py: { xs: 0.9, sm: 1 },
              borderRadius: 2.25,
              border: "1px solid",
              borderColor:
                theme.palette.mode === "dark"
                  ? alpha("#FFFFFF", 0.1)
                  : alpha("#0A1A49", 0.1),
              backgroundColor:
                theme.palette.mode === "dark"
                  ? alpha("#FFFFFF", 0.03)
                  : alpha("#0A1A49", 0.025)
            })}
          >
            <Stack spacing={0.5}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 1
                }}
              >
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, whiteSpace: "nowrap" }}>
                  Wicket {wicket.wicket_number}
                </Typography>

                <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 800, whiteSpace: "nowrap" }}>
                  {wicket.score}/{wicket.wicket_number}
                </Typography>
              </Box>

              <Typography
                variant="body2"
                color="text.primary"
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.25,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {formatName(wicket.batsman)}
              </Typography>

              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                Over {wicket.over}
              </Typography>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
