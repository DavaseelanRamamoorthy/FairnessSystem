"use client";

import Link from "next/link";
import { MouseEvent, useState } from "react";
import { usePathname } from "next/navigation";

import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuIcon from "@mui/icons-material/Menu";

import { useAuth } from "@/app/context/AuthContext";
import { currentTeamName } from "@/app/config/teamConfig";

interface Props {
  toggleSidebar?: () => void;
}

const HEADER_NAVY = "#0A1A49";
const HEADER_NAVY_DEEP = "#061230";
const HEADER_RED = "#E53935";
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
  const { profile, signOut } = useAuth();
  const profileLetter = (profile?.firstName ?? profile?.email ?? "P").charAt(0).toUpperCase();
  const [accountMenuAnchor, setAccountMenuAnchor] = useState<HTMLElement | null>(null);
  const isAccountMenuOpen = Boolean(accountMenuAnchor);

  const openAccountMenu = (event: MouseEvent<HTMLElement>) => {
    setAccountMenuAnchor(event.currentTarget);
  };

  const closeAccountMenu = () => {
    setAccountMenuAnchor(null);
  };

  return (
    <Box
      sx={{
        minHeight: 96,
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: { xs: 2.5, md: 4 },
        py: 1.75,
        color: "#F7F9FC",
        background: `linear-gradient(135deg, ${HEADER_NAVY_DEEP} 0%, ${HEADER_NAVY} 58%, #102969 100%)`,
        borderBottom: "1px solid",
        borderColor: alpha(HEADER_RED, 0.18),
        position: "sticky",
        top: 0,
        zIndex: 1200,
        overflow: "hidden",
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
            `linear-gradient(${alpha(HEADER_RED, 0.14)} 0 0)`,
            `linear-gradient(${alpha(HEADER_RED, 0.14)} 0 0)`
          ].join(", "),
          backgroundRepeat: "no-repeat",
          backgroundSize: ["52px 3px", "3px 52px", "68px 2px", "2px 68px"].join(", "),
          backgroundPosition: ["84% 18%", "84% 18%", "14% 78%", "14% 78%"].join(", ")
        }
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
              color: "#FFFFFF",
              border: "1px solid",
              borderColor: alpha("#FFFFFF", 0.18),
              backgroundColor: alpha("#FFFFFF", 0.08),
              width: 42,
              height: 42
            }}
          >
            <MenuIcon />
          </IconButton>

          <Stack spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              {header.title}
            </Typography>
            <Typography variant="body2" sx={{ color: alpha("#FFFFFF", 0.76), lineHeight: 1.35 }}>
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
                onClick={openAccountMenu}
                size="small"
                aria-label="Account"
                sx={{
                  color: "#FFFFFF",
                  border: "1px solid",
                  borderColor: alpha("#FFFFFF", 0.16),
                  backgroundColor: alpha("#FFFFFF", 0.06),
                  width: 38,
                  height: 38,
                  "&:hover": {
                    backgroundColor: alpha("#FFFFFF", 0.12)
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

            <Menu
              anchorEl={accountMenuAnchor}
              open={isAccountMenuOpen}
              onClose={closeAccountMenu}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              PaperProps={{
                sx: {
                  mt: 1,
                  minWidth: 220,
                  borderRadius: 3,
                  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)"
                }
              }}
            >
              {profile && (
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: HEADER_NAVY_DEEP }}>
                    {[profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {profile.role === "admin" ? "Admin Access" : "Member Access"}
                  </Typography>
                </Box>
              )}

              <Divider />

              <MenuItem component={Link} href="/profile" onClick={closeAccountMenu}>
                <ListItemIcon>
                  <AccountCircleRoundedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Profile" />
              </MenuItem>

              <MenuItem
                onClick={() => {
                  closeAccountMenu();
                  void signOut();
                }}
              >
                <ListItemIcon>
                  <LogoutRoundedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Signout" />
              </MenuItem>
            </Menu>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
