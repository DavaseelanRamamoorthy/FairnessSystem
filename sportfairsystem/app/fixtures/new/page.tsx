"use client";

import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { createCompetition, createFixture, loadCompetitions, type CompetitionKind } from "@/src/db/fixtures";
import { resolveRules } from "@/src/engine/rules";
import { defaultDeadline, defaultWeight } from "@/src/fairness/facts";
import { ErrorNote, Loading, NoAccess, Page, Section, useAction, useLoad } from "@/src/ui/kit";
import { KIND_LABEL } from "@/src/ui/fixtureLabels";
import { useSession } from "@/src/ui/session";

const NEW = "__new__";

export default function NewFixturePage() {
  const { season, canManageMatches } = useSession();
  const router = useRouter();
  const seasonId = season?.id ?? "";
  const load = useCallback(() => loadCompetitions(seasonId), [seasonId]);
  const { data: competitions, error: loadError, loading } = useLoad(load);
  const rules = resolveRules(season?.rules);

  const [form, setForm] = useState({
    competitionId: "",
    newName: "",
    newKind: "friendly_series" as CompetitionKind,
    newWeight: "1",
    matchDate: "",
    slot: "1",
    opponent: "",
    ground: "",
    overs: "20",
    deadline: "",
    deadlineTouched: false
  });
  const { busy, error, run } = useAction();

  if (!canManageMatches || !season) return <NoAccess />;
  if (loading) return <Loading />;

  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const competitionId = form.competitionId || (competitions?.length ? competitions[0].id : NEW);
  const creatingCompetition = competitionId === NEW;
  const valid =
    form.matchDate && form.opponent.trim() && Number(form.overs) >= 1 && (!creatingCompetition || form.newName.trim().length >= 2);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    let fixtureId = "";
    const ok = await run(async () => {
      const compId = creatingCompetition
        ? (await createCompetition(season.id, form.newName, form.newKind, Number(form.newWeight))).id
        : competitionId;
      const created = await createFixture({
        competition_id: compId,
        match_date: form.matchDate,
        slot: Number(form.slot),
        opponent: form.opponent.trim(),
        ground: form.ground.trim() || null,
        overs: Number(form.overs),
        availability_deadline: form.deadline ? new Date(form.deadline).toISOString() : null
      });
      fixtureId = created.id;
    });
    if (ok) router.replace(`/fixtures/${fixtureId}`);
  };

  return (
    <Page title="New fixture">
      <ErrorNote message={loadError ?? error} />
      <Section>
        <Stack component="form" spacing={2} onSubmit={submit}>
          <TextField select label="Competition" value={competitionId} onChange={(e) => set({ competitionId: e.target.value })}>
            {competitions?.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name} ({KIND_LABEL[c.kind]}, counts {c.fairness_weight === 1 ? "fully" : `×${c.fairness_weight}`})
              </MenuItem>
            ))}
            <MenuItem value={NEW}>+ New competition</MenuItem>
          </TextField>

          {creatingCompetition && (
            <Stack spacing={2} sx={{ pl: { sm: 2 }, borderLeft: { sm: 2 }, borderColor: { sm: "divider" } }}>
              <TextField label="Competition name" placeholder={`Friendlies ${season.year}`} value={form.newName} onChange={(e) => set({ newName: e.target.value })} />
              <TextField
                select
                label="Type"
                value={form.newKind}
                onChange={(e) => {
                  const kind = e.target.value as CompetitionKind;
                  set({ newKind: kind, newWeight: String(defaultWeight(kind)) });
                }}
              >
                {(Object.keys(KIND_LABEL) as CompetitionKind[]).map((kind) => (
                  <MenuItem key={kind} value={kind}>
                    {KIND_LABEL[kind]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="How much these matches count for fairness"
                value={form.newWeight}
                onChange={(e) => set({ newWeight: e.target.value })}
                helperText="Tournaments count half by default, so the captain can pick a stronger side without a big fairness debt."
              >
                <MenuItem value="1">Fully</MenuItem>
                <MenuItem value="0.5">Half</MenuItem>
                <MenuItem value="0">Not at all (stats only)</MenuItem>
              </TextField>
            </Stack>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              label="Match date"
              type="date"
              required
              slotProps={{ inputLabel: { shrink: true } }}
              value={form.matchDate}
              onChange={(e) =>
                set({
                  matchDate: e.target.value,
                  deadline: form.deadlineTouched || !e.target.value ? form.deadline : defaultDeadline(e.target.value, rules.deadlineDaysBefore)
                })
              }
            />
            <TextField select label="Match on the day" sx={{ minWidth: 160 }} value={form.slot} onChange={(e) => set({ slot: e.target.value })}>
              {[1, 2, 3, 4].map((n) => (
                <MenuItem key={n} value={String(n)}>
                  Match {n}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField label="Opponent" required value={form.opponent} onChange={(e) => set({ opponent: e.target.value })} />
          <TextField label="Ground" value={form.ground} onChange={(e) => set({ ground: e.target.value })} />
          <TextField label="Overs per side" type="number" slotProps={{ htmlInput: { min: 1, max: 50 } }} value={form.overs} onChange={(e) => set({ overs: e.target.value })} />
          <TextField
            label="Spond deadline"
            type="datetime-local"
            slotProps={{ inputLabel: { shrink: true } }}
            value={form.deadline}
            onChange={(e) => set({ deadline: e.target.value, deadlineTouched: true })}
            helperText={`Defaults to ${rules.deadlineDaysBefore} days before, 20:00. Answers in Spond after this count as late.`}
          />
          <Typography variant="body2" color="text.secondary">
            Playing more than once on a day? Add each game as Match 1, 2 and so on. They&apos;re planned together, so whoever misses
            one gets priority in the next.
          </Typography>
          <Button type="submit" variant="contained" disabled={busy || !valid} sx={{ alignSelf: "flex-start" }}>
            Create fixture
          </Button>
        </Stack>
      </Section>
    </Page>
  );
}
