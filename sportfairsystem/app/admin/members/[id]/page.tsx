"use client";

import DeleteOutline from "@mui/icons-material/DeleteOutline";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
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
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  addToSeason,
  leaveTeam,
  linkIdentity,
  loadContact,
  loadIdentities,
  loadMembers,
  loadSeasonMembers,
  memberClaimToken,
  mergeMembers,
  setMemberRole,
  unlinkIdentity,
  type SeasonMember
} from "@/src/db/membership";
import type { IdentitySource } from "@/src/import/nameMatching";
import { LABELS, RESPONSIBILITIES, SEASON_ROLES, type Responsibility, type SeasonRole } from "@/src/membership/form";
import { ErrorNote, Loading, Page, Section, useAction, useLoad } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";

function RoleEditor({ row, onSaved }: { row: SeasonMember; onSaved: () => void }) {
  const [role, setRole] = useState<SeasonRole>(row.role);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>(row.responsibilities);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();

  return (
    <Stack spacing={2}>
      <TextField
        select
        label="Role this season"
        value={role}
        onChange={(event) => {
          setSaved(false);
          setRole(event.target.value as SeasonRole);
        }}
      >
        {SEASON_ROLES.map((item) => (
          <MenuItem key={item} value={item}>
            {LABELS[item]}
          </MenuItem>
        ))}
      </TextField>
      <FormGroup row aria-label="Responsibilities">
        {RESPONSIBILITIES.map((item) => (
          <FormControlLabel
            key={item}
            label={LABELS[item]}
            control={
              <Checkbox
                checked={responsibilities.includes(item)}
                onChange={(event) => {
                  setSaved(false);
                  setResponsibilities(
                    event.target.checked ? [...responsibilities, item] : responsibilities.filter((r) => r !== item)
                  );
                }}
              />
            }
          />
        ))}
      </FormGroup>
      <ErrorNote message={error} />
      {saved && <Alert severity="success">Saved.</Alert>}
      <Button
        variant="contained"
        disabled={busy}
        sx={{ alignSelf: "flex-start" }}
        onClick={async () => {
          if (await run(() => setMemberRole(row.id, role, responsibilities))) {
            setSaved(true);
            onSaved();
          }
        }}
      >
        Save role
      </Button>
    </Stack>
  );
}

