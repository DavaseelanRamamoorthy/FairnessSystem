"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useCallback, useMemo } from "react";
import { loadFixtures, loadSeasonFacts, type Fixture } from "@/src/db/fixtures";
import { ErrorNote, Loading, NoAccess, Page, Section, useLoad } from "@/src/ui/kit";
import { FIXTURE_STATUS, formatMatchDate, KIND_LABEL, SLOT_LABEL } from "@/src/ui/fixtureLabels";
import { useSession } from "@/src/ui/session";

function FixtureList({ fixtures, myStatus }: { fixtures: Fixture[]; myStatus: Map<string, string> }) {
  return (
    <List disablePadding>
      {fixtures.map((f) => {
        const status = FIXTURE_STATUS[f.status];
        return (
          <ListItemButton key={f.id} component={NextLink} href={`/fixtures/${f.id}`} divider sx={{ gap: 1 }}>
            <ListItemText
              primary={`${formatMatchDate(f.match_date)}${f.slot > 1 ? ` · match ${f.slot}` : ""} · vs ${f.opponent}`}
              secondary={[f.competition.name, KIND_LABEL[f.competition.kind], myStatus.get(f.id)].filter(Boolean).join(" · ")}
            />
            <Chip size="small" label={status.label} color={status.color} />
          </ListItemButton>
        );
      })}
    </List>
  );
}

export default function FixturesPage() {
  const { season, seasonMember, canManageMatches } = useSession();
  const seasonId = season?.id ?? "";
  const load = useCallback(async () => {
    const [fixtures, facts] = await Promise.all([loadFixtures(seasonId), loadSeasonFacts(seasonId)]);
    return { fixtures, facts };
  }, [seasonId]);
  const { data, error, loading } = useLoad(load);

  const memberId = seasonMember?.member_id;
  const myStatus = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.facts ?? []) {
      if (row.member_id !== memberId) continue;
      if (row.selected_slot) map.set(row.fixture_id, `You: ${SLOT_LABEL[row.selected_slot]}`);
      else if (row.answer === "yes") map.set(row.fixture_id, row.on_time ? "You: available" : "You: available (late)");
      else if (row.answer) map.set(row.fixture_id, "You: not available");
    }
    return map;
  }, [data, memberId]);

  if (!season || !seasonMember || seasonMember.status === "left") return <NoAccess />;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (data?.fixtures ?? []).filter((f) => f.status !== "played" && f.match_date >= today);
  const past = (data?.fixtures ?? []).filter((f) => !upcoming.includes(f)).reverse();

  return (
    <Page title="Fixtures" subtitle={`${season.year} season`}>
      <ErrorNote message={error} />
      {canManageMatches && (
        <Button component={NextLink} href="/fixtures/new" variant="contained" sx={{ alignSelf: "flex-start" }}>
          New fixture
        </Button>
      )}
      {loading && <Loading />}
      {data && (
        <>
          <Section title="Coming up">
            {upcoming.length === 0 ? <Typography color="text.secondary">No fixtures planned yet.</Typography> : <FixtureList fixtures={upcoming} myStatus={myStatus} />}
          </Section>
          <Section title="Played and past">
            {past.length === 0 ? (
              <Typography color="text.secondary">Nothing played yet this season.</Typography>
            ) : (
              <FixtureList fixtures={past} myStatus={myStatus} />
            )}
          </Section>
          {!canManageMatches && upcoming.length > 0 && (
            <Stack>
              <Alert severity="info">Mark your availability in Spond before the deadline. The team is published here.</Alert>
            </Stack>
          )}
        </>
      )}
    </Page>
  );
}
