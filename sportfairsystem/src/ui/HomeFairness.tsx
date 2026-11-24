"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useCallback } from "react";
import { loadFixtures } from "@/src/db/fixtures";
import { classify, ELIGIBILITY_LABEL } from "@/src/engine/eligibility";
import { rowToFact } from "@/src/fairness/facts";
import { BalanceCell } from "./Balances";
import { formatDeadline, formatMatchDate, SLOT_SENTENCE } from "./fixtureLabels";
import { ErrorNote, Section, useLoad } from "./kit";
import { useSeasonFairness } from "./useSeasonFairness";

/** Next fixture with my status, and my three balances. */
export function HomeFairness({ seasonId, memberId }: { seasonId: string; memberId: string }) {
  const fairness = useSeasonFairness();
  const load = useCallback(() => loadFixtures(seasonId), [seasonId]);
  const fixtures = useLoad(load);

  const today = new Date().toISOString().slice(0, 10);
  const next = fixtures.data?.find((f) => f.status !== "played" && f.match_date >= today);
  const myRow = next ? fairness.data?.rows.find((r) => r.fixture_id === next.id && r.member_id === memberId) : undefined;
  const entry = fairness.data?.ledger.get(memberId);

  let myStatus = "Mark your availability in Spond before the deadline.";
  if (myRow?.selected_slot) myStatus = `You're ${SLOT_SENTENCE[myRow.selected_slot]}${myRow.planned_bat_pos ? `, batting at ${myRow.planned_bat_pos}` : ""}.`;
  else if (myRow?.answer) myStatus = ELIGIBILITY_LABEL[classify(rowToFact(myRow))];

  return (
    <>
      <ErrorNote message={fairness.error ?? fixtures.error} />
      <Section title="Next match">
        {!fixtures.data ? null : next ? (
          <Stack spacing={1}>
            <Typography sx={{ fontWeight: 700 }}>
              {formatMatchDate(next.match_date)} · vs {next.opponent}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {next.competition.name} · Spond deadline {formatDeadline(next.availability_deadline)}
            </Typography>
            <Typography>{myStatus}</Typography>
            <Button component={NextLink} href={`/fixtures/${next.id}`} sx={{ alignSelf: "flex-start" }}>
              Open fixture
            </Button>
          </Stack>
        ) : (
          <Typography color="text.secondary">No upcoming fixtures yet.</Typography>
        )}
      </Section>
      {fairness.data && (
        <Section title="My fair chances" action={<Button component={NextLink} href="/fairness">See everyone</Button>}>
          <Stack direction="row" spacing={2} sx={{ "& > *": { flex: 1 } }}>
            <BalanceCell label="Games" account={entry?.xi} unit="games" />
            <BalanceCell label="Batting" account={entry?.bat} unit="pts" />
            <BalanceCell label="Bowling" account={entry?.bowl} unit="overs" />
          </Stack>
        </Section>
      )}
    </>
  );
}
