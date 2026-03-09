"use client";

import { useState } from "react";
import { Box } from "@mui/material";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {

  const [collapsed, setCollapsed] = useState(false);

  return (

    <Box sx={{ display: "flex", minHeight: "100vh" }}>

      <Sidebar collapsed={collapsed} />

      <Box
        sx={{
          flexGrow: 1,
          ml: collapsed ? "80px" : "260px",
          transition: "margin-left .2s"
        }}
      >

        <Topbar toggleSidebar={() => setCollapsed(!collapsed)} />

        <Box sx={{ p: 4 }}>
          {children}
        </Box>

      </Box>

    </Box>

  );
}