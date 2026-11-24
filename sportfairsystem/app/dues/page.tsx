"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useState } from "react";
import { loadDues, loadMembers, recordPayment, type Due, type Member } from "@/src/db/membership";
import { ErrorNote, Loading, money, NoAccess, Page, Section, useAction, useLoad } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";

const METHODS = [
  ["paypal", "PayPal"],
  ["bank", "Bank transfer"],
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["other", "Other"]
] as const;

function PaymentDialog({ due, name, members, onClose, onSaved }: { due: Due; name: string; members: Member[]; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    amount: String(due.outstanding),
    currency: due.currency,
    amountEur: String(due.outstanding),
    method: "paypal",
    reference: due.payer_reference ?? "",
    paidOn: today,
    receivedBy: ""
  });
  const { busy, error, run } = useAction();
  const foreign = form.currency.trim().toUpperCase() !== "EUR";
  const amount = Number(form.amount);
  const amountEur = foreign ? Number(form.amountEur) : amount;
  const valid = amount > 0 && amountEur > 0 && form.currency.trim().length === 3;

  const save = async () => {
    const ok = await run(() =>
      recordPayment({
        chargeId: due.charge_id,
        amount,
        currency: form.currency.trim().toUpperCase(),
        amountEur,
        method: form.method,
        reference: form.reference.trim(),
        paidOn: form.paidOn,
        receivedBy: form.receivedBy || null
      })
    );
    if (ok) onSaved();
  };

  return (
    <Dialog open onClose={onClose} fullWidth>
      <DialogTitle>
        Record payment: {name}, {due.description}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <ErrorNote message={error} />
          <Stack direction="row" spacing={2}>
            <TextField fullWidth label="Amount" type="number" slotProps={{ htmlInput: { min: 0, step: "0.01" } }} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <TextField label="Currency" sx={{ width: 110 }} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </Stack>
          {foreign && (
            <TextField
              label="Value in EUR"
              type="number"
              helperText="The club's books are kept in euros."
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
              value={form.amountEur}
              onChange={(e) => setForm({ ...form, amountEur: e.target.value })}
            />
          )}
          <TextField select label="Method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            {METHODS.map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          <TextField label="Paid on" type="date" slotProps={{ inputLabel: { shrink: true } }} value={form.paidOn} onChange={(e) => setForm({ ...form, paidOn: e.target.value })} />
          <TextField select label="Who received it" slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} value={form.receivedBy} onChange={(e) => setForm({ ...form, receivedBy: e.target.value })}>
            <MenuItem value="">Club account</MenuItem>
            {members.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.display_name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || !valid} onClick={save}>
          Record payment
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DuesPage() {
  const session = useSession();
  const seasonId = session.season?.id ?? "";
  const teamId = session.team?.id ?? "";
  const load = useCallback(async () => {
    const [dues, members] = await Promise.all([loadDues(seasonId), loadMembers(teamId)]);
    return { dues, members };
  }, [seasonId, teamId]);
  const { data, error, loading, reload } = useLoad(load);
  const [showPaid, setShowPaid] = useState(false);
  const [paying, setPaying] = useState<Due | null>(null);

  const names = useMemo(() => new Map(data?.members.map((m) => [m.id, m.display_name])), [data]);
  const nameOf = useCallback((id: string) => names.get(id) ?? "Unknown", [names]);
  const rows = useMemo(
    () =>
      (data?.dues ?? [])
        .filter((due) => showPaid || due.outstanding > 0)
        .sort((a, b) => nameOf(a.member_id).localeCompare(nameOf(b.member_id))),
    [data, showPaid, nameOf]
  );
  const outstanding = (data?.dues ?? []).reduce((sum, due) => sum + Math.max(0, due.outstanding), 0);

  if (!session.canManageMoney) return <NoAccess />;

  return (
    <Page title="Dues" subtitle={data ? `${money(outstanding)} outstanding` : undefined}>
      <ErrorNote message={error} />
      <Section>
        <FormControlLabel label="Show paid" control={<Switch checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} />} />
        {loading && <Loading />}
        {data && rows.length === 0 && <Alert severity="success">Nothing outstanding.</Alert>}
        <List disablePadding>
          {rows.map((due) => (
            <ListItem
              key={due.charge_id}
              divider
              disableGutters
              secondaryAction={
                due.outstanding > 0 ? (
                  <Button size="small" variant="outlined" onClick={() => setPaying(due)}>
                    Record
                  </Button>
                ) : undefined
              }
            >
              <ListItemText
                sx={{ pr: 10 }}
                primary={nameOf(due.member_id)}
                secondary={
                  <>
                    {due.description}
                    {due.payer_reference ? ` · Reference: ${due.payer_reference}` : ""}
                  </>
                }
              />
              <Typography variant="body2" sx={{ whiteSpace: "nowrap", pr: due.outstanding > 0 ? 10 : 0 }}>
                {due.outstanding > 0 ? money(due.outstanding, due.currency) : "Paid"}
              </Typography>
            </ListItem>
          ))}
        </List>
      </Section>
      {paying && (
        <PaymentDialog
          due={paying}
          name={nameOf(paying.member_id)}
          members={data?.members ?? []}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            reload();
            session.refresh();
          }}
        />
      )}
    </Page>
  );
}
