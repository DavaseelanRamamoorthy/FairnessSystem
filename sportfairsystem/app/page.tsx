"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { LABELS } from "@/src/membership/form";
import { Page, Section } from "@/src/ui/kit";
import { MyDues } from "@/src/ui/MyDues";
import { useSession } from "@/src/ui/session";

export default function HomePage() {
  const { season, member, seasonMember, application, team } = useSession();

  if (seasonMember?.status === "left") {
    return (
      <Page title="You've left the team">
        <Alert severity="info">Your match history is kept. Ask your organiser if you&apos;d like to come back.</Alert>
      </Page>
    );
  }

  if (!season) {
    return (
      <Page title={`Welcome to ${team?.name ?? "the team"}`}>
        <Alert severity="info">Registration isn&apos;t open right now. Ask your organiser when it opens.</Alert>
      </Page>
    );
  }

  const inSquad = seasonMember && seasonMember.season_id === season.id;

  if (!inSquad) {
    if (application?.status === "applied") {
      return (
        <Page title="Application sent">
          <Alert severity="info">The organiser will review it soon. You&apos;ll see your dues here once it&apos;s approved.</Alert>
        </Page>
      );
    }
    return (
      <Page title={`Welcome to ${team?.name ?? "the team"}`}>
        {application?.status === "rejected" && (
          <Alert severity="warning">
            Your application wasn&apos;t approved{application.decision_note ? `: ${application.decision_note}` : "."}
          </Alert>
        )}
        <Section title={`${season.year} membership`}>
          <Typography>
            {season.registration_open
              ? member
                ? "Renew your membership to play this season."
                : "Fill in the membership form to join the squad."
              : "Registration isn't open right now."}
          </Typography>
          {season.registration_open && (
            <Button component={NextLink} href="/register" variant="contained" sx={{ alignSelf: "flex-start" }}>
              {member ? "Renew membership" : "Join the team"}
            </Button>
          )}
        </Section>
      </Page>
    );
  }

  return (
    <Page title={`Hello, ${member?.display_name}`} subtitle={`${season.year} season`}>
      {seasonMember.status === "pending_payment" && (
        <Alert severity="warning">
          You can&apos;t be picked until your membership is paid. Your status changes once the treasurer confirms payment.
        </Alert>
      )}
      <Section title="My membership">
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Chip color={seasonMember.status === "active" ? "success" : "warning"} label={LABELS[seasonMember.status]} />
          <Chip variant="outlined" label={LABELS[seasonMember.role]} />
          {seasonMember.responsibilities.map((item) => (
            <Chip key={item} variant="outlined" label={LABELS[item]} />
          ))}
        </Stack>
      </Section>
      <MyDues seasonId={season.id} memberId={seasonMember.member_id} />
    </Page>
  );
}
