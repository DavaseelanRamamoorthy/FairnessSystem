"use client";

import { Box, Typography } from "@mui/material";

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
}

export default function SectionHeader({ title, icon }: SectionHeaderProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        mb: 2,
      }}
    >
      {icon}

      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
        }}
      >
        {title}
      </Typography>
    </Box>
  );
}