"use client";

import { Typography } from "@mui/material";
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
    <Typography sx={{ mb: 3 }}>
      <strong>Fall of Wickets:</strong> {formatted}
    </Typography>
  );
}