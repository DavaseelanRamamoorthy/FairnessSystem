"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import { supabase } from "@/src/db/client";
import { ErrorNote, Page, Section, useAction } from "@/src/ui/kit";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const { error: authError } = await supabase().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (authError) throw new Error(authError.message);
      setSent(true);
    });
  };

  return (
    <Page title="Reset your password">
      <Section>
        {sent ? (
          <Alert severity="success">If that email has an account, a reset link is on its way.</Alert>
        ) : (
          <Stack component="form" spacing={2} onSubmit={submit}>
            <ErrorNote message={error} />
            <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" variant="contained" disabled={busy}>
              Send reset link
            </Button>
          </Stack>
        )}
      </Section>
    </Page>
  );
}
