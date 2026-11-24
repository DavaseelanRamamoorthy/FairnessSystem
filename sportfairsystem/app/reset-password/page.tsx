"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/src/db/client";
import { ErrorNote, Page, Section, useAction } from "@/src/ui/kit";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const { busy, error, run } = useAction();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await run(async () => {
      const { error: authError } = await supabase().auth.updateUser({ password });
      if (authError) throw new Error(authError.message);
    });
    if (ok) router.replace("/");
  };

  return (
    <Page title="Choose a new password">
      <Section>
        <Stack component="form" spacing={2} onSubmit={submit}>
          <ErrorNote message={error} />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            helperText="At least 8 characters"
            slotProps={{ htmlInput: { minLength: 8 } }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="contained" disabled={busy}>
            Save password
          </Button>
        </Stack>
      </Section>
    </Page>
  );
}
