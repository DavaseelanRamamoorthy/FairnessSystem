"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Select,
  MenuItem
} from "@mui/material";

import DashboardIcon from "@mui/icons-material/Dashboard";
import SportsCricketIcon from "@mui/icons-material/SportsCricket";
import GroupIcon from "@mui/icons-material/Group";
import { currentTeamName } from "@/app/config/teamConfig";

interface Props {
  collapsed?: boolean;
}

const navItems = [
  { title: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
  { title: "Matches", path: "/matches", icon: <SportsCricketIcon /> },
  { title: "Players", path: "/players", icon: <GroupIcon /> }
];

export default function Sidebar({ collapsed }: Props) {

  const pathname = usePathname();

  return (

    <Box
      sx={{
        width: collapsed ? 80 : 260,
        borderRight: "1px solid",
        borderColor: "divider",
        minHeight: "100vh",
        p: 3,
        position: "fixed",
        overflowY: "auto",
        transition: "width .2s"
      }}
    >

      {/* Logo */}

      {!collapsed && (

        <Typography
          variant="h5"
          sx={{ fontWeight: 700, mb: 3 }}
        >
          SportFair
        </Typography>

      )}

      {/* Team Switcher */}

      {!collapsed && (

        <Select
          fullWidth
          size="small"
          defaultValue={currentTeamName}
          sx={{ mb: 4 }}
        >
          <MenuItem value={currentTeamName}>{currentTeamName}</MenuItem>
        </Select>

      )}

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
                  borderRadius: 2,
                  mb: 1,
                  position: "relative",
                  justifyContent: collapsed ? "center" : "flex-start",

                  bgcolor: active ? "action.selected" : "transparent",

                  "&:hover": {
                    bgcolor: "action.hover"
                  },

                  "&::before": active
                    ? {
                        content: '""',
                        position: "absolute",
                        left: -12,
                        top: "20%",
                        height: "60%",
                        width: 4,
                        borderRadius: 2,
                        bgcolor: "primary.main"
                      }
                    : {}
                }}
              >

                <ListItemIcon
                  sx={{
                    minWidth: collapsed ? 0 : 40,
                    color: active ? "primary.main" : "text.secondary"
                  }}
                >
                  {item.icon}
                </ListItemIcon>

                {!collapsed && (

                  <ListItemText
                    primary={item.title}
                    primaryTypographyProps={{
                      fontWeight: active ? 600 : 400
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