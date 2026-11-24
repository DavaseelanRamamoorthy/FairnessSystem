"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useState } from "react";
import { importScorecard, loadScorecard, reopenFixture, type Fixture, type InningsRow } from "@/src/db/fixtures";
import type { Identity as IdentityRow } from "@/src/db/membership";
import { selectionDifferences } from "@/src/fairness/facts";
import { allDecided, prepareNames, scorecardNames, scorecardPayload, type NameRow } from "@/src/fairness/imports";
import { checkScorecard, scorecardSchema, type Scorecard } from "@/src/import/scorecardSchema";
import { ErrorNote, Loading, Section, useAction, useLoad } from "../kit";
import { FileOrPaste, parseJson } from "../FileOrPaste";
import { oversText } from "../fixtureLabels";
import { ResolveNames } from "../ResolveNames";
import type { SeasonFairness } from "../useSeasonFairness";
import { toIdentityRefs } from "./AvailabilityTab";

function InningsTable({ innings, nameOf }: { innings: InningsRow; nameOf: (memberId: string | null, raw: string) => string }) {
  return (
    <Stack spacing={1}>
      <Typography sx={{ fontWeight: 700 }}>
        {innings.team_name}: {innings.runs}/{innings.wickets} ({oversText(innings.balls)} ov)
      </Typography>
      <TableContainer>
        <Table size="small" aria-label={`${innings.team_name} batting`}>
          <TableHead>
            <TableRow>
              <TableCell>Batter</TableCell>
              <TableCell align="right">R</TableCell>
              <TableCell align="right">B</TableCell>
              <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Out</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {innings.batting.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  {b.position}. {nameOf(b.member_id, b.name_raw)}
                </TableCell>
                <TableCell align="right">{b.did_bat ? `${b.runs}${b.not_out ? "*" : ""}` : "–"}</TableCell>
                <TableCell align="right">{b.did_bat ? b.balls : ""}</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{b.did_bat ? (b.not_out ? "not out" : b.how_out) : "did not bat"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {innings.bowling.length > 0 && (
        <TableContainer>
          <Table size="small" aria-label={`Bowling against ${innings.team_name}`}>
            <TableHead>
              <TableRow>
                <TableCell>Bowler</TableCell>
                <TableCell align="right">O</TableCell>
                <TableCell align="right">R</TableCell>
                <TableCell align="right">W</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {innings.bowling.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{nameOf(b.member_id, b.name_raw)}</TableCell>
                  <TableCell align="right">{oversText(b.balls)}</TableCell>
                  <TableCell align="right">{b.runs}</TableCell>
                  <TableCell align="right">{b.wickets}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Typography variant="body2" color="text.secondary">
        Extras {innings.extras}
      </Typography>
    </Stack>
  );
}

function ImportScorecard({
  fixture,
  fairness,
  identities,
  teamName,
  onDone
}: {
  fixture: Fixture;
  fairness: SeasonFairness;
  identities: IdentityRow[];
  teamName: string;
  onDone: () => void;
}) {
  const [card, setCard] = useState<Scorecard | null>(null);
  const [rows, setRows] = useState<NameRow[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [acceptWarnings, setAcceptWarnings] = useState(false);
  const { busy, error, setError, run } = useAction();
  const refs = useMemo(
    () => [...fairness.members.values()].map((m) => ({ id: m.id, displayName: m.display_name })).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [fairness.members]
  );
  const checks = card ? checkScorecard(card) : [];

  const accept = (next: Scorecard) => {
    setProblems([]);
    setAcceptWarnings(false);
    setCard(next);
    setRows(prepareNames(scorecardNames(next), next.source === "cricheroes" ? "cricheroes" : "pdf", toIdentityRefs(identities), refs));
  };

  const readJson = (text: string) => {
    const parsed = parseJson(text, scorecardSchema);
    if (parsed.ok) accept(parsed.data);
    else {
      setCard(null);
      setProblems(parsed.problems);
    }
  };

  const readPdf = async (base64: string) => {
    setError(null);
    try {
      const { scorecardFromPdf } = await import("@/src/import/pdfAdapter");
      accept(await scorecardFromPdf(base64, teamName, fixture.overs));
    } catch (reason) {
      setCard(null);
      setProblems([`The PDF couldn't be read: ${reason instanceof Error ? reason.message : "unknown error"}`]);
    }
  };

  const confirm = async () => {
    if (!card) return;
    const ok = await run(() => importScorecard(fixture.id, scorecardPayload(card, rows), card.source));
    if (ok) onDone();
  };

  return (
    <Stack spacing={2}>
      {!card && (
        <>
          <Typography variant="body2" color="text.secondary">
            Upload the JSON file Claude made from CricHeroes, or the scorecard PDF.
          </Typography>
          <FileOrPaste label="Upload scorecard" acceptPdf onText={readJson} onPdf={readPdf} />
        </>
      )}
      {problems.length > 0 && (
        <Alert severity="error">
          This scorecard can&apos;t be used:
          <ul style={{ margin: 0 }}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      )}
      {card && (
        <>
          <Typography>
            <strong>
              {card.our_team} vs {card.opponent}
            </strong>{" "}
            · {card.match_date} · {card.innings.map((i) => `${i.team_name} ${i.runs}/${i.wickets}`).join(", ")}
          </Typography>
          {card.match_date !== fixture.match_date && (
            <Alert severity="warning">
              This scorecard is dated {card.match_date}, but the fixture is on {fixture.match_date}.
            </Alert>
          )}
          {checks.length > 0 && (
            <Alert severity="warning">
              The numbers don&apos;t add up:
              <ul style={{ margin: 0 }}>
                {checks.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <FormControlLabel
                label="Import anyway (the totals on CricHeroes are wrong)"
                control={<Checkbox checked={acceptWarnings} onChange={(e) => setAcceptWarnings(e.target.checked)} />}
              />
            </Alert>
          )}
          <ResolveNames rows={rows} onChange={setRows} members={refs} allowGuest />
          <ErrorNote message={error} />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={busy || !allDecided(rows) || (checks.length > 0 && !acceptWarnings)} onClick={confirm}>
              Import scorecard
            </Button>
            <Button disabled={busy} onClick={() => setCard(null)}>
              Cancel
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
}

function Reopen({ fixture, onDone }: { fixture: Fixture; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { busy, error, run } = useAction();
  return (
    <>
      <Button color="warning" sx={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
        Re-open to fix the scorecard
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth>
        <DialogTitle>Re-open this fixture?</DialogTitle>
        <DialogContent>
          <DialogContentText>You can then import a corrected scorecard. Balances update when you do.</DialogContentText>
          <TextField fullWidth margin="dense" label="What was wrong?" value={reason} onChange={(e) => setReason(e.target.value)} />
          <ErrorNote message={error} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            color="warning"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              if (await run(() => reopenFixture(fixture.id, reason))) {
                setOpen(false);
                onDone();
              }
            }}
          >
            Re-open
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function ScorecardTab({
  fixture,
  fairness,
  identities,
  canManage,
  teamName,
  onChanged
}: {
  fixture: Fixture;
  fairness: SeasonFairness;
  identities: IdentityRow[];
  canManage: boolean;
  teamName: string;
  onChanged: () => void;
}) {
  const load = useCallback(() => loadScorecard(fixture.id), [fixture.id]);
  const { data: innings, error, loading, reload } = useLoad(load);
  const nameOf = (memberId: string | null, raw: string) => (memberId ? (fairness.members.get(memberId)?.display_name ?? raw) : raw);
  const diff = selectionDifferences(fairness.rows.filter((r) => r.fixture_id === fixture.id));

  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} />;

  if (fixture.status === "played") {
    return (
      <Stack spacing={3}>
        {fixture.result_summary && <Alert severity="info">{fixture.result_summary}</Alert>}
        {canManage && (diff.pickedButDidNotPlay.length > 0 || diff.playedFromOutsideXi.length > 0) && (
          <Alert severity="warning">
            Plan and scorecard differ.
            {diff.pickedButDidNotPlay.length > 0 && ` Picked but didn't play: ${diff.pickedButDidNotPlay.map((id) => nameOf(id, "")).join(", ")}.`}
            {diff.playedFromOutsideXi.length > 0 && ` Played but weren't in the XI: ${diff.playedFromOutsideXi.map((id) => nameOf(id, "")).join(", ")}.`}{" "}
            The balances always follow the scorecard.
          </Alert>
        )}
        {(innings ?? []).map((inn) => (
          <Section key={inn.id}>
            <InningsTable innings={inn} nameOf={nameOf} />
          </Section>
        ))}
        {canManage && <Reopen fixture={fixture} onDone={onChanged} />}
      </Stack>
    );
  }

  if (!canManage) return <Typography color="text.secondary">The scorecard appears here after the match.</Typography>;

  return (
    <Section title="Import the scorecard">
      <ImportScorecard
        fixture={fixture}
        fairness={fairness}
        identities={identities}
        teamName={teamName}
        onDone={() => {
          reload();
          onChanged();
        }}
      />
    </Section>
  );
}
