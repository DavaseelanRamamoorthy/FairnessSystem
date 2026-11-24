"use client";

import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useParams, useRouter } from "next/navigation";
import { claimMember } from "@/src/db/membership";
import { ErrorNote, Page, Section, useAction } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>();
  const session = useSession();
  const router = useRouter();
  const { busy, error, run } = useAction();

  const claim = async () => {
    const ok = await run(() => claimMember(token));
    if (ok) {
      session.refresh();
      router.replace("/");
    }
  };

  return (
    <Page title="Claim your profile">
      <Section>
        <Typography>
          This links your account to the player profile your organiser set up, including your match history.
        </Typography>
        <ErrorNote message={error} />
        <Button variant="contained" onClick={claim} disabled={busy || Boolean(session.member)}>
          {session.member ? "Your account already has a profile" : "Claim my profile"}
        </Button>
      </Section>
    </Page>
  );
}
