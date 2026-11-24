"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useState } from "react";
import { loadSelections, publishSelection, saveSelection, type Fixture, type SelectionRow } from "@/src/db/fixtures";
import { suggestDay } from "@/src/engine/planner";
import type { Suggestion } from "@/src/engine/types";
import { buildCandidates } from "@/src/fairness/candidates";
import { rowToFact } from "@/src/fairness/facts";
import { ErrorNote, Loading, Section, useAction, useLoad } from "../kit";
import { SLOT_LABEL, SLOT_SENTENCE } from "../fixtureLabels";
import type { SeasonFairness } from "../useSeasonFairness";

type Slot = "xi" | "twelfth" | "reserve" | "left_out";

type EditRow = {
  memberId: string;
  name: string;
  slot: Slot;
  batPos: string;
  overs: string;
  reason: string;
  suggested: { slot: Slot; batPos: number | null; overs: number | null } | null;
  note: string;
};

const SLOT_OPTIONS: Array<[Slot, string]> = [
  ["xi", "Playing XI"],
  ["twelfth", "12th player"],
  ["reserve", "Reserve"],
  ["left_out", "Not picked"]
];

/** Plans every unplayed match that day together, so a player who misses one gets priority in the next. */
function suggestFor(fixture: Fixture, fairness: SeasonFairness): Suggestion {
  const sameDay = [
    ...new Map(
      fairness.rows
        .filter((r) => r.match_date === fixture.match_date && r.status !== "played")
        .map((r) => [r.fixture_id, { id: r.fixture_id, slot: r.slot, overs: r.overs }] as const)
    ).values()
  ].sort((a, b) => a.slot - b.slot);
  if (!sameDay.some((f) => f.id === fixture.id)) sameDay.push({ id: fixture.id, slot: fixture.slot, overs: fixture.overs });
  const members = new Map([...fairness.members.values()].map((m) => [m.id, m]));
  const plans = suggestDay(
    sameDay.map((f) => ({
      overs: f.overs,
      candidates: buildCandidates(
        fairness.rows.filter((r) => r.fixture_id === f.id && r.answer !== null).map(rowToFact),
        fairness.ledger,
        members
      )
    })),
    fairness.rules
  );
  return plans[sameDay.findIndex((f) => f.id === fixture.id)];
}

function fromSuggestion(plan: Suggestion): EditRow[] {
  return plan.picks.map((p) => ({
    memberId: p.memberId,
    name: p.name,
    slot: p.slot,
    batPos: p.battingPosition ? String(p.battingPosition) : "",
    overs: p.plannedOvers !== null && p.slot === "xi" ? String(p.plannedOvers) : "",
    reason: p.reason,
    suggested: { slot: p.slot, batPos: p.battingPosition, overs: p.plannedOvers },
    note: ""
  }));
}

function fromSaved(saved: SelectionRow[], plan: Suggestion, names: Map<string, string>): EditRow[] {
  const suggested = new Map(plan.picks.map((p) => [p.memberId, p]));
  const rows: EditRow[] = saved.map((s) => {
    const p = suggested.get(s.member_id);
    return {
      memberId: s.member_id,
      name: names.get(s.member_id) ?? "Unknown",
      slot: s.slot,
      batPos: s.planned_bat_pos ? String(s.planned_bat_pos) : "",
      overs: s.planned_overs !== null ? String(s.planned_overs) : "",
      reason: s.reason ?? "",
      suggested: p ? { slot: p.slot, batPos: p.battingPosition, overs: p.plannedOvers } : null,
      note: s.override_note ?? ""
    };
  });
  for (const p of plan.picks) if (!saved.some((s) => s.member_id === p.memberId)) rows.push(...fromSuggestion({ picks: [p], warnings: [] }));
  return rows;
}

const isOverridden = (row: EditRow) =>
  !row.suggested ||
  row.suggested.slot !== row.slot ||
  (row.slot === "xi" && (String(row.suggested.batPos ?? "") !== row.batPos || String(row.suggested.overs ?? "") !== row.overs));

