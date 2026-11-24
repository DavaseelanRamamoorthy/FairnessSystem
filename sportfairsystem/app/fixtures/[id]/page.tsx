"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { deleteFixture, loadFixture } from "@/src/db/fixtures";
import { loadIdentities } from "@/src/db/membership";
import { AvailabilityTab } from "@/src/ui/fixture/AvailabilityTab";
import { ScorecardTab } from "@/src/ui/fixture/ScorecardTab";
import { TeamTab } from "@/src/ui/fixture/TeamTab";
import { FIXTURE_STATUS, formatDeadline, formatMatchDate, KIND_LABEL } from "@/src/ui/fixtureLabels";
import { ErrorNote, Loading, NoAccess, Page, useAction, useLoad } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";
import { useSeasonFairness } from "@/src/ui/useSeasonFairness";

export default function FixturePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const session = useSession();
  const teamId = session.team?.id ?? "";
  const canManage = session.canManageMatches;

  const loadOne = useCallback(async () => {
    const [fixture, identities] = await Promise.all([loadFixture(id), canManage ? loadIdentities(teamId) : Promise.resolve([])]);
    return { fixture, identities };
  }, [id, canManage, teamId]);
  const fixtureState = useLoad(loadOne);
  const fairness = useSeasonFairness();
  const [tab, setTab] = useState<"availability" | "team" | "scorecard" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useAction();

  const reloadAll = useCallback(() => {
    fixtureState.reload();
    fairness.reload();
  }, [fixtureState, fairness]);

  if (!session.seasonMember || session.seasonMember.status === "left") return <NoAccess />;
  if (fixtureState.loading || fairness.loading) return <Loading />;
  const error = fixtureState.error ?? fairness.error;
  if (error) return <ErrorNote message={error} />;
  const fixture = fixtureState.data?.fixture;
  if (!fixture || !fairness.data) return <Alert severity="warning">This fixture doesn&apos;t exist.</Alert>;

  const status = FIXTURE_STATUS[fixture.status];
  const current = tab ?? (fixture.status === "played" ? "scorecard" : fixture.status === "selected" ? "team" : "availability");
  const props = { fixture, fairness: fairness.data, onChanged: reloadAll };

  return (
    <Page
      title={`vs ${fixture.opponent}`}
      subtitle={`${formatMatchDate(fixture.match_date)}${fixture.slot > 1 ? ` · match ${fixture.slot}` : ""} · ${fixture.competition.name}`}
      actions={<Chip label={status.label} color={status.color === "default" ? undefined : status.color} sx={status.color === "default" ? { bgcolor: "rgba(255,255,255,.16)", color: "common.white" } : undefined} />}
    >
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Chip variant="outlined" label={KIND_LABEL[fixture.competition.kind]} />
        {fixture.competition.fairness_weight !== 1 && (
          <Chip variant="outlined" label={fixture.competition.fairness_weight === 0 ? "Stats only" : `Counts ×${fixture.competition.fairness_weight} for fairness`} />
        )}
        <Typography variant="body2" color="text.secondary">
          {fixture.overs} overs{fixture.ground ? ` · ${fixture.ground}` : ""} · Spond deadline {formatDeadline(fixture.availability_deadline)}
        </Typography>
      </Stack>

      <Tabs value={current} onChange={(_e, value) => setTab(value)} variant="scrollable" aria-label="Fixture sections">
        <Tab value="availability" label="Availability" />
        <Tab value="team" label="Team" />
        <Tab value="scorecard" label={fixture.status === "played" ? "Scorecard" : "Result"} />
      </Tabs>

      {current === "availability" && (
        <AvailabilityTab {...props} identities={fixtureState.data?.identities ?? []} canManage={canManage} />
      )}
      {current === "team" && <TeamTab {...props} canManage={canManage} myMemberId={session.seasonMember.member_id} />}
      {current === "scorecard" && (
        <ScorecardTab {...props} identities={fixtureState.data?.identities ?? []} canManage={canManage} teamName={session.team?.name ?? ""} />
      )}

      {canManage && fixture.status !== "played" && (
        <Button color="error" sx={{ alignSelf: "flex-start" }} onClick={() => setConfirmDelete(true)}>
          Delete fixture
        </Button>
      )}
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Delete this fixture?</DialogTitle>
        <DialogContent>
          <DialogContentText>Its availability and team are deleted too. This can&apos;t be undone.</DialogContentText>
          <ErrorNote message={remove.error} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            color="error"
            disabled={remove.busy}
            onClick={async () => {
              if (await remove.run(() => deleteFixture(fixture.id))) router.replace("/fixtures");
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
