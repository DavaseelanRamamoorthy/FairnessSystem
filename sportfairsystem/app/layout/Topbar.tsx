"use client";

import { usePathname } from "next/navigation";

import {
  Box,
  IconButton,
  Stack,
  Typography
} from "@mui/material";
import { varAlpha } from "minimal-shared/utils";
import MenuIcon from "@mui/icons-material/Menu";

import { useActiveTeamBranding } from "@/app/layout/useActiveTeamBranding";

interface Props {
  hasTeam: boolean;
  toggleSidebar?: () => void;
}

function getPageHeader(pathname: string, teamName: string, hasTeam: boolean) {
  if (!hasTeam) {
    if (pathname === "/profile") {
      return {
        title: "Account Setup",
        subtitle: "Complete your profile, create a team, or request access with a Team ID to unlock the full workspace."
      };
    }

    return {
      title: "Profile Space",
      subtitle: "This account is still teamless, so only profile and onboarding actions are available right now."
    };
  }

  if (pathname === "/dashboard") {
    return {
      title: `Welcome to ${teamName} Dashboard`,
      subtitle: "Overview of team performance, match statistics, and player contributions."
    };
  }

  if (pathname === "/matches") {
    return {
      title: `${teamName} Matches`,
      subtitle: "Saved match history, scorecards, and upload workflow for the current team."
    };
  }

  if (pathname === "/players") {
    return {
      title: `${teamName} Squad`,
      subtitle: "Current team players with match count and role performance."
    };
  }

  if (pathname === "/analytics") {
    return {
      title: `${teamName} Analytics`,
      subtitle: "Season trends, scoring patterns, and performance leaders for the current team."
    };
  }

  if (pathname === "/planner") {
    return {
      title: `${teamName} Planner`,
      subtitle: "Admin planner for weekly availability, XI generation, 12th man, and multi-match reshuffling."
    };
  }

  if (pathname === "/fairness") {
    return {
      title: `${teamName} Fairness`,
      subtitle: "Fairness tracking, opportunity visibility, and planner history for the current team."
    };
  }

  if (pathname.startsWith("/fairness/member/")) {
    return {
      title: "Member Fairness",
      subtitle: "Leadership-only fairness detail for one member's saved history, quota progress, and recent week-by-week outcomes."
    };
  }

  if (pathname === "/my-fairness") {
    return {
      title: "My Fairness",
      subtitle: "Your own fairness history with available weeks, actual XI chances, bench outcomes, and quota progress."
    };
  }

  if (pathname === "/memberships") {
    return {
      title: `${teamName} Memberships`,
      subtitle: "V2 membership foundation for team members, linked accounts, linked players, and season coverage."
    };
  }

  if (pathname === "/validation") {
    return {
      title: `${teamName} Validation`,
      subtitle: "Admin checks for player linking, XI reconstruction, and historical data quality."
    };
  }

  if (pathname === "/profile") {
    return {
      title: "Profile",
      subtitle: "Your account details, role access, and team assignment."
    };
  }

  if (pathname === "/feedback") {
    return {
      title: `${teamName} Feedback`,
      subtitle: "Structured product feedback from real team usage, with admin review and status tracking."
    };
  }

  if (pathname.startsWith("/players/")) {
    return {
      title: "Player Profile",
      subtitle: "Detailed batting, bowling, and recent-match performance for the selected squad player."
    };
  }

  return {
    title: teamName,
    subtitle: "Team workspace"
  };
}

export default function Topbar({ hasTeam, toggleSidebar }: Props) {
  const pathname = usePathname();
  const { teamName } = useActiveTeamBranding();
  const header = getPageHeader(pathname, teamName, hasTeam);

  return (
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
              borderColor: "divider",
              backgroundColor: "background.default",
              width: 42,
              height: 42,
              "&:hover": {
                backgroundColor: "action.hover"
              }
            }}
          >
            <MenuIcon />
          </IconButton>

          <Stack spacing={0.5}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                lineHeight: 1.1,
                color: "text.primary",
                fontSize: { xs: "1.3rem", sm: "1.65rem", md: "2.125rem" }
              }}
            >
              {header.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                display: { xs: "none", sm: "block" },
                color: "text.secondary",
                lineHeight: 1.35,
                maxWidth: { xs: "100%", lg: 760 }
              }}
            >
              {header.subtitle}
            </Typography>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
