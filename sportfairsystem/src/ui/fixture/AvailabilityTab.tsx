"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import { importAvailability, setAvailability, type Fixture } from "@/src/db/fixtures";
import { linkIdentity, type Identity as IdentityRow } from "@/src/db/membership";
import { classify, ELIGIBILITY_LABEL } from "@/src/engine/eligibility";
import type { Eligibility } from "@/src/engine/types";
import { rowToFact } from "@/src/fairness/facts";
import { allDecided, prepareNames, spondEntries, spondNames, spondNewIdentities, type NameRow } from "@/src/fairness/imports";
import { spondSnapshotSchema, type SpondSnapshot } from "@/src/import/spondSchema";
import { ErrorNote, Section, useAction } from "../kit";
import { FileOrPaste, parseJson } from "../FileOrPaste";
import { ResolveNames } from "../ResolveNames";
import type { SeasonFairness } from "../useSeasonFairness";

const ORDER: Eligibility[] = ["on_time", "late", "unpaid", "unavailable", "not_available", "not_member"];
const COLOR: Record<Eligibility, "success" | "info" | "warning" | "default" | "error"> = {
  on_time: "success",
  late: "info",
  unpaid: "warning",
  unavailable: "default",
  not_available: "default",
  not_member: "default"
};

export function toIdentityRefs(identities: IdentityRow[]) {
  return identities.map((i) => ({ memberId: i.member_id, source: i.source, externalId: i.external_id, nameKey: i.name_key }));
}

function SpondImport({
  fixture,
  fairness,
  identities,
  onDone
}: {
  fixture: Fixture;
  fairness: SeasonFairness;
  identities: IdentityRow[];
  onDone: () => void;
}) {
  const [snapshot, setSnapshot] = useState<SpondSnapshot | null>(null);
  const [rows, setRows] = useState<NameRow[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const { busy, error, run } = useAction();
  const refs = useMemo(
    () => [...fairness.members.values()].map((m) => ({ id: m.id, displayName: m.display_name })).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [fairness.members]
  );

  const read = (text: string) => {
    const parsed = parseJson(text, spondSnapshotSchema);
    if (!parsed.ok) {
      setProblems(parsed.problems);
      setSnapshot(null);
      return;
    }
    setProblems([]);
    setSnapshot(parsed.data);
    setRows(prepareNames(spondNames(parsed.data), "spond", toIdentityRefs(identities), refs));
  };

  const confirm = async () => {
    if (!snapshot) return;
    const ok = await run(async () => {
      for (const identity of spondNewIdentities(rows)) {
        await linkIdentity(identity.member_id, "spond", null, identity.display_name);
      }
      await importAvailability(fixture.id, spondEntries(snapshot, rows), snapshot);
    });
    if (ok) {
      setSnapshot(null);
      onDone();
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {fixture.status === "open"
          ? "The first import is the deadline snapshot: everyone who said yes counts as on time."
          : "The deadline snapshot is already taken. New yes answers imported now count as late."}
      </Typography>
      {!snapshot && <FileOrPaste label="Upload Spond snapshot" onText={read} />}
      {problems.length > 0 && (
        <Alert severity="error">
          This file can&apos;t be used:
          <ul style={{ margin: 0 }}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      )}
      {snapshot && (
        <>
          <Typography>
            <strong>{snapshot.event_title}</strong> · {snapshot.responses.filter((r) => r.answer === "yes").length} said yes
          </Typography>
          {snapshot.event_date !== fixture.match_date && (
            <Alert severity="warning">
              This Spond event is for {snapshot.event_date}, but the fixture is on {fixture.match_date}. Check it&apos;s the right event.
            </Alert>
          )}
          <ResolveNames rows={rows} onChange={setRows} members={refs} allowSkip />
          <ErrorNote message={error} />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={busy || !allDecided(rows)} onClick={confirm}>
              Import availability
            </Button>
            <Button disabled={busy} onClick={() => setSnapshot(null)}>
              Cancel
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
}

function ManualAnswer({ fixture, fairness, onDone }: { fixture: Fixture; fairness: SeasonFairness; onDone: () => void }) {
  const [memberId, setMemberId] = useState("");
  const [answer, setAnswer] = useState<"yes" | "no" | "maybe">("yes");
  const { busy, error, run } = useAction();
  const squad = fairness.squad
    .filter((row) => row.status !== "left")
    .map((row) => fairness.members.get(row.member_id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField select fullWidth size="small" label="Player" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          {squad.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.display_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Answer" sx={{ minWidth: 130 }} value={answer} onChange={(e) => setAnswer(e.target.value as typeof answer)}>
          <MenuItem value="yes">Available</MenuItem>
          <MenuItem value="no">Not available</MenuItem>
          <MenuItem value="maybe">Maybe</MenuItem>
        </TextField>
        <Button
          variant="outlined"
          disabled={busy || !memberId}
          onClick={async () => {
            if (await run(() => setAvailability(fixture.id, memberId, answer))) {
              setMemberId("");
              onDone();
            }
          }}
        >
          Set
        </Button>
      </Stack>
      <ErrorNote message={error} />
    </Stack>
  );
}

export function AvailabilityTab({
  fixture,
  fairness,
  identities,
  canManage,
  onChanged
}: {
  fixture: Fixture;
  fairness: SeasonFairness;
  identities: IdentityRow[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const people = fairness.rows
    .filter((row) => row.fixture_id === fixture.id && row.answer !== null)
    .map((row) => ({ row, eligibility: classify(rowToFact(row)), name: fairness.members.get(row.member_id)?.display_name ?? "Unknown" }))
    .sort((a, b) => ORDER.indexOf(a.eligibility) - ORDER.indexOf(b.eligibility) || a.name.localeCompare(b.name));
  const counts = ORDER.map((e) => [e, people.filter((p) => p.eligibility === e).length] as const).filter(([, n]) => n > 0);
  const editable = fixture.status !== "played";

  return (
    <Stack spacing={3}>
      <Section title="Who's available">
        {people.length === 0 ? (
          <Typography color="text.secondary">No answers imported yet.</Typography>
        ) : (
          <>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              {counts.map(([e, n]) => (
                <Chip key={e} size="small" color={COLOR[e]} label={`${ELIGIBILITY_LABEL[e]}: ${n}`} />
              ))}
            </Stack>
            <Stack spacing={0.5}>
              {people.map(({ row, eligibility, name }) => (
                <Stack key={row.member_id} direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                  <Typography>{name}</Typography>
                  <Chip size="small" variant="outlined" color={COLOR[eligibility]} label={ELIGIBILITY_LABEL[eligibility]} />
                </Stack>
              ))}
            </Stack>
          </>
        )}
      </Section>
      {canManage && editable && (
        <>
          <Section title="Import from Spond">
            <SpondImport fixture={fixture} fairness={fairness} identities={identities} onDone={onChanged} />
          </Section>
          <Section title="Change one answer">
            <ManualAnswer fixture={fixture} fairness={fairness} onDone={onChanged} />
          </Section>
        </>
      )}
    </Stack>
  );
}
