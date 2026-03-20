"use client";

import Link from "next/link";

import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import SettingsBrightnessRoundedIcon from "@mui/icons-material/SettingsBrightnessRounded";
import DensityMediumRoundedIcon from "@mui/icons-material/DensityMediumRounded";
import DensitySmallRoundedIcon from "@mui/icons-material/DensitySmallRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";

import {
  panelActionButtonSx,
  panelDangerActionButtonSx
} from "@/app/components/common/accountActionButtonStyles";
import { useAuth } from "@/app/context/AuthContext";
import { ThemeModePreference, useSettings } from "@/app/context/SettingsContext";
import { currentTeamName } from "@/app/config/teamConfig";
import { appearancePresetList } from "@/app/themes/minimal/appearance-presets";

type SettingsDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export default function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const { profile, signOut } = useAuth();
  const {
    themeMode,
    setThemeMode,
    appearancePreset,
    setAppearancePreset,
    compactMode,
    setCompactMode
  } = useSettings();
  const profileDisplayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.email || "-";
  const currentSeasonYear = new Date().getFullYear();

  const handleThemeModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    nextMode: ThemeModePreference | null
  ) => {
    if (!nextMode) {
      return;
    }

    setThemeMode(nextMode);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 380 },
          maxWidth: "100%",
          backgroundColor: "background.paper"
        }
      }}
    >
      <Stack sx={{ height: "100%" }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={2}
          sx={{ px: 3, pt: 3, pb: 2 }}
        >
          <Stack spacing={0.5}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.1 }}>
              Configure
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Account and appearance.
            </Typography>
          </Stack>

          <IconButton onClick={onClose} aria-label="Close settings">
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        <Divider />

        <Stack spacing={2.5} sx={{ px: 3, py: 3 }}>
          <Stack spacing={1.25}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "text.primary" }}>
              Account
            </Typography>

            <Stack spacing={0.75}>
              <Typography sx={{ fontWeight: 700, color: "text.primary", lineHeight: 1.2 }}>
                {profileDisplayName}
              </Typography>
              <Chip
                size="small"
                label={profile?.role === "admin" ? "Admin Access" : "Member Access"}
                sx={{
                  alignSelf: "flex-start",
                  fontWeight: 700,
                  color: "text.primary",
                  bgcolor: "background.neutral"
                }}
              />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                component={Link}
                href="/profile"
                onClick={onClose}
                variant="outlined"
                startIcon={<AccountCircleRoundedIcon />}
                sx={panelActionButtonSx}
                fullWidth
              >
                Profile
              </Button>

              <Button
                variant="outlined"
                color="error"
                startIcon={<LogoutRoundedIcon />}
                onClick={() => {
                  onClose();
                  void signOut();
                }}
                sx={panelDangerActionButtonSx}
                fullWidth
              >
                Sign Out
              </Button>
            </Stack>
          </Stack>

          <Divider />

          <Stack spacing={1.25}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "text.primary" }}>
              General
            </Typography>

            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Typography color="text.secondary" variant="body2">
                  Team
                </Typography>
                <Typography sx={{ fontWeight: 700, color: "text.primary" }}>
                  {currentTeamName}
                </Typography>
              </Stack>

              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Typography color="text.secondary" variant="body2">
                  Access
                </Typography>
                <Typography sx={{ fontWeight: 700, color: "text.primary", textTransform: "capitalize" }}>
                  {profile?.role ?? "member"}
                </Typography>
              </Stack>

              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Typography color="text.secondary" variant="body2">
                  Profile
                </Typography>
                <Typography sx={{ fontWeight: 700, color: "text.primary", textAlign: "right" }}>
                  {profileDisplayName}
                </Typography>
              </Stack>

              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Typography color="text.secondary" variant="body2">
                  Season
                </Typography>
                <Typography sx={{ fontWeight: 700, color: "text.primary" }}>
                  {currentSeasonYear}
                </Typography>
              </Stack>
            </Stack>
          </Stack>

          <Divider />

          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "text.primary" }}>
              Appearance
            </Typography>

            <Stack spacing={1}>
              <Typography color="text.secondary" variant="body2">
                Preset
              </Typography>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {appearancePresetList.map((preset) => (
                  <Button
                    key={preset.key}
                    variant={appearancePreset === preset.key ? "contained" : "outlined"}
                    color={appearancePreset === preset.key ? "primary" : "inherit"}
                    onClick={() => setAppearancePreset(preset.key)}
                    sx={{
                      minWidth: 0,
                      px: 1.25,
                      gap: 0.9,
                      justifyContent: "flex-start",
                      textTransform: "none",
                      fontWeight: 700,
                      borderColor: "divider",
                      color: appearancePreset === preset.key ? "primary.contrastText" : "text.primary"
                    }}
                  >
                    <Box
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: "1px solid",
                        borderColor: appearancePreset === preset.key ? "rgba(255,255,255,0.45)" : "divider",
                        background: `linear-gradient(135deg, ${preset.swatch[0]} 0%, ${preset.swatch[1]} 100%)`
                      }}
                    />
                    {preset.label}
                  </Button>
                ))}
              </Stack>
            </Stack>

            <Stack spacing={1}>
              <Typography color="text.secondary" variant="body2">
                Theme
              </Typography>

              <ToggleButtonGroup
                color="primary"
                exclusive
                fullWidth
                value={themeMode}
                onChange={handleThemeModeChange}
                sx={{
                  "& .MuiToggleButton-root": {
                    minHeight: 46,
                    justifyContent: "center",
                    gap: 0.75,
                    px: 1.25,
                    textTransform: "none",
                    fontWeight: 700
                  }
                }}
              >
                <ToggleButton value="light">
                  <LightModeRoundedIcon fontSize="small" />
                  Light
                </ToggleButton>
                <ToggleButton value="dark">
                  <DarkModeRoundedIcon fontSize="small" />
                  Dark
                </ToggleButton>
                <ToggleButton value="system">
                  <SettingsBrightnessRoundedIcon fontSize="small" />
                  System
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            <Stack spacing={1}>
              <Typography color="text.secondary" variant="body2">
                Density
              </Typography>

              <ToggleButtonGroup
                color="primary"
                exclusive
                fullWidth
                value={compactMode ? "compact" : "comfortable"}
                onChange={(_event, nextValue) => {
                  if (!nextValue) {
                    return;
                  }

                  setCompactMode(nextValue === "compact");
                }}
                sx={{
                  "& .MuiToggleButton-root": {
                    minHeight: 46,
                    justifyContent: "center",
                    gap: 0.75,
                    px: 1.25,
                    textTransform: "none",
                    fontWeight: 700
                  }
                }}
              >
                <ToggleButton value="comfortable">
                  <DensityMediumRoundedIcon fontSize="small" />
                  Comfortable
                </ToggleButton>
                <ToggleButton value="compact">
                  <DensitySmallRoundedIcon fontSize="small" />
                  Compact
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </Drawer>
  );
}
