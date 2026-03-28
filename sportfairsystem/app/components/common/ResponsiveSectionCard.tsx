"use client";

import { ReactNode } from "react";

import { Box, Card, CardContent, CardProps, Stack, Typography } from "@mui/material";

type ResponsiveSectionCardProps = CardProps & {
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  contentSx?: CardProps["sx"];
};

export default function ResponsiveSectionCard({
  title,
  subtitle,
  headerAction,
  children,
  sx,
  contentSx
}: ResponsiveSectionCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        minWidth: 0,
        ...sx
      }}
    >
      <CardContent
        sx={{
          p: 0,
          minWidth: 0,
          ...(contentSx ?? {})
        }}
      >
        {(title || subtitle || headerAction) && (
          <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2.5, sm: 3 }, pb: 2 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                {title && (
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {title}
                  </Typography>
                )}
                {subtitle && (
                  <Typography variant="body2" color="text.secondary">
                    {subtitle}
                  </Typography>
                )}
              </Stack>

              {headerAction}
            </Stack>
          </Box>
        )}

        {children}
      </CardContent>
    </Card>
  );
}
