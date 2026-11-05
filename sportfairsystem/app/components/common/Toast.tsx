"use client";

import Alert, { AlertColor } from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";

type ToastProps = {
  open: boolean;
  message: string;
  severity?: AlertColor;
  autoHideDuration?: number;
  onClose: () => void;
};

export default function Toast({
  open,
  message,
  severity = "success",
  autoHideDuration = 5000,
  onClose
}: ToastProps) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={(_, reason) => {
        if (reason === "clickaway") {
          return;
        }

        onClose();
      }}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
    >
      <Alert
        severity={severity}
        variant="filled"
        onClose={onClose}
        sx={{ width: "100%", minWidth: 280 }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
