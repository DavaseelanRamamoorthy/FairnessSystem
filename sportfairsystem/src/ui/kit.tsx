"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useState } from "react";

export function Page({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
      </Box>
      {children}
    </Stack>
  );
}

export function Section({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          {(title || action) && (
            <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="h6" component="h2">
                {title}
              </Typography>
              {action}
            </Stack>
          )}
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function Loading() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
      <CircularProgress aria-label="Loading" />
    </Box>
  );
}

export function ErrorNote({ message }: { message: string | null | undefined }) {
  return message ? <Alert severity="error">{message}</Alert> : null;
}

export function NoAccess() {
  return <Alert severity="warning">You don&apos;t have access to this page.</Alert>;
}

/** Loads data on mount and whenever `load` changes. Wrap `load` in useCallback. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    load()
      .then((next) => {
        if (!alive) return;
        setData(next);
        setError(null);
      })
      .catch((reason: Error) => {
        if (alive) setError(reason.message);
      });
    return () => {
      alive = false;
    };
  }, [load, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, error, loading: data === undefined && !error, reload };
}

/** Runs an action with a busy flag and a readable error. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, setError, run };
}

export function money(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}