function problemsOf(rows: EditRow[], overs: number) {
  const problems: string[] = [];
  const xi = rows.filter((r) => r.slot === "xi");
  if (xi.length > 11) problems.push(`The XI has ${xi.length} players.`);
  const positions = xi.map((r) => r.batPos).filter(Boolean);
  if (new Set(positions).size !== positions.length) problems.push("Two players have the same batting position.");
  const planned = xi.reduce((sum, r) => sum + (Number(r.overs) || 0), 0);
  if (planned > overs) problems.push(`${planned} overs are planned, but the innings is ${overs} overs.`);
  if (rows.some((r) => isOverridden(r) && r.slot !== "left_out" && !r.note.trim() && r.suggested)) {
    problems.push("Add a short note for each change you made to the suggestion.");
  }
  return problems;
}

function CaptainView({ fixture, fairness, saved, onSaved }: { fixture: Fixture; fairness: SeasonFairness; saved: SelectionRow[]; onSaved: () => void }) {
  const plan = useMemo(() => suggestFor(fixture, fairness), [fixture, fairness]);
  const names = useMemo(() => new Map([...fairness.members.values()].map((m) => [m.id, m.display_name])), [fairness.members]);
  const [rows, setRows] = useState<EditRow[]>(() => (saved.length ? fromSaved(saved, plan, names) : fromSuggestion(plan)));
  const [message, setMessage] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const problems = problemsOf(rows, fixture.overs);
  const published = saved.some((s) => s.published_at);

  const update = (memberId: string, patch: Partial<EditRow>) => {
    setMessage(null);
    setRows((current) => current.map((r) => (r.memberId === memberId ? { ...r, ...patch } : r)));
  };

  const persist = async (publish: boolean) => {
    const picks = rows
      .filter((r) => r.slot !== "left_out")
      .map((r) => ({
        member_id: r.memberId,
        slot: r.slot as "xi" | "twelfth" | "reserve",
        planned_bat_pos: r.slot === "xi" && r.batPos ? Number(r.batPos) : null,
        planned_overs: r.slot === "xi" && r.overs ? Number(r.overs) : null,
        reason: r.reason,
        overridden: isOverridden(r),
        override_note: r.note.trim() || null
      }));
    const ok = await run(async () => {
      await saveSelection(fixture.id, picks);
      if (publish) await publishSelection(fixture.id);
    });
    if (ok) {
      setMessage(publish ? "Published. Players can now see the team." : "Draft saved. Players can't see it yet.");
      onSaved();
    }
  };

  if (plan.picks.length === 0) {
    return <Alert severity="info">Import availability first. The planner suggests a team from the players who said yes.</Alert>;
  }

  const order: Slot[] = ["xi", "twelfth", "reserve", "left_out"];
  const sorted = [...rows].sort(
    (a, b) => order.indexOf(a.slot) - order.indexOf(b.slot) || (Number(a.batPos) || 99) - (Number(b.batPos) || 99) || a.name.localeCompare(b.name)
  );
  const xiCount = rows.filter((r) => r.slot === "xi").length;
  const oversPlanned = rows.filter((r) => r.slot === "xi").reduce((s, r) => s + (Number(r.overs) || 0), 0);

  return (
    <Stack spacing={2}>
      {plan.warnings.map((w) => (
        <Alert key={w} severity="warning">
          {w}
        </Alert>
      ))}
      <Typography variant="body2" color="text.secondary">
        Suggested from everyone&apos;s fairness balance. XI {xiCount}/11 · {oversPlanned}/{fixture.overs} overs planned.
        {published ? " This team is published; saving again updates it." : ""}
      </Typography>
      {sorted.map((row) => {
        const changed = isOverridden(row) && row.suggested !== null;
        const locked = row.suggested?.slot === "left_out";
        return (
          <Stack key={row.memberId} spacing={1} sx={{ p: 1.5, border: 1, borderColor: changed ? "warning.main" : "divider", borderRadius: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography>
              {changed && <Chip size="small" color="warning" label="Changed" />}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {row.reason}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                select
                size="small"
                label="Slot"
                sx={{ minWidth: 150 }}
                value={row.slot}
                disabled={locked}
                onChange={(e) => update(row.memberId, { slot: e.target.value as Slot })}
              >
                {SLOT_OPTIONS.map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              {row.slot === "xi" && (
                <>
                  <TextField
                    size="small"
                    type="number"
                    label="Bats at"
                    sx={{ width: 110 }}
                    slotProps={{ htmlInput: { min: 1, max: 11 } }}
                    value={row.batPos}
                    onChange={(e) => update(row.memberId, { batPos: e.target.value })}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Overs"
                    sx={{ width: 110 }}
                    slotProps={{ htmlInput: { min: 0, max: fixture.overs } }}
                    value={row.overs}
                    onChange={(e) => update(row.memberId, { overs: e.target.value })}
                  />
                </>
              )}
              {changed && (
                <TextField
                  size="small"
                  fullWidth
                  label="Why the change?"
                  value={row.note}
                  onChange={(e) => update(row.memberId, { note: e.target.value })}
                />
              )}
            </Stack>
          </Stack>
        );
      })}
      {problems.map((p) => (
        <Alert key={p} severity="error">
          {p}
        </Alert>
      ))}
      <ErrorNote message={error} />
      {message && <Alert severity="success">{message}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button variant="contained" disabled={busy || problems.length > 0} onClick={() => persist(true)}>
          {published ? "Save and republish" : "Publish team"}
        </Button>
        <Button variant="outlined" disabled={busy || problems.length > 0} onClick={() => persist(false)}>
          Save draft
        </Button>
        <Button disabled={busy} onClick={() => setRows(fromSuggestion(plan))}>
          Start again from the suggestion
        </Button>
      </Stack>
    </Stack>
  );
}

function PublishedView({ saved, fairness, myMemberId }: { saved: SelectionRow[]; fairness: SeasonFairness; myMemberId: string | null }) {
  const name = (id: string) => fairness.members.get(id)?.display_name ?? "Unknown";
  const xi = saved.filter((s) => s.slot === "xi").sort((a, b) => (a.planned_bat_pos ?? 99) - (b.planned_bat_pos ?? 99));
  const others = saved.filter((s) => s.slot !== "xi");
  const mine = saved.find((s) => s.member_id === myMemberId);

  return (
    <Stack spacing={2}>
      {mine && (
        <Alert severity={mine.slot === "xi" ? "success" : "info"}>
          You&apos;re {SLOT_SENTENCE[mine.slot]}
          {mine.slot === "xi" && mine.planned_bat_pos ? `, batting at ${mine.planned_bat_pos}` : ""}
          {mine.slot === "xi" && mine.planned_overs ? `, ${mine.planned_overs} overs planned` : ""}. {mine.reason}
        </Alert>
      )}
      <Stack spacing={0.5}>
        {xi.map((s) => (
          <Stack key={s.member_id} direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
            <Typography sx={{ fontWeight: s.member_id === myMemberId ? 700 : 400 }}>
              {s.planned_bat_pos ?? "–"}. {name(s.member_id)}
            </Typography>
            <Typography color="text.secondary">{s.planned_overs ? `${s.planned_overs} ov` : ""}</Typography>
          </Stack>
        ))}
      </Stack>
      {others.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          {others.map((s) => `${name(s.member_id)} (${SLOT_LABEL[s.slot]})`).join(", ")}
        </Typography>
      )}
    </Stack>
  );
}

export function TeamTab({
  fixture,
  fairness,
  canManage,
  myMemberId,
  onChanged
}: {
  fixture: Fixture;
  fairness: SeasonFairness;
  canManage: boolean;
  myMemberId: string | null;
  onChanged: () => void;
}) {
  const load = useCallback(() => loadSelections(fixture.id), [fixture.id]);
  const { data: saved, error, loading, reload } = useLoad(load);

  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} />;
  const published = (saved ?? []).filter((s) => s.published_at);
  const editable = canManage && fixture.status !== "played";

  return (
    <Stack spacing={3}>
      {editable && (
        <Section title="Pick the team">
          <CaptainView
            key={fairness.rows.length}
            fixture={fixture}
            fairness={fairness}
            saved={saved ?? []}
            onSaved={() => {
              reload();
              onChanged();
            }}
          />
        </Section>
      )}
      <Section title={editable ? "What players see" : "Team"}>
        {published.length > 0 ? (
          <PublishedView saved={published} fairness={fairness} myMemberId={myMemberId} />
        ) : (
          <Typography color="text.secondary">The team hasn&apos;t been published yet.</Typography>
        )}
      </Section>
    </Stack>
  );
}
