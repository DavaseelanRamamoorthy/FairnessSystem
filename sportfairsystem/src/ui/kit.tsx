"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useState } from "react";
import { Banner, useShell } from "./brand";

/**
 * Every page opens with the navy club banner. On signed-out pages (sign in,
 * set up, claim) the banner becomes the header of a centred card instead.
 */
export function Page({
  title,
  subtitle,
  actions,
  children
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { bare, eyebrow } = useShell();
  if (bare) {
    return (
      <Card sx={{ borderRadius: 3, overflow: "hidden", border: "1px solid rgba(120,130,210,.25)", boxShadow: "0 20px 50px rgba(0,0,0,.35)" }}>
        <Banner eyebrow={eyebrow} title={title} subtitle={subtitle} actions={actions} logo square />
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2.5}>{children}</Stack>
        </CardContent>
      </Card>
    );
  }
  return (
    <Stack spacing={3}>
      <Banner eyebrow={eyebrow} title={title} subtitle={subtitle} actions={actions} />
      {children}
    </Stack>
  );
}

export function Section({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  const { bare } = useShell();
  if (bare) {
    // Already inside the signed-out card: no second frame.
    return (
      <Stack spacing={2}>
        {title && (
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
        )}
        {children}
      </Stack>
    );
  }
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
