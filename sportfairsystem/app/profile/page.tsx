"use client";

import DeleteOutline from "@mui/icons-material/DeleteOutline";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  addUnavailability,
  leaveTeam,
  loadContact,
  loadUnavailability,
  removeUnavailability,
  updateMyProfile,
  type Member,
  type MemberContact
} from "@/src/db/membership";
import { BAT_PREFS, BOWL_PREFS, LABELS, PLAYER_ROLES } from "@/src/membership/form";
import { ErrorNote, Loading, NoAccess, Page, Section, useAction, useLoad } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";

function ProfileForm({ member, contact, teamId, onSaved }: { member: Member; contact: MemberContact | null; teamId: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    display_name: member.display_name,
    primary_roles: member.primary_roles,
    bat_pref: member.bat_pref as string,
    bowl_pref: member.bowl_pref as string,
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    whatsapp: contact?.whatsapp ?? ""
  });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();

  const field = (key: "display_name" | "email" | "phone" | "whatsapp" | "bat_pref" | "bowl_pref") => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      setSaved(false);
      setForm({ ...form, [key]: event.target.value });
    }
  });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await run(() =>
      updateMyProfile(teamId, {
        ...form,
        is_wicketkeeper: form.primary_roles.includes("wicket_keeper"),
        bowls: form.primary_roles.includes("bowler") || form.primary_roles.includes("all_rounder")
      })
    );
    if (ok) {
      setSaved(true);
      onSaved();
    }
  };

  return (
    <Section title="My details">
      <Stack component="form" spacing={2} onSubmit={save}>
        <TextField label="Name your teammates use" required {...field("display_name")} />
        <FormGroup row aria-label="My roles">
          {PLAYER_ROLES.map((role) => (
            <FormControlLabel
              key={role}
              label={LABELS[role]}
              control={
                <Checkbox
                  checked={form.primary_roles.includes(role)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      primary_roles: event.target.checked
                        ? [...form.primary_roles, role]
                        : form.primary_roles.filter((item) => item !== role)
                    })
                  }
                />
              }
            />
          ))}
        </FormGroup>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField select fullWidth label="Where I like to bat" {...field("bat_pref")}>
            {BAT_PREFS.map((item) => (
              <MenuItem key={item} value={item}>
                {LABELS[item]}
              </MenuItem>
            ))}
          </TextField>
          <TextField select fullWidth label="When I like to bowl" {...field("bowl_pref")}>
            {BOWL_PREFS.map((item) => (
              <MenuItem key={item} value={item}>
                {LABELS[item]}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <TextField label="Email" type="email" {...field("email")} />
        <TextField label="Mobile number" type="tel" {...field("phone")} />
        <TextField label="WhatsApp number" type="tel" {...field("whatsapp")} />
        <ErrorNote message={error} />
        {saved && <Alert severity="success">Saved.</Alert>}
        <Button type="submit" variant="contained" disabled={busy} sx={{ alignSelf: "flex-start" }}>
          Save changes
        </Button>
      </Stack>
    </Section>
  );
}

function Absences({ memberId }: { memberId: string }) {
  const load = useCallback(() => loadUnavailability(memberId), [memberId]);
  const { data, error: loadError, reload } = useLoad(load);
  const [gap, setGap] = useState({ from: "", to: "", reason: "" });
  const { busy, error, run } = useAction();

  return (
    <Section title="Time away">
      <Typography variant="body2" color="text.secondary">
        While you&apos;re away you can&apos;t be picked, and it doesn&apos;t count against your fair share.
      </Typography>
      <ErrorNote message={loadError ?? error} />
      {data?.map((row) => (
        <Stack key={row.id} direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Typography>
            {row.from_date} to {row.to_date}
            {row.reason ? ` · ${row.reason}` : ""}
          </Typography>
          <IconButton
            aria-label={`Remove time away from ${row.from_date}`}
            disabled={busy}
            onClick={async () => {
              if (await run(() => removeUnavailability(row.id))) reload();
            }}
          >
            <DeleteOutline />
          </IconButton>
        </Stack>
      ))}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField label="From" type="date" size="small" slotProps={{ inputLabel: { shrink: true } }} value={gap.from} onChange={(e) => setGap({ ...gap, from: e.target.value })} />
        <TextField label="To" type="date" size="small" slotProps={{ inputLabel: { shrink: true } }} value={gap.to} onChange={(e) => setGap({ ...gap, to: e.target.value })} />
        <TextField label="Reason (optional)" size="small" sx={{ flexGrow: 1 }} value={gap.reason} onChange={(e) => setGap({ ...gap, reason: e.target.value })} />
        <Button
          variant="outlined"
          disabled={busy || !gap.from || !gap.to}
          onClick={async () => {
            if (await run(() => addUnavailability(memberId, gap.from, gap.to, gap.reason))) {
              setGap({ from: "", to: "", reason: "" });
              reload();
            }
          }}
        >
          Add
        </Button>
      </Stack>
    </Section>
  );
}

export default function ProfilePage() {
  const session = useSession();
  const router = useRouter();
  const { member, team, seasonMember } = session;
  const memberId = member?.id ?? "";
  const load = useCallback(() => (memberId ? loadContact(memberId) : Promise.resolve(null)), [memberId]);
  const { data: contact, error, loading } = useLoad(load);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const leave = useAction();

  if (!member || !team || !seasonMember || seasonMember.status === "left") return <NoAccess />;
  if (loading) return <Loading />;

  return (
    <Page title="My profile">
      <ErrorNote message={error} />
      <ProfileForm member={member} contact={contact ?? null} teamId={team.id} onSaved={session.refresh} />
      <Absences memberId={member.id} />
      <Section title="Leaving the team">
        <Typography variant="body2" color="text.secondary">
          Your match history stays, and you can come back later.
        </Typography>
        <Button color="error" variant="outlined" sx={{ alignSelf: "flex-start" }} onClick={() => setConfirmLeave(true)}>
          Leave the team
        </Button>
      </Section>
      <Dialog open={confirmLeave} onClose={() => setConfirmLeave(false)}>
        <DialogTitle>Leave the team?</DialogTitle>
        <DialogContent>
          <DialogContentText>You&apos;ll stop being picked, and only the organiser can bring you back this season.</DialogContentText>
          <ErrorNote message={leave.error} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmLeave(false)}>Stay</Button>
          <Button
            color="error"
            disabled={leave.busy}
            onClick={async () => {
              if (await leave.run(() => leaveTeam(member.id))) {
                session.refresh();
                router.replace("/");
              }
            }}
          >
            Leave the team
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