export default function MemberPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const router = useRouter();
  const teamId = session.team?.id ?? "";
  const seasonId = session.season?.id ?? "";

  const load = useCallback(async () => {
    const [members, rows, identities, contact] = await Promise.all([
      loadMembers(teamId),
      loadSeasonMembers(seasonId),
      loadIdentities(teamId),
      loadContact(id)
    ]);
    return {
      member: members.find((m) => m.id === id) ?? null,
      others: members.filter((m) => m.id !== id),
      row: rows.find((r) => r.member_id === id) ?? null,
      identities: identities.filter((i) => i.member_id === id),
      contact
    };
  }, [teamId, seasonId, id]);
  const { data, error, loading, reload } = useLoad(load);

  const [identity, setIdentity] = useState<{ source: IdentitySource; name: string; externalId: string }>({
    source: "spond",
    name: "",
    externalId: ""
  });
  const [mergeId, setMergeId] = useState("");
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [claimLink, setClaimLink] = useState("");
  const action = useAction();

  const afterChange = () => {
    reload();
    session.refresh();
  };

  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} />;
  if (!data?.member) return <Alert severity="warning">This member doesn&apos;t exist, or was merged into another.</Alert>;
  const { member, row, identities, others, contact } = data;
  const mergeTarget = others.find((m) => m.id === mergeId);

  return (
    <Page title={member.display_name}>
      <ErrorNote message={action.error} />

      <Section
        title={session.season ? `${session.season.year} season` : "Season"}
        action={row && <Chip size="small" label={LABELS[row.status]} color={row.status === "active" ? "success" : "warning"} />}
      >
        {row && row.status !== "left" ? (
          <>
            <RoleEditor key={row.id} row={row} onSaved={afterChange} />
            <Button color="error" sx={{ alignSelf: "flex-start" }} onClick={() => setConfirmLeave(true)}>
              Mark as left
            </Button>
          </>
        ) : (
          <>
            <Typography>
              {row ? "This player has left the team this season." : "This player isn't in the squad this season."}
            </Typography>
            <Button
              variant="contained"
              disabled={action.busy}
              sx={{ alignSelf: "flex-start" }}
              onClick={async () => {
                if (await action.run(() => addToSeason(member.id))) afterChange();
              }}
            >
              {row ? "Bring back" : "Add to this season"}
            </Button>
          </>
        )}
      </Section>

      <Section title="Contact">
        <Typography variant="body2">Email: {contact?.email ?? "Not given"}</Typography>
        <Typography variant="body2">Phone: {contact?.phone ?? "Not given"}</Typography>
        {!member.user_id && (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              No app account yet. Send this link so they can claim the profile and its history.
            </Typography>
            {claimLink ? (
              <TextField size="small" label="Claim link" value={claimLink} slotProps={{ input: { readOnly: true } }} />
            ) : (
              <Button
                variant="outlined"
                disabled={action.busy}
                sx={{ alignSelf: "flex-start" }}
                onClick={() =>
                  action.run(async () => {
                    const token = await memberClaimToken(member.id);
                    setClaimLink(`${window.location.origin}/claim/${token}`);
                  })
                }
              >
                Create claim link
              </Button>
            )}
          </Stack>
        )}
      </Section>

      <Section title="Names on other systems">
        <Typography variant="body2" color="text.secondary">
          These connect this player to Spond lists and scorecards.
        </Typography>
        {identities.length === 0 && <Typography variant="body2">No names linked yet.</Typography>}
        {identities.map((item) => (
          <Stack key={item.id} direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="body2">
              {LABELS[item.source]}: {item.source === "app_account" ? item.display_name : item.display_name}
              {item.external_id && item.source !== "app_account" ? ` (ID ${item.external_id})` : ""}
            </Typography>
            {item.source !== "app_account" && (
              <IconButton
                aria-label={`Unlink ${item.display_name}`}
                disabled={action.busy}
                onClick={async () => {
                  if (await action.run(() => unlinkIdentity(item.id))) reload();
                }}
              >
                <DeleteOutline />
              </IconButton>
            )}
          </Stack>
        ))}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            select
            size="small"
            label="Where"
            sx={{ minWidth: 140 }}
            value={identity.source}
            onChange={(e) => setIdentity({ ...identity, source: e.target.value as IdentitySource })}
          >
            {(["spond", "cricheroes", "pdf", "manual"] as const).map((source) => (
              <MenuItem key={source} value={source}>
                {LABELS[source]}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" fullWidth label="Name" value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} />
          {identity.source === "cricheroes" && (
            <TextField size="small" fullWidth label="Player ID" value={identity.externalId} onChange={(e) => setIdentity({ ...identity, externalId: e.target.value })} />
          )}
          <Button
            variant="outlined"
            disabled={action.busy || !identity.name.trim()}
            onClick={async () => {
              const ok = await action.run(() =>
                linkIdentity(member.id, identity.source, identity.externalId.trim() || null, identity.name.trim())
              );
              if (ok) {
                setIdentity({ ...identity, name: "", externalId: "" });
                reload();
              }
            }}
          >
            Link
          </Button>
        </Stack>
      </Section>

      <Section title="Merge a duplicate">
        <Typography variant="body2" color="text.secondary">
          If someone else on the list is the same person, move their history here. This can&apos;t be undone from the app.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField select size="small" fullWidth label="Duplicate of this player" value={mergeId} onChange={(e) => setMergeId(e.target.value)}>
            {others.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.display_name}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" disabled={!mergeId} onClick={() => setConfirmMerge(true)}>
            Merge
          </Button>
        </Stack>
      </Section>

      <Dialog open={confirmLeave} onClose={() => setConfirmLeave(false)}>
        <DialogTitle>Mark {member.display_name} as left?</DialogTitle>
        <DialogContent>
          <DialogContentText>They won&apos;t be picked from today. Their history stays, and you can bring them back.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmLeave(false)}>Cancel</Button>
          <Button
            color="error"
            disabled={action.busy}
            onClick={async () => {
              setConfirmLeave(false);
              if (await action.run(() => leaveTeam(member.id))) afterChange();
            }}
          >
            Mark as left
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmMerge} onClose={() => setConfirmMerge(false)}>
        <DialogTitle>Merge {mergeTarget?.display_name} into {member.display_name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {mergeTarget?.display_name}&apos;s names, stats and payments move to {member.display_name}, and {mergeTarget?.display_name}{" "}
            disappears from the list.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmMerge(false)}>Cancel</Button>
          <Button
            color="error"
            disabled={action.busy}
            onClick={async () => {
              setConfirmMerge(false);
              if (await action.run(() => mergeMembers(member.id, mergeId))) {
                setMergeId("");
                router.refresh();
                afterChange();
              }
            }}
          >
            Merge
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
