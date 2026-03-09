"use client";

import { Box, IconButton, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { currentTeamName } from "@/app/config/teamConfig";

interface Props {
  toggleSidebar?: () => void;
}

export default function Topbar({ toggleSidebar }: Props) {

  return (

    <Box
      sx={{
        height: 64,
        display: "flex",
        alignItems: "center",
        px: 3,
        borderBottom: "1px solid",
        borderColor: "divider"
      }}
    >

      <IconButton onClick={toggleSidebar}>
        <MenuIcon />
      </IconButton>

      <Typography sx={{ ml: 2 }}>
        Welcome back 👋 {currentTeamName}
      </Typography>

    </Box>

  );
}