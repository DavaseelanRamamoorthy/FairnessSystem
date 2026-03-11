"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Box } from "@mui/material";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {

  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const isMatchesPage = pathname === "/matches";

  return (

    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        height: isMatchesPage ? "100vh" : "auto",
        overflow: isMatchesPage ? "hidden" : "visible"
      }}
    >

      <Sidebar collapsed={collapsed} />

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          ml: collapsed ? "80px" : "260px",
          transition: "margin-left .2s"
        }}
      >

        <Topbar toggleSidebar={() => setCollapsed(!collapsed)} />

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            p: 4,
            overflow: isMatchesPage ? "hidden" : "auto"
          }}
        >
          {children}
        </Box>

      </Box>

    </Box>

  );
}
