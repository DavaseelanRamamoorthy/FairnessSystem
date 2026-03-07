"use client";

import { Card, CardContent, Typography, Stack, Box } from "@mui/material";

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
}

export default function DashboardCard({
  title,
  value,
  icon,
  color = "primary.light",
}: DashboardCardProps) {
  return (
    <Card
      sx={{
        height: "100%",
        transition: "all 0.2s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: 6,
        },
      }}
    >
      <CardContent>

        <Stack direction="row" spacing={2} alignItems="center">

          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              backgroundColor: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </Box>

          <Box>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 500 }}
            >
              {title}
            </Typography>

            <Typography
              variant="h5"
              sx={{ fontWeight: 700 }}
            >
              {value}
            </Typography>

          </Box>

        </Stack>

      </CardContent>
    </Card>
  );
}