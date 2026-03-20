"use client";

import { ReactNode } from "react";

import { Box, TableContainer, TableContainerProps } from "@mui/material";

type ResponsiveTableContainerProps = TableContainerProps & {
  children: ReactNode;
};

export default function ResponsiveTableContainer({
  children,
  sx,
  ...props
}: ResponsiveTableContainerProps) {
  return (
    <Box sx={{ width: "100%", minWidth: 0, overflowX: "auto" }}>
      <TableContainer
        {...props}
        sx={{
          minWidth: 0,
          "& .MuiTable-root": {
            minWidth: { xs: 640, md: "100%" }
          },
          ...sx
        }}
      >
        {children}
      </TableContainer>
    </Box>
  );
}
