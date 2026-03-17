"use client";

import { Paper, Typography } from "@mui/material";
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

  const formatted = fallOfWickets
    .map(
      (f) =>
        `${f.score}/${f.wicket_number} ${formatName(f.batsman)} (${f.over})`
    )
    .join(", ");

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
      <Typography variant="body2" color="text.secondary">
        {formatted}
      </Typography>
    </Paper>
  );
}
