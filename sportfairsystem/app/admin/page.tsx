"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useState } from "react";
import {
  approveMembership,
  loadApplications,
  loadIdentities,
  loadMembers,
  rejectMembership,
  type Application,
  type Identity,
  type Member
} from "@/src/db/membership";
import { resolveName } from "@/src/import/nameMatching";
import { identitiesFromAnswers, LABELS, parseCricHeroesId } from "@/src/membership/form";
import { ErrorNote, Loading, Page, Section, useAction, useLoad } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";

type Directory = { members: Member[]; identities: Identity[] };

/** Existing members this applicant might already be, from every name they gave. */
function possibleMatches(application: Application, directory: Directory) {
  const { answers } = application;
  const refs = directory.members.map((m) => ({ id: m.id, displayName: m.display_name }));
  const identities = directory.identities.map((i) => ({
    memberId: i.member_id,
    source: i.source,
    externalId: i.external_id,
    nameKey: i.name_key
  }));
  const found = new Map<string, string>();
  const check = (name: string | undefined, source: "spond" | "cricheroes" | "manual", externalId?: string | null) => {
    if (!name?.trim()) return;
    const result = resolveName({ name, externalId }, source, identities, refs);
    if (result.status === "matched") {
      const member = refs.find((m) => m.id === result.memberId);
      if (member) found.set(member.id, `${member.displayName} (same ${LABELS[source]} name)`);
    } else if (result.status === "suggested") {
      for (const s of result.suggestions) {
        if (!found.has(s.memberId)) found.set(s.memberId, `${s.displayName} (${s.why})`);
      }
    }
  };
  check(answers.cricheroes_name, "cricheroes", parseCricHeroesId(answers.cricheroes_url));
  check(answers.spond_name, "spond");
  check(answers.previous_name, "manual");
  check(answers.display_name, "manual");
  check(answers.full_name, "manual");
  return found;
}

function ApplicationCard({ application, directory, onDone }: { application: Application; directory: Directory; onDone: () => void }) {
  const { answers } = application;
  const matches = useMemo(() => possibleMatches(application, directory), [application, directory]);
  const [linkTo, setLinkTo] = useState(application.existing_member_id ?? "");
  const [spondName, setSpondName] = useState(answers.spond_name ?? "");
  const [cricHeroesName, setCricHeroesName] = useState(answers.cricheroes_name ?? "");
  const [cricHeroesId, setCricHeroesId] = useState(parseCricHeroesId(answers.cricheroes_url) ?? "");
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const { busy, error, run } = useAction();

  const approve = async () => {
    const identities = identitiesFromAnswers({ spond_name: spondName, cricheroes_name: cricHeroesName }).map((identity) =>
      identity.source === "cricheroes" ? { ...identity, external_id: cricHeroesId.trim() || null } : identity
    );
    if (await run(() => approveMembership(application.id, linkTo || null, identities))) onDone();
  };

  const interest = answers.responsibilities_interest ?? [];
  const absences = answers.unavailability ?? [];

  return (
    <Section title={answers.display_name ?? "Applicant"} action={<Chip size="small" label={application.kind === "renewal" ? "Renewal" : "New"} />}>
      <Stack spacing={0.5}>
        <Typography variant="body2">
          {answers.full_name} · {answers.email} · {answers.phone}
        </Typography>
        <Typography variant="body2">Roles: {(answers.primary_roles ?? []).map((r) => LABELS[r]).join(", ")}</Typography>
        {answers.previous_name && <Typography variant="body2">Played before as: {answers.previous_name}</Typography>}
        {answers.cricheroes_url && <Typography variant="body2" sx={{ wordBreak: "break-all" }}>CricHeroes: {answers.cricheroes_url}</Typography>}
        {answers.payment_reference && <Typography variant="body2">Payment reference: {answers.payment_reference}</Typography>}
        {absences.length > 0 && (
          <Typography variant="body2">Away: {absences.map((a) => `${a.from} to ${a.to}`).join("; ")}</Typography>
        )}
        {interest.length > 0 && (
          <Typography variant="body2">Could help with: {interest.map((r) => LABELS[r]).join(", ")} (assign in Members if you agree)</Typography>
        )}
        {answers.notes && <Typography variant="body2">Notes: {answers.notes}</Typography>}
      </Stack>

      <TextField
        select
        label="Is this an existing player?"
        slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        value={linkTo}
        onChange={(event) => setLinkTo(event.target.value)}
        helperText={matches.size > 0 ? "Suggestions are listed first. Picking one keeps their match history." : "No similar names found."}
      >
        <MenuItem value="">No, create a new player</MenuItem>
        {[...matches].map(([id, label]) => (
          <MenuItem key={id} value={id}>
            {label}
          </MenuItem>
        ))}
        {directory.members
          .filter((m) => !matches.has(m.id) && !m.user_id)
          .map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.display_name}
            </MenuItem>
          ))}
      </TextField>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField fullWidth label="Spond name" value={spondName} onChange={(e) => setSpondName(e.target.value)} />
        <TextField fullWidth label="CricHeroes name" value={cricHeroesName} onChange={(e) => setCricHeroesName(e.target.value)} />
        <TextField
          fullWidth
          label="CricHeroes player ID"
          helperText="Open their profile link and copy the number from the address, if it isn't filled in."
          value={cricHeroesId}
          onChange={(e) => setCricHeroesId(e.target.value)}
        />
      </Stack>

      <ErrorNote message={error} />
      <Stack direction="row" spacing={1}>
        <Button variant="contained" disabled={busy} onClick={approve}>
          Approve
        </Button>
        <Button color="error" disabled={busy} onClick={() => setRejecting(true)}>
          Reject
        </Button>
      </Stack>

      <Dialog open={rejecting} onClose={() => setRejecting(false)} fullWidth>
        <DialogTitle>Reject this application?</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            margin="dense"
            label="Reason (shown to the applicant)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejecting(false)}>Cancel</Button>
          <Button
            color="error"
            disabled={busy}
            onClick={async () => {
              if (await run(() => rejectMembership(application.id, note))) {
                setRejecting(false);
                onDone();
              }
            }}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Section>
  );
}

export default function ApplicationsPage() {
  const { season, team } = useSession();
  const seasonId = season?.id ?? "";
  const teamId = team?.id ?? "";
  const load = useCallback(async () => {
    const [applications, members, identities] = await Promise.all([
      loadApplications(seasonId),
      loadMembers(teamId),
      loadIdentities(teamId)
    ]);
    return { applications, directory: { members, identities } };
  }, [seasonId, teamId]);
  const { data, error, loading, reload } = useLoad(load);

  return (
    <Page title="Applications" subtitle={season ? `${season.year} season` : undefined}>
      <ErrorNote message={error} />
      {loading && <Loading />}
      {data?.applications.length === 0 && <Alert severity="info">No applications are waiting.</Alert>}
      {data?.applications.map((application) => (
        <ApplicationCard key={application.id} application={application} directory={data.directory} onDone={reload} />
      ))}
    </Page>
  );
}
