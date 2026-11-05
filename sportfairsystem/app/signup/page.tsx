"use client";

import Alert from "@mui/material/Alert";
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

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);
  const { busy, error, run } = useAction();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const { data, error: authError } = await supabase().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` }
      });
      if (authError) throw new Error(authError.message);
      if (data.session) router.replace(safeNext(window.location.search));
      else setCheckEmail(true);
    });
  };

  return (
    <Page title="Create your account" subtitle="You'll fill in the membership form next.">
      <Section>
        {checkEmail ? (
          <Alert severity="success">Check your email and open the link to finish signing up.</Alert>
        ) : (
          <Stack component="form" spacing={2} onSubmit={submit}>
            <ErrorNote message={error} />
            <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              helperText="At least 8 characters"
              slotProps={{ htmlInput: { minLength: 8 } }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" variant="contained" disabled={busy}>
              Create account
            </Button>
            <Typography variant="body2">
              Already have an account?{" "}
              <Link component={NextLink} href="/login">
                Sign in
              </Link>
            </Typography>
          </Stack>
        )}
      </Section>
    </Page>
  );
}
