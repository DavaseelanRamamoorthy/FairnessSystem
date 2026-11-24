"use client";

import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useParams } from "next/navigation";
import { useCallback } from "react";
import { loadPlayerStats } from "@/src/db/fixtures";
import { ELIGIBILITY_LABEL } from "@/src/engine/eligibility";
import { LABELS } from "@/src/membership/form";
import { BalanceCell } from "@/src/ui/Balances";
import { formatMatchDate, oversText } from "@/src/ui/fixtureLabels";
import { ErrorNote, Loading, NoAccess, Page, Section, useLoad } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";
import { useSeasonFairness } from "@/src/ui/useSeasonFairness";

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <Stack sx={{ minWidth: 80 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700 }}>{value ?? "–"}</Typography>
    </Stack>
  );
}

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const { season, seasonMember } = useSession();
  const seasonId = season?.id ?? "";
  const fairness = useSeasonFairness();
  const load = useCallback(() => loadPlayerStats(seasonId), [seasonId]);
  const stats = useLoad(load);

  if (!season || !seasonMember || seasonMember.status === "left") return <NoAccess />;
  if (fairness.loading || stats.loading) return <Loading />;
  const error = fairness.error ?? stats.error;
  if (error) return <ErrorNote message={error} />;
  const member = fairness.data?.members.get(id);
  if (!member) return <Alert severity="warning">This player doesn&apos;t exist.</Alert>;

  const entry = fairness.data?.ledger.get(id);
  const s = stats.data?.find((row) => row.member_id === id);
  const history = [...(entry?.history ?? [])].reverse();
  const slotOf = new Map((fairness.data?.rows ?? []).map((r) => [r.fixture_id, r.slot] as const));
  const ballsOf = new Map(
    (fairness.data?.rows ?? []).filter((r) => r.member_id === id).map((r) => [r.fixture_id, r.balls_bowled] as const)
  );

  return (
    <Page title={member.display_name} subtitle={member.primary_roles.map((r) => LABELS[r]).join(", ") || undefined}>
      <Section title={`${season.year} fairness`}>
        <Stack direction="row" spacing={2} sx={{ "& > *": { flex: 1 } }}>
          <BalanceCell label="Games" account={entry?.xi} unit="games" />
          <BalanceCell label="Batting" account={entry?.bat} unit="pts" />
          <BalanceCell label="Bowling" account={entry?.bowl} unit="overs" />
        </Stack>
      </Section>
      <Section title={`${season.year} stats`}>
        {!s ? (
          <Typography color="text.secondary">No matches recorded yet.</Typography>
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Stat label="Matches" value={s.matches} />
              <Stat label="Runs" value={s.runs} />
              <Stat label="Average" value={s.batting_average} />
              <Stat label="Strike rate" value={s.strike_rate} />
              <Stat label="Best" value={s.high_score} />
            </Stack>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Stat label="Overs" value={oversText(s.balls_bowled)} />
              <Stat label="Wickets" value={s.wickets} />
              <Stat label="Economy" value={s.economy} />
              <Stat label="Bowling avg" value={s.bowling_average} />
            </Stack>
          </Stack>
        )}
      </Section>
      <Section title="Match by match">
        {history.length === 0 ? (
          <Typography color="text.secondary">Nothing yet this season.</Typography>
        ) : (
          <TableContainer>
            <Table size="small" aria-label="Fairness history">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Bat</TableCell>
                  <TableCell align="right">Overs</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.fixtureId}>
                    <TableCell>
                      {formatMatchDate(h.matchDate)}
                      {(slotOf.get(h.fixtureId) ?? 1) > 1 ? ` · match ${slotOf.get(h.fixtureId)}` : ""}
                    </TableCell>
                    <TableCell>{h.played ? "Played" : ELIGIBILITY_LABEL[h.eligibility]}</TableCell>
                    <TableCell align="right">{h.bat.position ?? "–"}</TableCell>
                    <TableCell align="right">{ballsOf.get(h.fixtureId) ? oversText(ballsOf.get(h.fixtureId)!) : "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Section>
    </Page>
  );
}
