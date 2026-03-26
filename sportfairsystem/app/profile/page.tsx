"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricketRounded";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/app/services/supabaseClient";
import {
  createTeamWorkspace,
  normalizeJoinCodeInput
} from "@/app/services/teamOnboardingService";
import {
  cancelMyTeamJoinRequest,
  getMyPendingTeamJoinRequest,
  submitTeamJoinRequest,
  TeamJoinRequestRecord
} from "@/app/services/teamJoinRequestService";

const PROFILE_NAVY = "#0A1A49";
const PROFILE_NAVY_DEEP = "#061230";
const PROFILE_RED = "#E53935";

type ProfileFormState = {
  firstName: string;
  lastName: string;
  username: string;
  phoneCountryCode: string;
  phoneNumber: string;
};

function normalizeProfileInput(value: string) {
  return value.trim();
}

function normalizePhoneNumber(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function buildProfileFormState(profile: ReturnType<typeof useAuth>["profile"]): ProfileFormState {
  return {
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    username: profile?.username ?? "",
    phoneCountryCode: profile?.phoneCountryCode ?? "",
    phoneNumber: profile?.phoneNumber ?? ""
  };
}

function buildPreferredMemberName(
  profile: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  },
  formValues: ProfileFormState
) {
  const preferredFullName = [
    normalizeProfileInput(formValues.firstName),
    normalizeProfileInput(formValues.lastName)
  ].filter(Boolean).join(" ");

  if (preferredFullName) {
    return preferredFullName;
  }

  const savedFullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();

  if (savedFullName) {
    return savedFullName;
  }

  const preferredUsername = normalizeProfileInput(formValues.username);

  if (preferredUsername) {
    return preferredUsername;
  }

  if (profile.username) {
    return profile.username;
  }

  return profile.email.split("@")[0] ?? profile.email;
}

