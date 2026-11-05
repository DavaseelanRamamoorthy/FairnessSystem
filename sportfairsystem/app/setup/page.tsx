"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { bootstrapTeam } from "@/src/db/membership";
import { ErrorNote, Page, Section, useAction } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";

/** First-run screen: whoever creates the team becomes its organiser. */
export default function SetupPage() {
  const session = useSession();
  const router = useRouter();
  const year = new Date().getFullYear() + 1;
  const [form, setForm] = useState({
    teamName: "Moonwalkers",
    displayName: "",
    year: String(year),
    startsOn: `${year}-04-01`,
    endsOn: `${year}-10-31`,
    fee: "0"
  });
  const { busy, error, run } = useAction();
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: event.target.value });

  if (session.team) {
    return (
      <Page title="Your team is set up">
        <Button component={NextLink} href="/" variant="contained" sx={{ alignSelf: "flex-start" }}>
          Go to home
        </Button>
      </Page>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await run(() =>
      bootstrapTeam({ ...form, year: Number(form.year), fee: Number(form.fee) })
    );
    if (ok) {
      session.refresh();
      router.replace("/");
    }
  };

  return (
    <Page title="Set up your team" subtitle="You'll be the organiser. This only happens once.">
      <Section>
        <Stack component="form" spacing={2} onSubmit={submit}>
          <ErrorNote message={error} />
          <TextField label="Team name" required value={form.teamName} onChange={set("teamName")} />
          <TextField label="Your name" required value={form.displayName} onChange={set("displayName")} />
          <TextField label="Season year" type="number" required value={form.year} onChange={set("year")} />
          <TextField label="Season starts" type="date" required slotProps={{ inputLabel: { shrink: true } }} value={form.startsOn} onChange={set("startsOn")} />
          <TextField label="Season ends" type="date" required slotProps={{ inputLabel: { shrink: true } }} value={form.endsOn} onChange={set("endsOn")} />
          <TextField label="Membership fee (EUR)" type="number" required slotProps={{ htmlInput: { min: 0, step: "0.01" } }} value={form.fee} onChange={set("fee")} />
          <Button type="submit" variant="contained" disabled={busy}>
            Create team
          </Button>
        </Stack>
      </Section>
    </Page>
  );
}
