"use client";

import { ReactNode, useEffect, useState } from "react";

import Alert, { AlertProps } from "@mui/material/Alert";
import Collapse from "@mui/material/Collapse";

type AutoHideAlertProps = AlertProps & {
  children: ReactNode;
  timeoutMs?: number;
  resetKey?: string | number | boolean | null;
};

function AutoHideAlertInner({
  children,
  timeoutMs = 8000,
  ...alertProps
}: Omit<AutoHideAlertProps, "resetKey">) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setVisible(false);
    }, timeoutMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [timeoutMs]);

  return (
    <Collapse in={visible} timeout={250} unmountOnExit>
      <Alert {...alertProps}>
        {children}
      </Alert>
    </Collapse>
  );
}

export default function AutoHideAlert({
  resetKey,
  ...props
}: AutoHideAlertProps) {
  return (
    <AutoHideAlertInner
      key={String(resetKey ?? "__default__")}
      {...props}
    />
  );
}
