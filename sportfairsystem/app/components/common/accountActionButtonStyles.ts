"use client";

import { SxProps, Theme, alpha } from "@mui/material/styles";

export const panelActionButtonSx: SxProps<Theme> = (theme) => ({
  minHeight: 48,
  borderRadius: 2.5,
  px: 1.75,
  justifyContent: "flex-start",
  fontWeight: 700,
  textTransform: "none",
  borderColor:
    theme.palette.mode === "dark"
      ? alpha("#FFFFFF", 0.14)
      : alpha(theme.palette.primary.main, 0.18)
});

export const panelDangerActionButtonSx: SxProps<Theme> = (theme) => ({
  ...panelActionButtonSx(theme),
  color: theme.palette.error.main,
  borderColor: alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.42 : 0.28),
  "&:hover": {
    borderColor: alpha(theme.palette.error.main, 0.5),
    backgroundColor: alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.12 : 0.08)
  }
});
