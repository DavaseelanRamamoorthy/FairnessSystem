"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Avatar,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { varAlpha } from "minimal-shared/utils";

import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import { useAuth } from "@/app/context/AuthContext";
import { currentTeamName, currentTeamPrefix } from "@/app/config/teamConfig";
import { getDesktopNavItems, isNavPathActive } from "@/app/layout/navigationConfig";

interface Props {
  collapsed?: boolean;
  onOpenSettings: () => void;
}

export default function Sidebar({ collapsed, onOpenSettings }: Props) {

  const pathname = usePathname();
  const { isAdmin, profile } = useAuth();
  const navItems = getDesktopNavItems(isAdmin);
  const profileLetter = (profile?.firstName ?? profile?.email ?? "P").charAt(0).toUpperCase();
  const profileDisplayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim()
    || profile?.username
    || profile?.email
    || "Profile";

  return (
    <>
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
          bgcolor: "background.paper",
          backgroundImage: (theme) =>
            `linear-gradient(180deg, ${varAlpha(theme.vars.palette.primary.mainChannel, 0.1)} 0%, transparent 26%)`,
          display: "flex",
          flexDirection: "column"
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
              color: "var(--app-accent-dark)",
              border: "1px solid",
              borderColor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.18),
              backgroundColor: "var(--app-accent-soft)"
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

      <List sx={{ flex: 1 }}>

        {navItems.map((item) => {

          const active = isNavPathActive(pathname, item.path);

          const listItem = (
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
                  ? "linear-gradient(135deg, var(--app-header-start) 0%, var(--app-header-mid) 58%, var(--app-header-end) 100%)"
                  : "transparent",
                boxShadow: active
                  ? (theme) => `0 12px 28px ${varAlpha(theme.vars.palette.grey["900Channel"], 0.2)}`
                  : "none",
                transition: "all .18s ease",
                "&:hover": {
                  background: active
                    ? "linear-gradient(135deg, var(--app-header-start) 0%, var(--app-header-mid) 58%, var(--app-header-end) 100%)"
                    : undefined,
                  transform: collapsed ? "translateY(-1px)" : "translateX(3px)"
                },
                ...(active
                  ? {}
                  : {
                    "&:hover": {
                      background: (theme) =>
                        `linear-gradient(135deg, ${varAlpha(theme.vars.palette.primary.mainChannel, 0.08)} 0%, ${varAlpha(theme.vars.palette.primary.mainChannel, 0.03)} 100%)`,
                      transform: collapsed ? "translateY(-1px)" : "translateX(3px)"
                    }
                  }),
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
                    background: "linear-gradient(180deg, var(--app-danger-main) 0%, var(--app-warning-main) 100%)"
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
                      `linear-gradient(${varAlpha("var(--palette-error-mainChannel)", 0.26)} 0 0)`,
                      `linear-gradient(${varAlpha("var(--palette-error-mainChannel)", 0.26)} 0 0)`
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
          );

          return (
            <Tooltip
              key={item.title}
              title={collapsed ? item.title : ""}
              placement="right"
              arrow
              disableHoverListener={!collapsed}
            >
              <Link
                href={item.path}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                {listItem}
              </Link>
            </Tooltip>
          );

        })}

      </List>

        <Box sx={{ pt: 1.5 }}>
          <Tooltip
            title={collapsed ? "Account" : ""}
            placement="right"
            arrow
            disableHoverListener={!collapsed}
          >
            <ListItemButton
              onClick={onOpenSettings}
              sx={{
                borderRadius: collapsed ? 3 : 2.5,
                justifyContent: collapsed ? "center" : "flex-start",
                px: collapsed ? 1.5 : 1.75,
                py: collapsed ? 1.5 : 1.2,
                color: "text.primary",
                transition: "all .18s ease",
                "&:hover": {
                  background: (theme) =>
                    `linear-gradient(135deg, ${varAlpha(theme.vars.palette.primary.mainChannel, 0.08)} 0%, ${varAlpha(theme.vars.palette.primary.mainChannel, 0.03)} 100%)`,
                  transform: collapsed ? "translateY(-1px)" : "translateX(3px)"
                }
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? 0 : 40,
                  color: "text.secondary",
                  justifyContent: "center"
                }}
              >
                {profile ? (
                  <Avatar
                    sx={{
                      width: 30,
                      height: 30,
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      color: "#061230",
                      backgroundColor: alpha("#FFFFFF", 0.92),
                      border: "1px solid",
                      borderColor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.18)
                    }}
                  >
                    {profileLetter}
                  </Avatar>
                ) : (
                  <AccountCircleRoundedIcon />
                )}
              </ListItemIcon>

              {!collapsed && (
                <ListItemText
                  primary={profileDisplayName}
                  primaryTypographyProps={{
                    fontWeight: 700,
                    noWrap: true
                  }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        </Box>
      </Box>
    </>

  );
}
