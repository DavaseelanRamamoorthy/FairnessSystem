"use client";

import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Box
} from "@mui/material";

import DashboardIcon from "@mui/icons-material/Dashboard";
import SportsCricketIcon from "@mui/icons-material/SportsCricket";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import BarChartIcon from "@mui/icons-material/BarChart";
import Image from "next/image";

import { useRouter, usePathname } from "next/navigation";

const drawerWidth = 240;

export default function Sidebar() {

  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    {
      label: "Dashboard",
      icon: <DashboardIcon />,
      path: "/dashboard",
    },
    {
      label: "Matches",
      icon: <SportsCricketIcon />,
      path: "/matches",
    },
    {
      label: "Upload Match",
      icon: <UploadFileIcon />,
      path: "/upload",
    },
    {
      label: "Analytics",
      icon: <BarChartIcon />,
      path: "/analytics",
    },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: "border-box",
        },
      }}
    >
      <Toolbar
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          py: 2,
        }}
      >
        <Image
          src="/cricket-crew-logo.png"
          alt="Cricket Crew"
          width={180}
          height={60}
          priority
          style={{
            objectFit: "contain",
          }}
        />
      </Toolbar>

      <Box sx={{ overflow: "auto" }}>

        <List sx={{ px: 2, pt: 1 }}>

          {menuItems.map((item) => {

            const isActive = pathname === item.path;

            return (

              <ListItemButton
                key={item.label}
                onClick={() => router.push(item.path)}
                selected={isActive}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  px: 2,

                  "&.Mui-selected": {
                    backgroundColor: "primary.main",
                    color: "primary.contrastText",
                    fontWeight: 600,
                  },

                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
              >

                <ListItemIcon
                  sx={{
                    minWidth: 36,
                    color: isActive ? "primary.contrastText" : "text.secondary",
                  }}
                >
                  {item.icon}
                </ListItemIcon>

                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 500,
                  }}
                />

              </ListItemButton>

            );

          })}

        </List>

      </Box>

    </Drawer>
  );
}