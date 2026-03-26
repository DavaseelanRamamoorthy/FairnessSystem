"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import { useAuth } from "@/app/context/AuthContext";
import {
  acceptTeamInvite,
  getInvitePreviewByToken,
  TeamInviteRecord
} from "@/app/services/inviteService";

const INVITE_NAVY = "#061230";
const INVITE_NAVY_MID = "#0A1A49";
const INVITE_RED = "#E53935";

function buildNextPath(rawToken: string) {
  return `/accept-invite?token=${encodeURIComponent(rawToken)}`;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, profile, refreshProfile } = useAuth();
  const [invitePreview, setInvitePreview] = useState<TeamInviteRecord | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptSuccess, setAcceptSuccess] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const rawToken = searchParams.get("token")?.trim() ?? "";
  const nextPath = useMemo(() => (rawToken ? buildNextPath(rawToken) : "/accept-invite"), [rawToken]);

  useEffect(() => {
    let isActive = true;

    if (!isAuthenticated || !rawToken) {
      setInvitePreview(null);
      setPreviewError(null);
      return () => {
        isActive = false;
      };
    }

    const loadInvitePreview = async () => {
      setIsLoadingPreview(true);
      setPreviewError(null);

      try {
        const nextPreview = await getInvitePreviewByToken(rawToken);

        if (isActive) {
          setInvitePreview(nextPreview);
        }
      } catch (error) {
        if (isActive) {
          setInvitePreview(null);
          setPreviewError(error instanceof Error ? error.message : "Could not load the invite preview.");
        }
      } finally {
        if (isActive) {
          setIsLoadingPreview(false);
        }
      }
    };

    void loadInvitePreview();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, rawToken]);

  const handleAcceptInvite = async () => {
    if (!rawToken) {
      return;
    }

    try {
      setIsAccepting(true);
      setAcceptError(null);

      const result = await acceptTeamInvite(rawToken);
      await refreshProfile();
      setAcceptSuccess(
        result.createdMember
          ? "Invite accepted. Your new team membership is ready."
          : "Invite accepted. Your existing team membership is now linked to this account."
      );
    } catch (error) {
      setAcceptError(error instanceof Error ? error.message : "Could not accept the invite.");
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        px: 3,
        py: { xs: 5, md: 8 },
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(145deg, ${alpha(INVITE_NAVY, 0.98)} 0%, ${alpha(INVITE_NAVY_MID, 0.96)} 58%, #14337A 100%)`
      }}
    >
      <Card
        variant="outlined"
        sx={{
          width: "100%",
          maxWidth: 640,
          borderRadius: 4,
          overflow: "hidden",
          borderColor: alpha(INVITE_RED, 0.2),
          boxShadow: `0 24px 56px ${alpha(INVITE_NAVY, 0.3)}`
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 3,
            color: "#FFFFFF",
            background: `linear-gradient(135deg, ${INVITE_NAVY} 0%, ${INVITE_NAVY_MID} 68%, #14337A 100%)`
          }}
        >
          <Stack spacing={1}>
            <Typography variant="overline" sx={{ letterSpacing: 1.2, color: alpha("#FFFFFF", 0.7) }}>
              SportFairSystem
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Team Invite
            </Typography>
            <Typography sx={{ color: alpha("#FFFFFF", 0.74) }}>
              Join the team attached to this invite by claiming the membership with your email account.
            </Typography>
          </Stack>
        </Box>

        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            {!rawToken && (
              <Alert severity="error">
                This invite link is incomplete. Ask your organiser or captain for a fresh invite.
              </Alert>
            )}

            {acceptSuccess && (
              <AutoHideAlert severity="success" resetKey={acceptSuccess}>
                {acceptSuccess}
              </AutoHideAlert>
            )}

            {acceptError && <Alert severity="error">{acceptError}</Alert>}

            {!isAuthenticated ? (
              <>
                <Typography color="text.secondary">
                  Sign in or create an account with the same email address the invite was sent to. The system will attach that account to the correct team membership when you accept.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button
                    variant="contained"
                    href={`/login?next=${encodeURIComponent(nextPath)}`}
                    startIcon={<LoginRoundedIcon />}
                    disabled={!rawToken}
                  >
                    Sign In To Accept
                  </Button>
                  <Button
                    variant="outlined"
                    href={`/signup?next=${encodeURIComponent(nextPath)}`}
                    startIcon={<PersonAddAlt1RoundedIcon />}
                    disabled={!rawToken}
                  >
                    Create Account
                  </Button>
                </Stack>
              </>
            ) : (
              <>
                <Stack spacing={0.75}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Signed in as {profile?.email ?? "your account"}
                  </Typography>
                  <Typography color="text.secondary">
                    Accept the invite with this account. If the invite belongs to a different email, the system will stop you and ask for the correct login.
                  </Typography>
                </Stack>

                <Divider />

                {isLoadingPreview ? (
                  <Stack spacing={1.5} alignItems="center" sx={{ py: 3 }}>
                    <CircularProgress size={28} />
                    <Typography color="text.secondary">Loading invite preview...</Typography>
                  </Stack>
                ) : invitePreview ? (
                  <Stack spacing={1}>
                    <Typography><strong>Name:</strong> {invitePreview.inviteName}</Typography>
                    <Typography><strong>Email:</strong> {invitePreview.email}</Typography>
                    <Typography>
                      <strong>Invite Type:</strong> {invitePreview.inviteType === "existing_member" ? "Claim existing member" : "Create new member"}
                    </Typography>
                    <Typography>
                      <strong>Expires:</strong> {new Date(invitePreview.tokenExpiresAt).toLocaleString()}
                    </Typography>
                  </Stack>
                ) : (
                  <Alert severity="info">
                    {previewError ?? "Invite preview is unavailable. You can still try accepting the invite below."}
                  </Alert>
                )}

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button
                    variant="contained"
                    onClick={() => void handleAcceptInvite()}
                    disabled={!rawToken || isAccepting}
                    startIcon={isAccepting ? <CircularProgress size={18} color="inherit" /> : <CheckCircleRoundedIcon />}
                  >
                    {isAccepting ? "Accepting..." : "Accept Invite"}
                  </Button>
                  <Button variant="text" onClick={() => router.push("/profile")}>
                    Go To Profile
                  </Button>
                  <Button variant="text" onClick={() => router.push("/dashboard")}>
                    Go To Dashboard
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
