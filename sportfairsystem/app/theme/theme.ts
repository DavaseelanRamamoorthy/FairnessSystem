import { createTheme } from "@mui/material/styles";

const theme = createTheme({

  palette: {

    mode: "light",

    primary: {
      main: "#1976d2",
    },

    secondary: {
      main: "#9c27b0",
    },

    background: {
      default: "#f4f6f8",
      paper: "#ffffff",
    },

  },

  shape: {
    borderRadius: 12,
  },

  typography: {

    fontFamily: `"Inter", "Roboto", "Helvetica", "Arial", sans-serif`,

    h4: {
      fontWeight: 600,
    },

    h6: {
      fontWeight: 600,
    },

  },

  components: {

    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        },
      },
    },

  },

});

export default theme;