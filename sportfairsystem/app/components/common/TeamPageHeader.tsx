"use client";

import { ReactNode } from "react";

import { Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { varAlpha } from "minimal-shared/utils";

import { currentTeamName } from "@/app/config/teamConfig";

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
        color: "common.white",
        background: "linear-gradient(135deg, var(--app-header-start) 0%, var(--app-header-mid) 58%, var(--app-header-end) 100%)",
        borderColor: (theme) => varAlpha(theme.vars.palette.error.mainChannel, 0.18),
        boxShadow: (theme) => `0 18px 42px ${varAlpha(theme.vars.palette.grey["900Channel"], 0.24)}`,
        overflow: "hidden",
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: (theme) => [
            `linear-gradient(90deg, transparent 0%, ${varAlpha(theme.vars.palette.primary.mainChannel, 0.22)} 48%, transparent 100%)`,
            `radial-gradient(circle at 12% 88%, ${varAlpha(theme.vars.palette.error.mainChannel, 0.18)}, transparent 22%)`,
            `radial-gradient(circle at 82% 24%, ${varAlpha(theme.vars.palette.error.mainChannel, 0.12)}, transparent 18%)`
          ].join(", ")
        },
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: (theme) => [
            `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.28)} 0 0)`,
            `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.28)} 0 0)`,
            `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.28)} 0 0)`,
            `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.28)} 0 0)`,
            `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.2)} 0 0)`,
            `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.2)} 0 0)`,
            `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.2)} 0 0)`,
            `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.2)} 0 0)`,
            `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.14)} 0 0)`,
            `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.14)} 0 0)`,
            `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.14)} 0 0)`,
            `linear-gradient(${varAlpha(theme.vars.palette.error.mainChannel, 0.14)} 0 0)`
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
        },
        "& .MuiFormControl-root": {
          minWidth: { xs: "100%", sm: 200 }
        },
        "& .MuiInputLabel-root": {
          color: alpha("#FFFFFF", 0.74)
        },
        "& .MuiInputLabel-root.Mui-focused": {
          color: "#FFFFFF"
        },
        "& .MuiOutlinedInput-root": {
          color: "#FFFFFF",
          backgroundColor: alpha("#FFFFFF", 0.04),
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha("#FFFFFF", 0.16)
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha("#FFFFFF", 0.28)
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha("#FFFFFF", 0.36)
          }
        },
        "& .MuiSelect-icon": {
          color: alpha("#FFFFFF", 0.8)
        },
        "& .MuiSelect-select": {
          color: "#FFFFFF"
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
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                letterSpacing: { xs: 0.4, md: 1 },
                fontSize: { xs: "1.9rem", sm: "2.3rem", md: "3rem" },
                lineHeight: { xs: 1.1, md: 1.167 }
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: alpha("#FFFFFF", 0.76),
                maxWidth: { xs: "100%", md: 760 }
              }}
            >
              {description}
            </Typography>
          </Stack>

          {action}
        </Stack>
      </CardContent>
    </Card>
  );
}
