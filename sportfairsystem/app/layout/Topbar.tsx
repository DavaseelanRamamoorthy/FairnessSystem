"use client";

import { usePathname } from "next/navigation";

import {
  Box,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import MenuIcon from "@mui/icons-material/Menu";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";

import { currentTeamName } from "@/app/config/teamConfig";
import { useViewMode, ViewMode } from "@/app/context/ViewModeContext";

interface Props {
  toggleSidebar?: () => void;
}

const HEADER_NAVY = "#0A1A49";
const HEADER_NAVY_DEEP = "#061230";
const HEADER_RED = "#E53935";

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
  const { canUseAdminMode, viewMode, setViewMode } = useViewMode();

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

        <ToggleButtonGroup
          size="small"
          exclusive
          value={viewMode}
          onChange={(_event, nextMode: ViewMode | null) => {
            if (nextMode) {
              setViewMode(nextMode);
            }
          }}
          sx={{
            "& .MuiToggleButton-root": {
              borderRadius: "999px !important",
              px: 1.5,
              py: 0.65,
              borderColor: alpha("#FFFFFF", 0.16),
              color: "#FFFFFF",
              textTransform: "none",
              fontWeight: 700,
              backgroundColor: alpha("#FFFFFF", 0.06)
            },
            "& .Mui-selected": {
              backgroundColor: alpha("#FFFFFF", 0.14),
              color: "#FFFFFF"
            },
            "& .MuiToggleButton-root.Mui-disabled": {
              color: alpha("#FFFFFF", 0.42),
              borderColor: alpha("#FFFFFF", 0.1)
            }
          }}
        >
          <ToggleButton value="admin" disabled={!canUseAdminMode}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <VerifiedUserRoundedIcon sx={{ fontSize: 18 }} />
              <span>Admin Mode</span>
            </Stack>
          </ToggleButton>

          <ToggleButton value="member">
            <Stack direction="row" spacing={0.75} alignItems="center">
              <GroupRoundedIcon sx={{ fontSize: 18 }} />
              <span>Member Mode</span>
            </Stack>
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
    </Box>
  );
}
