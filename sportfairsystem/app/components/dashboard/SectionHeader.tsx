"use client";

import { Stack, Typography } from "@mui/material";

interface Props {
  title: string;
}

export default function SectionHeader({ title }: Props) {
  return (
    <Stack sx={{ mb: { xs: 1.5, sm: 2 } }}>
      <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
        {title}
      </Typography>
    </Stack>
  );
}
