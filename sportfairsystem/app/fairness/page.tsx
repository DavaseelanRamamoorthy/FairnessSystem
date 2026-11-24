"use client";

import Alert from "@mui/material/Alert";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useMemo, useState } from "react";
import { BalanceCell } from "@/src/ui/Balances";
import { StatCard, TileGrid } from "@/src/ui/brand";
import { ErrorNote, Loading, NoAccess, Page, Section } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";
import { useSeasonFairness } from "@/src/ui/useSeasonFairness";

type SortKey = "xi" | "bat" | "bowl" | "name";

export default function FairnessPage() {
  const { season, seasonMember } = useSession();
  const { data, error, loading } = useSeasonFairness();
  const [sort, setSort] = useState<SortKey>("xi");

  const rows = useMemo(() => {
    if (!data) return [];
    return data.squad
      .filter((s) => s.status !== "left" || data.ledger.has(s.member_id))
      .map((s) => ({ member: data.members.get(s.member_id), entry: data.ledger.get(s.member_id), left: s.status === "left" }))
      .filter((r): r is typeof r & { member: NonNullable<typeof r.member> } => Boolean(r.member))
      .sort((a, b) =>
        sort === "name"
          ? a.member.display_name.localeCompare(b.member.display_name)
          : (b.entry?.[sort].balance ?? 0) - (a.entry?.[sort].balance ?? 0) || a.member.display_name.localeCompare(b.member.display_name)
      );
  }, [data, sort]);

  if (!season || !seasonMember || seasonMember.status === "left") return <NoAccess />;
  const w = data?.rules.battingWeights;
  const played = new Set(data?.rows.filter((r) => r.status === "played").map((r) => r.fixture_id)).size;

  const active = rows.filter((r) => !r.left);
  const mostOwed = [...active].sort((a, b) => (b.entry?.xi.balance ?? 0) - (a.entry?.xi.balance ?? 0))[0];
  const ahead = active.filter((r) => (r.entry?.xi.balance ?? 0) < -0.05).length;

  return (
    <Page
      title="Fairness board"
      subtitle={`${season.year} season · ${played} match${played === 1 ? "" : "es"} played. Everyone sees the same balances for games, batting and bowling.`}
    >
      <ErrorNote message={error} />
      {loading && <Loading />}
      {data && (
        <>
          <TileGrid>
            <StatCard label="Matches counted" value={played} note="Friendlies count fully, tournaments half" />
            <StatCard label="Players tracked" value={active.length} note="In this season's squad" />
            <StatCard
              label="Most owed games"
              value={mostOwed && (mostOwed.entry?.xi.balance ?? 0) > 0.05 ? mostOwed.member.display_name : "Nobody"}
              note={mostOwed && (mostOwed.entry?.xi.balance ?? 0) > 0.05 ? `Owed ${mostOwed.entry?.xi.balance.toFixed(1)} games` : "Everyone is even"}
            />
            <StatCard label="Ahead of share" value={ahead} note="Players who've had more than their share of games" />
          </TileGrid>
          <Section title="How it's counted">
            <Typography variant="body2">
              Everyone who is paid up and says yes in Spond before the deadline is owed an equal share of the {data.rules.xiSize} places.
              Each match you play is a chance given. <strong>Owed</strong> means the team owes you chances; <strong>ahead</strong> means
              you&apos;ve had more than your share.
            </Typography>
            <Typography variant="body2">
              Batting counts where you bat (top {w?.top}, middle {w?.middle}, lower order {w?.lower}), within the band you asked for.
              Bowling counts overs shared among the bowlers. Tournament games count half, and late answers only fill gaps.
            </Typography>
          </Section>
          <Section
            title="Players"
            action={
              <TextField select size="small" label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} sx={{ minWidth: 150 }}>
                <MenuItem value="xi">Most owed games</MenuItem>
                <MenuItem value="bat">Most owed batting</MenuItem>
                <MenuItem value="bowl">Most owed bowling</MenuItem>
                <MenuItem value="name">Name</MenuItem>
              </TextField>
            }
          >
            {played === 0 && <Alert severity="info">Balances start once the first scorecard is imported.</Alert>}
            <List disablePadding>
              {rows.map(({ member, entry, left }) => (
                <ListItemButton
                  key={member.id}
                  component={NextLink}
                  href={`/players/${member.id}`}
                  divider
                  sx={{ display: "block", bgcolor: member.id === seasonMember.member_id ? "action.selected" : undefined }}
                >
                  <Stack direction="row" sx={{ justifyContent: "space-between", mb: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {member.display_name}
                      {left ? " (left)" : ""}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {entry?.matchesPlayed ?? 0} played · {entry?.matchesEligible ?? 0} available
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={2} sx={{ "& > *": { flex: 1 } }}>
                    <BalanceCell label="Games" account={entry?.xi} unit="games" />
                    <BalanceCell label="Batting" account={entry?.bat} unit="pts" />
                    <BalanceCell label="Bowling" account={entry?.bowl} unit="overs" />
                  </Stack>
                </ListItemButton>
              ))}
            </List>
          </Section>
        </>
      )}
    </Page>
  );
}
