"use client";

import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { addMember, loadMembers, loadSeasonMembers } from "@/src/db/membership";
import { identitiesFromAnswers, LABELS } from "@/src/membership/form";
import { ErrorNote, Loading, Page, Section, useAction, useLoad } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";

export default function MembersPage() {
  const { team, season } = useSession();
  const router = useRouter();
  const teamId = team?.id ?? "";
  const seasonId = season?.id ?? "";
  const load = useCallback(async () => {
    const [members, rows] = await Promise.all([loadMembers(teamId), loadSeasonMembers(seasonId)]);
    return { members, rows };
  }, [teamId, seasonId]);
  const { data, error, loading } = useLoad(load);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", spond: "", cricheroes: "" });
  const add = useAction();

  const rows = useMemo(() => {
    const bySeason = new Map(data?.rows.map((row) => [row.member_id, row]));
    const needle = search.trim().toLowerCase();
    return (data?.members ?? [])
      .filter((member) => member.display_name.toLowerCase().includes(needle))
      .map((member) => ({ member, row: bySeason.get(member.id) ?? null }));
  }, [data, search]);

  const submit = async () => {
    let id = "";
    const ok = await add.run(async () => {
      id = await addMember(
        teamId,
        form.name.trim(),
        identitiesFromAnswers({ spond_name: form.spond, cricheroes_name: form.cricheroes })
      );
    });
    if (ok) router.push(`/admin/members/${id}`);
  };

  return (
    <Page title="Members">
      <ErrorNote message={error} />
      <Section>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField fullWidth size="small" label="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="contained" sx={{ flexShrink: 0 }} onClick={() => setAdding(true)}>
            Add member
          </Button>
        </Stack>
        {loading && <Loading />}
        <List disablePadding>
          {rows.map(({ member, row }) => (
            <ListItemButton key={member.id} component={NextLink} href={`/admin/members/${member.id}`} divider>
              <ListItemText
                primary={member.display_name}
                secondary={[row ? LABELS[row.role] : null, ...(row?.responsibilities.map((r) => LABELS[r]) ?? []), member.user_id ? null : "No account yet"]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <Chip
                size="small"
                label={row ? LABELS[row.status] : "Not in this season"}
                color={row?.status === "active" ? "success" : row?.status === "pending_payment" ? "warning" : "default"}
              />
            </ListItemButton>
          ))}
        </List>
      </Section>

      <Dialog open={adding} onClose={() => setAdding(false)} fullWidth>
        <DialogTitle>Add a member</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <ErrorNote message={add.error} />
            <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField label="Name in Spond" value={form.spond} onChange={(e) => setForm({ ...form, spond: e.target.value })} />
            <TextField label="Name in CricHeroes" value={form.cricheroes} onChange={(e) => setForm({ ...form, cricheroes: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdding(false)}>Cancel</Button>
          <Button variant="contained" disabled={add.busy || form.name.trim().length < 2} onClick={submit}>
            Add member
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