export default function ProfilePage() {
  const { profile, isLoading, isProfileComplete, refreshProfile } = useAuth();
  const hadPendingJoinRequestRef = useRef(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [teamJoinCode, setTeamJoinCode] = useState<string>("");
  const [mappedPlayerName, setMappedPlayerName] = useState<string | null>(null);
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  const [profileColumnsReady, setProfileColumnsReady] = useState<boolean | null>(null);
  const [mappingColumnsReady, setMappingColumnsReady] = useState<boolean | null>(null);
  const [createTeamNameInput, setCreateTeamNameInput] = useState("");
  const [joinTeamIdInput, setJoinTeamIdInput] = useState("");
  const [isTeamActionSubmitting, setIsTeamActionSubmitting] = useState(false);
  const [pendingJoinRequest, setPendingJoinRequest] = useState<TeamJoinRequestRecord | null>(null);
  const [formValues, setFormValues] = useState<ProfileFormState>({
    firstName: "",
    lastName: "",
    username: "",
    phoneCountryCode: "",
    phoneNumber: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setFormValues(buildProfileFormState(profile));
  }, [profile]);

  useEffect(() => {
    let isActive = true;

    const loadProfileSchemaSupport = async () => {
      if (!profile?.id) {
        setProfileColumnsReady(null);
        return;
      }

      const { error } = await supabase
        .from("users")
        .select("id, first_name, last_name, username, phone_country_code, phone_number")
        .eq("id", profile.id)
        .single();

      if (isActive) {
        setProfileColumnsReady(!error);
      }
    };

    void loadProfileSchemaSupport();

    return () => {
      isActive = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    let isActive = true;

    const loadMappingSupport = async () => {
      if (!profile?.id) {
        setMappingColumnsReady(null);
        return;
      }

      const { error } = await supabase
        .from("users")
        .select("id, player_id")
        .eq("id", profile.id)
        .single();

      if (isActive) {
        setMappingColumnsReady(!error);
      }
    };

    void loadMappingSupport();

    return () => {
      isActive = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    let isActive = true;

    const loadTeamName = async () => {
      if (!profile?.teamId) {
        setTeamName(null);
        setTeamJoinCode("");
        setIsTeamLoading(false);
        return;
      }

      setIsTeamLoading(true);

      const { data } = await supabase
        .from("teams")
        .select("name, join_code")
        .eq("id", profile.teamId)
        .maybeSingle();

      if (isActive) {
        setTeamName(data?.name ?? null);
        setTeamJoinCode(normalizeJoinCodeInput(typeof data?.join_code === "string" ? data.join_code : ""));
        setIsTeamLoading(false);
      }
    };

    void loadTeamName();

    return () => {
      isActive = false;
    };
  }, [profile?.teamId]);

  useEffect(() => {
    let isActive = true;

    const loadMappedPlayerName = async () => {
      if (!profile?.playerId) {
        setMappedPlayerName(null);
        return;
      }

      const { data } = await supabase
        .from("players")
        .select("name")
        .eq("id", profile.playerId)
        .maybeSingle();

      if (isActive) {
        setMappedPlayerName(data?.name ?? null);
      }
    };

    void loadMappedPlayerName();

    return () => {
      isActive = false;
    };
  }, [profile?.playerId]);

  useEffect(() => {
    hadPendingJoinRequestRef.current = Boolean(pendingJoinRequest);
  }, [pendingJoinRequest]);

  useEffect(() => {
    if (profile?.teamId && hadPendingJoinRequestRef.current) {
      setPendingJoinRequest(null);
      setSuccessMessage("Your join request was approved. Team pages are now unlocked.");
      hadPendingJoinRequestRef.current = false;
    }
  }, [profile?.teamId]);

  useEffect(() => {
    let isActive = true;

    const loadPendingJoinRequest = async () => {
      if (!profile?.id || profile.teamId) {
        setPendingJoinRequest(null);
        return;
      }

      try {
        const nextPendingJoinRequest = await getMyPendingTeamJoinRequest();

        if (isActive) {
          setPendingJoinRequest(nextPendingJoinRequest);
        }
      } catch {
        if (isActive) {
          setPendingJoinRequest(null);
        }
      }
    };

    void loadPendingJoinRequest();

    return () => {
      isActive = false;
    };
  }, [profile?.id, profile?.teamId]);

  useEffect(() => {
    let isActive = true;

    if (!profile?.id || profile.teamId || !pendingJoinRequest) {
      return () => {
        isActive = false;
      };
    }

    const syncPendingApproval = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("team_id")
        .eq("id", profile.id)
        .single();

      if (!isActive) {
        return;
      }

      if (!error && typeof data?.team_id === "string" && data.team_id.trim()) {
        await refreshProfile();
        return;
      }

      try {
        const nextPendingJoinRequest = await getMyPendingTeamJoinRequest();

        if (isActive) {
          setPendingJoinRequest(nextPendingJoinRequest);
        }
      } catch {
        if (isActive) {
          setPendingJoinRequest(null);
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void syncPendingApproval();
    }, 15000);

    const handleWindowFocus = () => {
      void syncPendingApproval();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncPendingApproval();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pendingJoinRequest, profile?.id, profile?.teamId, refreshProfile]);

  if (isLoading || !profile) {
    return (
      <Box
        sx={{
          minHeight: 320,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const profileHeading = displayName || "Complete Your Profile";
  const profileLetter = (profile.firstName ?? profile.email).charAt(0).toUpperCase();
  const resolvedTeamName = teamName ?? (profile.teamId ? "Assigned Team" : "Not Assigned");
  const resolvedTeamJoinCode = teamJoinCode || (profile.teamId ? "Unavailable" : "Not assigned");
  const resolvedPlayerName = mappedPlayerName ?? (profile.playerId ? "Loading..." : "Pending assignment");
  const playerMappingSummary = mappingColumnsReady === null
    ? "Checking..."
    : mappingColumnsReady
      ? resolvedPlayerName
      : "Mapping not installed";
  const formattedPhone = [profile.phoneCountryCode, profile.phoneNumber].filter(Boolean).join(" ");
  const accountSummary = [
    { label: "Email", value: profile.email },
    { label: "Username", value: profile.username ?? "Not set" },
    { label: "Contact", value: formattedPhone || "Not set" },
    { label: "Role", value: profile.role === "admin" ? "Admin" : "Member" },
    { label: "Team", value: isTeamLoading ? "Loading..." : resolvedTeamName },
    { label: "Squad Player", value: playerMappingSummary },
    { label: "Team ID", value: resolvedTeamJoinCode }
  ];

  const handleFieldChange = (field: keyof ProfileFormState) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: event.target.value
    }));
  };

  const handleSaveProfile = async () => {
    if (profileColumnsReady !== true) {
      setErrorMessage(
        "Profile editing is not available in this environment yet."
      );
      return;
    }

    const nextValues = {
      first_name: normalizeProfileInput(formValues.firstName),
      last_name: normalizeProfileInput(formValues.lastName),
      username: normalizeProfileInput(formValues.username),
      phone_country_code: normalizeProfileInput(formValues.phoneCountryCode),
      phone_number: normalizePhoneNumber(formValues.phoneNumber)
    };

    if (
      !nextValues.first_name
      || !nextValues.last_name
      || !nextValues.username
      || !nextValues.phone_country_code
      || !nextValues.phone_number
    ) {
      setErrorMessage("Please complete all required profile fields before continuing.");
      return;
    }

    if (!nextValues.phone_country_code.startsWith("+")) {
      setErrorMessage("Country code should start with +, for example +49.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { error } = await supabase
      .from("users")
      .update(nextValues)
      .eq("id", profile.id);

    if (error) {
      setErrorMessage(
        error.code === "23505"
          ? "That username is already in use. Please choose another one."
          : "Could not update your profile."
      );
      setIsSaving(false);
      return;
    }

    try {
      await refreshProfile();
      setSuccessMessage("Profile details updated successfully.");
    } catch {
      setErrorMessage("Profile details were saved, but the latest profile view could not be refreshed.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTeam = async () => {
    setIsTeamActionSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await createTeamWorkspace(
        createTeamNameInput,
        buildPreferredMemberName(profile, formValues)
      );

      await refreshProfile();
      setTeamName(result.teamName);
      setTeamJoinCode(result.joinCode);
      setCreateTeamNameInput("");
      setSuccessMessage(`Team created successfully. Share Team ID ${result.joinCode} with people who need organiser approval to join.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create the team.");
    } finally {
      setIsTeamActionSubmitting(false);
    }
  };

  const handleJoinTeam = async () => {
    setIsTeamActionSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await submitTeamJoinRequest(
        joinTeamIdInput,
        buildPreferredMemberName(profile, formValues)
      );

      setPendingJoinRequest({
        requestId: result.requestId,
        teamId: result.teamId,
        teamName: result.teamName,
        requesterUserId: profile.id,
        requesterEmail: profile.email,
        requesterName: result.requesterName,
        status: result.status,
        requestedAt: result.requestedAt,
        resolvedAt: null,
        resolutionNote: null
      });
      setJoinTeamIdInput("");
      setSuccessMessage(`Join request submitted for ${result.teamName ?? "the selected team"}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not submit the team join request.");
    } finally {
      setIsTeamActionSubmitting(false);
    }
  };

  const handleCancelJoinRequest = async () => {
    if (!pendingJoinRequest) {
      return;
    }

    setIsTeamActionSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await cancelMyTeamJoinRequest(pendingJoinRequest.requestId);
      setPendingJoinRequest(null);
      setSuccessMessage("Pending team join request cancelled.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not cancel the team join request.");
    } finally {
      setIsTeamActionSubmitting(false);
    }
  };

  const handleCopyText = async (value: string, label: string) => {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard copy is not available in this browser.");
      }

      await navigator.clipboard.writeText(normalizedValue);
      setErrorMessage(null);
      setSuccessMessage(`${label} copied to clipboard.`);
    } catch (error) {
      setSuccessMessage(null);
      setErrorMessage(error instanceof Error ? error.message : `Could not copy the ${label.toLowerCase()}.`);
    }
  };

  return (
    <Container maxWidth="lg">
      <Stack spacing={4}>
        <TeamPageHeader
          eyebrow="Account"
          title="Profile"
          description="Complete your user profile and connect this account to a team so team-scoped pages unlock cleanly."
        />

        {!isProfileComplete && (
          <AutoHideAlert severity="info" variant="outlined">
            Complete your profile details before continuing to the rest of the workspace.
          </AutoHideAlert>
        )}

        {!profile.teamId && !pendingJoinRequest && (
          <AutoHideAlert severity="warning" variant="outlined">
            This account is not connected to a team yet. Create a new team or join an existing
            team by its 6-character Team ID to unlock team-scoped pages.
          </AutoHideAlert>
        )}

        {!profile.teamId && pendingJoinRequest && (
          <AutoHideAlert severity="info" variant="outlined">
            Your request to join {pendingJoinRequest.teamName ?? "the selected team"} is pending
            organiser approval. Until then, this account stays limited to the profile page, and
            approval is checked automatically when you return here.
          </AutoHideAlert>
        )}

        {profile.teamId && mappingColumnsReady && !profile.playerId && (
          <AutoHideAlert severity="info" variant="outlined">
            {profile.role === "admin"
              ? "Your account is on the team, but it is still waiting for a squad-player mapping. Use Memberships to finish the assignment."
              : "Your account is on the team, but it is still waiting for an admin to map it to the matching squad player record."}
          </AutoHideAlert>
        )}

        {profileColumnsReady === false && (
          <AutoHideAlert severity="warning" variant="outlined">
            Profile editing is not available in this environment yet.
          </AutoHideAlert>
        )}

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {successMessage && (
          <AutoHideAlert severity="success" resetKey={successMessage}>
            {successMessage}
          </AutoHideAlert>
        )}

        {!profile.teamId && (
          <Card
            variant="outlined"
            sx={{
              borderRadius: 4,
              boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)"
            }}
          >
            <CardContent sx={{ p: 3.5 }}>
              <Stack spacing={3}>
                <Stack spacing={0.75}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary" }}>
                    Team Access
                  </Typography>
                  <Typography color="text.secondary">
                    Every account starts here in V2.0: create your own team, or request access to
                    an existing team with its 6-character Team ID. Until approval happens, the account stays
                    profile-only.
                  </Typography>
                </Stack>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderRadius: 3,
                        height: "100%"
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Stack spacing={2}>
                          <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            Create Team
                          </Typography>
                          <Typography color="text.secondary">
                            Use this if you are starting the workspace for your squad. You become
                            the organiser and admin for the team.
                          </Typography>
                          <TextField
                            label="Team Name"
                            placeholder="Your Team Name"
                            value={createTeamNameInput}
                            onChange={(event) => setCreateTeamNameInput(event.target.value)}
                            fullWidth
                          />
                          <Button
                            variant="contained"
                            onClick={() => void handleCreateTeam()}
                            disabled={isTeamActionSubmitting || Boolean(pendingJoinRequest)}
                            sx={{
                              alignSelf: "flex-start",
                              backgroundColor: PROFILE_NAVY,
                              "&:hover": {
                                backgroundColor: PROFILE_NAVY_DEEP
                              }
                            }}
                          >
                            {isTeamActionSubmitting ? "Creating Team..." : "Create Team"}
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderRadius: 3,
                        height: "100%"
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Stack spacing={2}>
                          <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            Join Team
                          </Typography>
                          <Typography color="text.secondary">
                            Enter the exact 6-character Team ID shared by the organiser. Access is granted only
                            after organiser confirmation.
                          </Typography>
                          <TextField
                            label="Team ID"
                            placeholder="AB12CD"
                            value={joinTeamIdInput}
                            onChange={(event) => setJoinTeamIdInput(normalizeJoinCodeInput(event.target.value))}
                            slotProps={{
                              input: {
                                inputProps: {
                                  maxLength: 6
                                }
                              }
                            }}
                            helperText="6 letters and numbers"
                            fullWidth
                          />
                          {pendingJoinRequest ? (
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                              <Button
                                variant="outlined"
                                disabled
                                sx={{ alignSelf: "flex-start" }}
                              >
                                Request Pending
                              </Button>
                              <Button
                                variant="text"
                                onClick={() => void handleCancelJoinRequest()}
                                disabled={isTeamActionSubmitting}
                                sx={{ alignSelf: "flex-start" }}
                              >
                                {isTeamActionSubmitting ? "Cancelling..." : "Cancel Request"}
                              </Button>
                            </Stack>
                          ) : (
                            <Button
                              variant="outlined"
                              onClick={() => void handleJoinTeam()}
                              disabled={isTeamActionSubmitting}
                              sx={{ alignSelf: "flex-start" }}
                            >
                              {isTeamActionSubmitting ? "Submitting Request..." : "Request to Join"}
                            </Button>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Stack>
            </CardContent>
          </Card>
        )}

        {profile.teamId && (
          <Card
            variant="outlined"
            sx={{
              borderRadius: 4,
              boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)"
            }}
          >
            <CardContent sx={{ p: 3.5 }}>
              <Stack spacing={2.25}>
                <Stack spacing={0.75}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary" }}>
                    Team Access
                  </Typography>
                  <Typography color="text.secondary">
                    Share this Team ID with people who should request organiser approval to join
                    {resolvedTeamName !== "Not Assigned" ? ` ${resolvedTeamName}` : " your team"}.
                    Invite links remain available in Memberships only for exceptional admin cases like claiming an existing unlinked member.
                  </Typography>
                </Stack>

                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    backgroundColor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.04)
                  }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", md: "center" }}
                    >
                      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                        <Typography variant="body2" color="text.secondary">
                          Team ID
                        </Typography>
                        <Typography
                          sx={{
                            fontWeight: 800,
                            color: "text.primary",
                            letterSpacing: 1.2
                          }}
                        >
                          {resolvedTeamJoinCode}
                        </Typography>
                      </Stack>

                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                        <Button
                          variant="contained"
                          startIcon={<ContentCopyRoundedIcon />}
                          onClick={() => void handleCopyText(teamJoinCode, "Team ID")}
                          disabled={!teamJoinCode}
                          sx={{
                            backgroundColor: PROFILE_NAVY,
                            "&:hover": {
                              backgroundColor: PROFILE_NAVY_DEEP
                            }
                          }}
                        >
                          Copy Team ID
                        </Button>

                        {profile.role === "admin" && (
                          <Button component={Link} href="/memberships" variant="outlined">
                            Open Memberships
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </CardContent>
          </Card>
        )}

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4.5 }}>
            <Card
              variant="outlined"
              sx={{
                borderRadius: 4,
                height: "100%",
                boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)"
              }}
            >
              <CardContent sx={{ p: 3.5 }}>
                <Stack spacing={3} alignItems="flex-start">
                  <Avatar
                    sx={{
                      width: 72,
                      height: 72,
                      fontSize: "1.75rem",
                      fontWeight: 800,
                      color: "#FFFFFF",
                      background: `linear-gradient(135deg, ${PROFILE_NAVY_DEEP} 0%, ${PROFILE_NAVY} 62%, #102969 100%)`
                    }}
                  >
                    {profileLetter}
                  </Avatar>

                  <Stack spacing={1}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: "text.primary" }}>
                      {profileHeading}
                    </Typography>
                    <Typography color="text.secondary">
                      {profile.username ? `@${profile.username}` : profile.email}
                    </Typography>
                    <Typography color="text.secondary">
                      {profile.teamId
                        ? `Signed in to ${resolvedTeamName}.`
                        : "Signed in to SportFairSystem. Connect this account to a team to continue."}
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip
                      icon={<ShieldRoundedIcon />}
                      label={profile.role === "admin" ? "Admin Access" : "Member Access"}
                      sx={(theme) => ({
                        color: profile.role === "admin" ? "#FFFFFF" : "text.primary",
                        backgroundColor: profile.role === "admin"
                          ? PROFILE_RED
                          : (theme.palette.mode === "dark"
                            ? alpha("#FFFFFF", 0.08)
                            : alpha("#DCE7FF", 0.68)),
                        fontWeight: 700
                      })}
                    />
                    <Chip
                      icon={<SportsCricketRoundedIcon />}
                      label={isTeamLoading ? "Loading team..." : resolvedTeamName}
                      sx={(theme) => ({
                        color: "text.primary",
                        backgroundColor: (theme.palette.mode === "dark"
                          ? alpha("#FFFFFF", 0.08)
                          : alpha("#DCE7FF", 0.68)),
                        fontWeight: 700
                      })}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 7.5 }}>
            <Card
              variant="outlined"
              sx={{
                borderRadius: 4,
                height: "100%",
                boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)"
              }}
            >
              <CardContent sx={{ p: 3.5 }}>
                <Stack spacing={3}>
                  <Stack spacing={0.75}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary" }}>
                      Profile Details
                    </Typography>
                    <Typography color="text.secondary">
                      These fields are required after sign-in and are editable by the signed-in
                      user only.
                    </Typography>
                  </Stack>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="First Name"
                        value={formValues.firstName}
                        onChange={handleFieldChange("firstName")}
                        fullWidth
                        required
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Last Name"
                        value={formValues.lastName}
                        onChange={handleFieldChange("lastName")}
                        fullWidth
                        required
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Username"
                        value={formValues.username}
                        onChange={handleFieldChange("username")}
                        fullWidth
                        required
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Country Code"
                        placeholder="+49"
                        value={formValues.phoneCountryCode}
                        onChange={handleFieldChange("phoneCountryCode")}
                        fullWidth
                        required
                      />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <TextField
                        label="Contact Number"
                        value={formValues.phoneNumber}
                        onChange={handleFieldChange("phoneNumber")}
                        fullWidth
                        required
                      />
                    </Grid>
                  </Grid>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <Button
                      variant="contained"
                      onClick={() => void handleSaveProfile()}
                      disabled={isSaving || profileColumnsReady !== true}
                      startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : <SaveRoundedIcon />}
                      sx={{
                        backgroundColor: PROFILE_NAVY,
                        "&:hover": {
                          backgroundColor: PROFILE_NAVY_DEEP
                        }
                      }}
                    >
                      {isSaving ? "Saving..." : "Save Profile"}
                    </Button>

                    {isProfileComplete && profile.teamId && (
                      <Button component={Link} href="/dashboard" variant="outlined">
                        Back to Dashboard
                      </Button>
                    )}

                    {profile.teamId && (
                      <Button component={Link} href="/my-fairness" variant="outlined">
                        Open My Fairness
                      </Button>
                    )}

                    {profile.role === "admin" && profile.teamId && mappingColumnsReady && !profile.playerId && (
                      <Button component={Link} href="/memberships" variant="outlined">
                        Open Memberships
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7.5 }}>
            <Card
              variant="outlined"
              sx={{
                borderRadius: 4,
                boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)"
              }}
            >
              <CardContent sx={{ p: 0 }}>
                <Stack divider={<Divider flexItem />}>
                  {accountSummary.map((item) => (
                    <Stack
                      key={item.label}
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      spacing={1}
                      sx={{ px: 3.5, py: 2.5 }}
                    >
                      <Typography color="text.secondary">{item.label}</Typography>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          color: "text.primary",
                          wordBreak: "break-word",
                          textAlign: { xs: "left", sm: "right" }
                        }}
                      >
                        {item.value}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4.5 }}>
            <Card
              variant="outlined"
              sx={{
                borderRadius: 4,
                height: "100%",
                boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)"
              }}
            >
              <CardContent sx={{ p: 3.5 }}>
                <Stack spacing={2.5}>
                  <Stack spacing={0.75}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary" }}>
                      Security
                    </Typography>
                    <Typography color="text.secondary">
                      Use the reset password flow any time you want to rotate your account
                      password.
                    </Typography>
                  </Stack>

                  <Button
                    component={Link}
                    href="/reset-password"
                    variant="contained"
                    startIcon={<LockResetRoundedIcon />}
                    sx={{
                      alignSelf: "flex-start",
                      backgroundColor: PROFILE_NAVY,
                      "&:hover": {
                        backgroundColor: PROFILE_NAVY_DEEP
                      }
                    }}
                  >
                    Reset Password
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </Container>
  );
}
