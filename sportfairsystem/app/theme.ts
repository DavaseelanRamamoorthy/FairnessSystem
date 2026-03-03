"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  typography: {
    fontFamily: "var(--font-plus-jakarta)",

    h1: {
      fontFamily: "var(--font-lexend-deca)",
      fontWeight: 700,
    },
    h2: {
      fontFamily: "var(--font-lexend-deca)",
      fontWeight: 700,
    },
    h3: {
      fontFamily: "var(--font-lexend-deca)",
      fontWeight: 700,
    },
    h4: {
      fontFamily: "var(--font-lexend-deca)",
      fontWeight: 700,
    },
  },

  palette: {
    mode: "light",
    primary: {
      main: "#4f46e5", // Indigo feel (Moonwalkers vibe)
    },
    background: {
      default: "#f8fafc",
    },
  },

  shape: {
    borderRadius: 16,
  },
});

export default theme;