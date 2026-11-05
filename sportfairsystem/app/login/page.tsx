"use client";

import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/src/db/client";
import { ErrorNote, Page, Section, useAction } from "@/src/ui/kit";
import { safeNext } from "@/src/ui/nav";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run } = useAction();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await run(async () => {
      const { error: authError } = await supabase().auth.signInWithPassword({ email, password });
      if (authError) throw new Error(authError.message);
    });
    if (ok) router.replace(safeNext(window.location.search));
  };

  return (
    <Page title="Sign in">
      <Section>
        <Stack component="form" spacing={2} onSubmit={submit}>
          <ErrorNote message={error} />
          <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="contained" disabled={busy}>
            Sign in
          </Button>
          <Typography variant="body2">
            New here?{" "}
            <Link
              component={NextLink}
              href="/signup"
              onClick={(event: React.MouseEvent) => {
                // keep ?next= so a claim link survives creating an account
                event.preventDefault();
                router.push(`/signup${window.location.search}`);
              }}
            >
              Create an account
            </Link>
            {" · "}
            <Link component={NextLink} href="/forgot-password">
              Forgot password
            </Link>
          </Typography>
        </Stack>
      </Section>
    </Page>
  );
}
