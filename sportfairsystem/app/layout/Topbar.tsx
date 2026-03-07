"use client";

import { AppBar, Toolbar, Typography, Box } from "@mui/material";

const drawerWidth = 240;

export default function Topbar() {
  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: `calc(100% - ${drawerWidth}px)`,
        ml: `${drawerWidth}px`,
        backgroundColor: "background.paper",
        color: "text.primary",
        borderBottom: "1px solid #eee",
      }}
    >
      <Toolbar>

        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Moonwalkers Dashboard
        </Typography>
        
      </Toolbar>
    </AppBar>
  );
}