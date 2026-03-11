"use client";

import { ReactNode } from "react";

import { Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { currentTeamName } from "@/app/config/teamConfig";

const HEADER_NAVY = "#0A1A49";
const HEADER_NAVY_DEEP = "#061230";
const HEADER_RED = "#E53935";

type TeamPageHeaderProps = {
  eyebrow: string;
  description: string;
  title?: string;
  action?: ReactNode;
};

export default function TeamPageHeader({
  eyebrow,
  description,
  title = currentTeamName.toUpperCase(),
  action
}: TeamPageHeaderProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 4,
        color: "#F7F9FC",
        background: `linear-gradient(135deg, ${HEADER_NAVY_DEEP} 0%, ${HEADER_NAVY} 58%, #102969 100%)`,
        borderColor: alpha(HEADER_RED, 0.18),
        boxShadow: `0 18px 42px ${alpha(HEADER_NAVY_DEEP, 0.2)}`,
        overflow: "hidden",
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: [
            `linear-gradient(90deg, transparent 0%, ${alpha("#16357A", 0.28)} 48%, transparent 100%)`,
            `radial-gradient(circle at 12% 88%, ${alpha(HEADER_RED, 0.18)}, transparent 22%)`,
            `radial-gradient(circle at 82% 24%, ${alpha(HEADER_RED, 0.12)}, transparent 18%)`
          ].join(", ")
        },
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: [
            `linear-gradient(${alpha(HEADER_RED, 0.28)} 0 0)`,
            `linear-gradient(${alpha(HEADER_RED, 0.28)} 0 0)`,
            `linear-gradient(${alpha(HEADER_RED, 0.28)} 0 0)`,
            `linear-gradient(${alpha(HEADER_RED, 0.28)} 0 0)`,
            `linear-gradient(${alpha(HEADER_RED, 0.2)} 0 0)`,
            `linear-gradient(${alpha(HEADER_RED, 0.2)} 0 0)`,
            `linear-gradient(${alpha(HEADER_RED, 0.2)} 0 0)`,
            `linear-gradient(${alpha(HEADER_RED, 0.2)} 0 0)`,
            `linear-gradient(${alpha(HEADER_RED, 0.14)} 0 0)`,
            `linear-gradient(${alpha(HEADER_RED, 0.14)} 0 0)`,
            `linear-gradient(${alpha(HEADER_RED, 0.14)} 0 0)`,
            `linear-gradient(${alpha(HEADER_RED, 0.14)} 0 0)`
          ].join(", "),
          backgroundRepeat: "no-repeat",
          backgroundSize: [
            "64px 3px",
            "3px 64px",
            "40px 3px",
            "3px 40px",
            "76px 2px",
            "2px 76px",
            "48px 2px",
            "2px 48px",
            "90px 2px",
            "2px 90px",
            "54px 2px",
            "2px 54px"
          ].join(", "),
          backgroundPosition: [
            "82% 22%",
            "82% 22%",
            "86% 28%",
            "86% 28%",
            "14% 82%",
            "14% 82%",
            "18% 74%",
            "18% 74%",
            "64% 58%",
            "64% 58%",
            "70% 66%",
            "70% 66%"
          ].join(", ")
        }
      }}
    >
      <CardContent
        sx={{
          px: { xs: 3, md: 4 },
          py: 3.5,
          position: "relative",
          zIndex: 1
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
        >
          <Stack spacing={1}>
            <Typography variant="overline" sx={{ color: alpha("#FFFFFF", 0.72) }}>
              {eyebrow}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: 1 }}>
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: alpha("#FFFFFF", 0.76) }}>
              {description}
            </Typography>
          </Stack>

          {action}
        </Stack>
      </CardContent>
    </Card>
  );
}
