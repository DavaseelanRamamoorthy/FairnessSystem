"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { createSeason, updateSeason, type Season } from "@/src/db/membership";
import { ErrorNote, Page, Section, useAction } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";

function SeasonForm({ season, onSaved }: { season: Season; onSaved: () => void }) {
  const [form, setForm] = useState({
    starts_on: season.starts_on,
    ends_on: season.ends_on,
    membership_fee: String(season.membership_fee)
  });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const dateProps = { slotProps: { inputLabel: { shrink: true } } };

  return (
    <Section title={`${season.year} season`}>
      <FormControlLabel
        label="Registration open"
        control={
          <Switch
            checked={season.registration_open}
            disabled={busy}
            onChange={async (event) => {
              const open = event.target.checked;
              if (await run(() => updateSeason(season.id, { registration_open: open }))) onSaved();
            }}
          />
        }
      />
      {season.registration_open && (
        <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
          Share this link with the team: {typeof window === "undefined" ? "" : `${window.location.origin}/register`}
        </Typography>
      )}
      <TextField label="Season starts" type="date" {...dateProps} value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />
      <TextField label="Season ends" type="date" {...dateProps} value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />
      <TextField
        label="Membership fee (EUR)"
        type="number"
        helperText="Applies to members approved from now on."
        slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
        value={form.membership_fee}
        onChange={(e) => setForm({ ...form, membership_fee: e.target.value })}
      />
      <ErrorNote message={error} />
      {saved && <Alert severity="success">Saved.</Alert>}
      <Button
        variant="contained"
        disabled={busy}
        sx={{ alignSelf: "flex-start" }}
        onClick={async () => {
          const ok = await run(() =>
            updateSeason(season.id, {
              starts_on: form.starts_on,
              ends_on: form.ends_on,
              membership_fee: Number(form.membership_fee)
            })
          );
          if (ok) {
            setSaved(true);
            onSaved();
          }
        }}
      >
        Save season
      </Button>
    </Section>
  );
}

function NewSeason({ season, teamId, onDone }: { season: Season; teamId: string; onDone: () => void }) {
  const year = season.year + 1;
  const [form, setForm] = useState({
    year: String(year),
    starts_on: `${year}-04-01`,
    ends_on: `${year}-10-31`,
    fee: String(season.membership_fee)
  });
  const [confirming, setConfirming] = useState(false);
  const { busy, error, run } = useAction();
  const dateProps = { slotProps: { inputLabel: { shrink: true } } };

  return (
    <Section title="Start the next season">
      <Typography variant="body2" color="text.secondary">
        This closes the {season.year} season, carries the closing balance forward and opens registration. Everyone renews through
        the form, which is how you confirm who&apos;s playing.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField fullWidth label="Year" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
        <TextField fullWidth label="Starts" type="date" {...dateProps} value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />
        <TextField fullWidth label="Ends" type="date" {...dateProps} value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />
        <TextField fullWidth label="Fee (EUR)" type="number" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
      </Stack>
      <ErrorNote message={error} />
      <Button variant="outlined" sx={{ alignSelf: "flex-start" }} onClick={() => setConfirming(true)}>
        Start {form.year} season
      </Button>
      <Dialog open={confirming} onClose={() => setConfirming(false)}>
        <DialogTitle>Start the {form.year} season?</DialogTitle>
        <DialogContent>
          <DialogContentText>The {season.year} season closes, and every player has to renew. This can&apos;t be undone from the app.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
          <Button
            color="error"
            disabled={busy}
            onClick={async () => {
              setConfirming(false);
              const ok = await run(() =>
                createSeason(teamId, Number(form.year), form.starts_on, form.ends_on, Number(form.fee), season.rules)
              );
              if (ok) onDone();
            }}
          >
            Start season
          </Button>
        </DialogActions>
      </Dialog>
    </Section>
  );
}

export default function SeasonPage() {
  const session = useSession();
  const { season, team, refresh } = session;
  if (!season || !team) return <Alert severity="warning">There is no current season.</Alert>;

  return (
    <Page title="Season">
      <SeasonForm key={season.id} season={season} onSaved={refresh} />
      <NewSeason key={`next-${season.id}`} season={season} teamId={team.id} onDone={refresh} />
    </Page>
  );
}
