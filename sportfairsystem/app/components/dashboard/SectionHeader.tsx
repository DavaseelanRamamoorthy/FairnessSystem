"use client";

import { Stack, Typography } from "@mui/material";

interface Props {
  title: string;
}

export default function SectionHeader({ title }: Props) {
  return (
    <Stack sx={{ mb: 2 }}>
      <Typography variant="h6">
        {title}
      </Typography>
    </Stack>
  );
}