"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import {
  Avatar,
  Box,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { varAlpha } from "minimal-shared/utils";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import MenuIcon from "@mui/icons-material/Menu";

import { useAuth } from "@/app/context/AuthContext";
import { currentTeamName } from "@/app/config/teamConfig";
import SettingsDrawer from "@/app/components/settings/SettingsDrawer";

interface Props {
  toggleSidebar?: () => void;
}

const HEADER_AVATAR_TEXT = "#061230";

function getPageHeader(pathname: string) {
  if (pathname === "/dashboard") {
    return {
      title: `Welcome to ${currentTeamName} Dashboard`,
      subtitle: "Overview of team performance, match statistics, and player contributions."
    };
  }

  if (pathname === "/matches") {
    return {
      title: `${currentTeamName} Matches`,
      subtitle: "Saved match history, scorecards, and upload workflow for the current team."
    };
  }

  if (pathname === "/players") {
    return {
      title: `${currentTeamName} Squad`,
      subtitle: "Current team players with match count and role performance."
    };
  }

  if (pathname === "/analytics") {
    return {
      title: `${currentTeamName} Analytics`,
      subtitle: "Season trends, scoring patterns, and performance leaders for the current team."
    };
  }

  if (pathname === "/planner") {
    return {
      title: `${currentTeamName} Planner`,
      subtitle: "Admin planner for weekly availability, XI generation, 12th man, and multi-match reshuffling."
    };
  }

  if (pathname === "/validation") {
    return {
      title: `${currentTeamName} Validation`,
      subtitle: "Admin checks for player linking, XI reconstruction, and historical data quality."
    };
  }

  if (pathname === "/profile") {
    return {
      title: "Profile",
      subtitle: "Your account details, role access, and team assignment."
    };
  }

  if (pathname.startsWith("/players/")) {
    return {
      title: "Player Profile",
      subtitle: "Detailed batting, bowling, and recent-match performance for the selected squad player."
    };
  }

  return {
    title: currentTeamName,
    subtitle: "Team workspace"
  };
}

export default function Topbar({ toggleSidebar }: Props) {
  const pathname = usePathname();
  const header = getPageHeader(pathname);
  const { profile } = useAuth();
  const profileLetter = (profile?.firstName ?? profile?.email ?? "P").charAt(0).toUpperCase();
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

  return (
    <>
      <Box
        sx={{
          minHeight: 96,
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: { xs: 2.5, md: 4 },
          py: 1.75,
          color: "text.primary",
          backgroundColor: "background.paper",
          borderBottom: "1px solid",
          borderColor: (theme) => varAlpha(theme.vars.palette.grey["500Channel"], 0.14),
          position: "sticky",
          top: 0,
          zIndex: 1200,
          boxShadow: (theme) => theme.vars.customShadows.z4
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          spacing={2}
          sx={{ width: "100%", position: "relative", zIndex: 1 }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton
              onClick={toggleSidebar}
              sx={{
                color: "text.primary",
                border: "1px solid",
                borderColor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.2),
                backgroundColor: "var(--app-accent-soft)",
                width: 42,
                height: 42,
                "&:hover": {
                  backgroundColor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.18)
                }
              }}
            >
              <MenuIcon />
            </IconButton>

            <Stack spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, color: "text.primary" }}>
                {header.title}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.35 }}>
                {header.subtitle}
              </Typography>
            </Stack>
          </Stack>

          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", lg: "center" }}
          >
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Tooltip title="Account">
                <IconButton
                  onClick={() => setIsSettingsDrawerOpen(true)}
                  size="small"
                  aria-label="Account"
                  sx={{
                    color: "text.primary",
                    border: "1px solid",
                    borderColor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.2),
                    backgroundColor: "var(--app-accent-soft)",
                    width: 38,
                    height: 38,
                    "&:hover": {
                      backgroundColor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.18)
                    }
                  }}
                >
                  {profile ? (
                    <Avatar
                      sx={{
                        width: 26,
                        height: 26,
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        color: HEADER_AVATAR_TEXT,
                        backgroundColor: alpha("#FFFFFF", 0.92)
                      }}
                    >
                      {profileLetter}
                    </Avatar>
                  ) : (
                    <AccountCircleRoundedIcon />
                  )}
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Stack>
      </Box>

      <SettingsDrawer
        open={isSettingsDrawerOpen}
        onClose={() => setIsSettingsDrawerOpen(false)}
      />
    </>
  );
}
