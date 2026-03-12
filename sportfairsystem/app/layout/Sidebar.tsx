"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import DashboardIcon from "@mui/icons-material/Dashboard";
import SportsCricketIcon from "@mui/icons-material/SportsCricket";
import GroupIcon from "@mui/icons-material/Group";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import { useViewMode } from "@/app/context/ViewModeContext";
import { currentTeamName, currentTeamPrefix } from "@/app/config/teamConfig";

interface Props {
  collapsed?: boolean;
}

const baseNavItems = [
  { title: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
  { title: "Matches", path: "/matches", icon: <SportsCricketIcon /> },
  { title: "Players", path: "/players", icon: <GroupIcon /> }
];

const adminNavItems = [
  { title: "Analytics", path: "/analytics", icon: <QueryStatsIcon /> },
  { title: "Validation", path: "/validation", icon: <RuleRoundedIcon /> }
];

const SIDEBAR_NAVY = "#0A1A49";
const SIDEBAR_NAVY_DEEP = "#061230";
const SIDEBAR_RED = "#E53935";

export default function Sidebar({ collapsed }: Props) {

  const pathname = usePathname();
  const { isAdminMode } = useViewMode();
  const navItems = isAdminMode
    ? [...baseNavItems, ...adminNavItems]
    : baseNavItems;

  return (

    <Box
      sx={{
        width: collapsed ? 80 : 260,
        borderRight: "1px solid",
        borderColor: "divider",
        minHeight: "100vh",
        p: collapsed ? 2 : 3,
        position: "fixed",
        overflowY: "auto",
        transition: "width .2s",
        bgcolor: "#FBFCFF",
        backgroundImage: `linear-gradient(180deg, ${alpha("#DCE7FF", 0.35)} 0%, rgba(255,255,255,0) 26%)`
      }}
    >

      {/* Logo */}

      <Box
        sx={{
          mb: collapsed ? 3 : 2.5,
          px: collapsed ? 0 : 0.5,
          py: collapsed ? 0.25 : 0.5
        }}
      >
        {collapsed ? (
          <Box
            sx={{
              width: 40,
              height: 40,
              mx: "auto",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: SIDEBAR_NAVY,
              border: "1px solid",
              borderColor: alpha(SIDEBAR_NAVY, 0.14),
              backgroundColor: alpha("#DCE7FF", 0.45)
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {currentTeamPrefix}
            </Typography>
          </Box>
        ) : (
          <Box>
            <Typography variant="overline" sx={{ color: "text.secondary" }}>
              Team Space
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary" }}>
              {currentTeamName}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Navigation */}

      <List>

        {navItems.map((item) => {

          const active = pathname === item.path;

          return (

            <Link
              key={item.title}
              href={item.path}
              style={{ textDecoration: "none", color: "inherit" }}
            >

              <ListItemButton
                sx={{
                  borderRadius: collapsed ? 3 : 2.5,
                  mb: 1.25,
                  position: "relative",
                  justifyContent: collapsed ? "center" : "flex-start",
                  px: collapsed ? 1.5 : 1.75,
                  py: collapsed ? 1.5 : 1.2,
                  color: active ? "#FFFFFF" : "text.primary",
                  background: active
                    ? `linear-gradient(135deg, ${SIDEBAR_NAVY_DEEP} 0%, ${SIDEBAR_NAVY} 58%, #102969 100%)`
                    : "transparent",
                  boxShadow: active
                    ? `0 12px 28px ${alpha(SIDEBAR_NAVY_DEEP, 0.16)}`
                    : "none",
                  transition: "all .18s ease",
                  "&:hover": {
                    background: active
                      ? `linear-gradient(135deg, ${SIDEBAR_NAVY_DEEP} 0%, ${SIDEBAR_NAVY} 58%, #102969 100%)`
                      : `linear-gradient(135deg, ${alpha(SIDEBAR_NAVY, 0.08)} 0%, ${alpha("#102969", 0.04)} 100%)`,
                    transform: collapsed ? "translateY(-1px)" : "translateX(3px)"
                  },
                  "&::before": active
                    ? {
                      content: '""',
                      position: "absolute",
                      left: collapsed ? "50%" : -12,
                      bottom: collapsed ? -8 : "20%",
                      transform: collapsed ? "translateX(-50%)" : "none",
                      height: collapsed ? 4 : "60%",
                      width: collapsed ? "60%" : 4,
                      borderRadius: 999,
                      background: `linear-gradient(180deg, ${SIDEBAR_RED} 0%, #FF7B57 100%)`
                    }
                    : undefined,
                  "&::after": active
                    ? {
                      content: '""',
                      position: "absolute",
                      inset: 0,
                      borderRadius: "inherit",
                      pointerEvents: "none",
                      backgroundImage: [
                        `linear-gradient(${alpha(SIDEBAR_RED, 0.26)} 0 0)`,
                        `linear-gradient(${alpha(SIDEBAR_RED, 0.26)} 0 0)`
                      ].join(", "),
                      backgroundRepeat: "no-repeat",
                      backgroundSize: ["26px 2px", "2px 26px"].join(", "),
                      backgroundPosition: ["84% 28%", "84% 28%"].join(", ")
                    }
                    : undefined
                }}
              >

                <ListItemIcon
                  sx={{
                    minWidth: collapsed ? 0 : 40,
                    color: active ? "#FFFFFF" : "text.secondary",
                    justifyContent: "center",
                    "& svg": {
                      fontSize: 22
                    }
                  }}
                >
                  {item.icon}
                </ListItemIcon>

                {!collapsed && (

                  <ListItemText
                    primary={item.title}
                    primaryTypographyProps={{
                      fontWeight: active ? 700 : 500
                    }}
                  />

                )}

              </ListItemButton>

            </Link>

          );

        })}

      </List>

    </Box>

  );
}
