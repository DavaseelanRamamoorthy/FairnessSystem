"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useState } from "react";
import { loadMyDues, submitPaymentReference, type Due } from "@/src/db/membership";
import { ErrorNote, money, Section, useAction, useLoad } from "./kit";

function DueRow({ due, onSaved }: { due: Due; onSaved: () => void }) {
  const [reference, setReference] = useState(due.payer_reference ?? "");
  const { busy, error, run } = useAction();
  const unpaid = due.outstanding > 0;

  return (
    <Stack spacing={1}>
      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
        <Typography>{due.description}</Typography>
        <Typography color={unpaid ? "warning.main" : "success.main"}>
          {unpaid ? `${money(due.outstanding, due.currency)} due` : "Paid"}
        </Typography>
      </Stack>
      {unpaid && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            size="small"
            fullWidth
            label="Payment reference"
            helperText="After paying, enter the PayPal or bank reference, or the word Cash."
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
          <Button
            variant="outlined"
            disabled={busy || reference === (due.payer_reference ?? "")}
            sx={{ alignSelf: "flex-start", flexShrink: 0 }}
            onClick={async () => {
              if (await run(() => submitPaymentReference(due.charge_id, reference))) onSaved();
            }}
          >
            Save
          </Button>
        </Stack>
      )}
      <ErrorNote message={error} />
    </Stack>
  );
}

export function MyDues({ seasonId, memberId }: { seasonId: string; memberId: string }) {
  const load = useCallback(() => loadMyDues(seasonId, memberId), [seasonId, memberId]);
  const { data, error, reload } = useLoad(load);
  const [saved, setSaved] = useState(false);

  if (error) return <ErrorNote message={error} />;
  if (!data || data.length === 0) return null;
  return (
    <Section title="My dues">
      {data.map((due) => (
        <DueRow
          key={due.charge_id}
          due={due}
          onSaved={() => {
            setSaved(true);
            reload();
          }}
        />
      ))}
      {saved && <Alert severity="success">Saved. The treasurer will confirm your payment.</Alert>}
    </Section>
  );
}
