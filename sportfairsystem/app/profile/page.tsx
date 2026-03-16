"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricketRounded";

import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import { useAuth } from "@/app/context/AuthContext";
import { currentTeamName } from "@/app/config/teamConfig";
import { supabase } from "@/app/services/supabaseClient";

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

function buildProfileFormState(profile: ReturnType<typeof useAuth>["profile"]): ProfileFormState {
  return {
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    username: profile?.username ?? "",
    phoneCountryCode: profile?.phoneCountryCode ?? "",
    phoneNumber: profile?.phoneNumber ?? ""
  };
}

export default function ProfilePage() {
  const { profile, isLoading, isProfileComplete, refreshProfile } = useAuth();
  const [teamName, setTeamName] = useState<string | null>(null);
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  const [profileColumnsReady, setProfileColumnsReady] = useState<boolean | null>(null);
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

      setProfileColumnsReady(!error);
    };

    void loadProfileSchemaSupport();
  }, [profile?.id]);

  useEffect(() => {
    const loadTeamName = async () => {
      if (!profile?.teamId) {
        setTeamName(null);
        return;
      }

      setIsTeamLoading(true);

      const { data } = await supabase
        .from("teams")
        .select("name")
        .eq("id", profile.teamId)
        .maybeSingle();

      setTeamName(data?.name ?? null);
      setIsTeamLoading(false);
    };

    void loadTeamName();
  }, [profile?.teamId]);

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
  const resolvedTeamName = teamName ?? (profile.teamId ? currentTeamName : "Not Assigned");
  const formattedPhone = [profile.phoneCountryCode, profile.phoneNumber].filter(Boolean).join(" ");
  const accountSummary = [
    { label: "Email", value: profile.email },
    { label: "Username", value: profile.username ?? "Not set" },
    { label: "Contact", value: formattedPhone || "Not set" },
    { label: "Role", value: profile.role === "admin" ? "Admin" : "Member" },
    { label: "Team", value: isTeamLoading ? "Loading..." : resolvedTeamName },
    { label: "Team ID", value: profile.teamId ?? "Not assigned" }
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
        "Profile fields are not installed yet. Run database/v1_user_profile_fields.sql first."
      );
      return;
    }

    const nextValues = {
      first_name: normalizeProfileInput(formValues.firstName),
      last_name: normalizeProfileInput(formValues.lastName),
      username: normalizeProfileInput(formValues.username),
      phone_country_code: normalizeProfileInput(formValues.phoneCountryCode),
      phone_number: normalizeProfileInput(formValues.phoneNumber)
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

    await refreshProfile();
    setSuccessMessage("Profile details updated successfully.");
    setIsSaving(false);
  };

  return (
    <Container maxWidth="lg">
      <Stack spacing={4}>
        <TeamPageHeader
          eyebrow="Account"
          title="Profile"
          description="Complete your user profile so the workspace can identify you clearly across team operations."
        />

        {!isProfileComplete && (
          <Alert severity="info" variant="outlined">
            Complete your profile details before continuing to the rest of the workspace.
          </Alert>
        )}

        {!profile.teamId && (
          <Alert severity="warning" variant="outlined">
            This account does not have a team assignment yet. Set `team_id` in `public.users` to
            unlock team-scoped access.
          </Alert>
        )}

        {profileColumnsReady === false && (
          <Alert severity="warning" variant="outlined">
            The new profile fields are not installed yet. Run `database/v1_user_profile_fields.sql`
            in Supabase before saving first name, last name, username, or contact details.
          </Alert>
        )}

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {successMessage && <Alert severity="success">{successMessage}</Alert>}

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
                    <Typography variant="h4" sx={{ fontWeight: 800, color: PROFILE_NAVY_DEEP }}>
                      {profileHeading}
                    </Typography>
                    <Typography color="text.secondary">
                      {profile.username ? `@${profile.username}` : profile.email}
                    </Typography>
                    <Typography color="text.secondary">
                      Signed in to the {currentTeamName} workspace.
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip
                      icon={<ShieldRoundedIcon />}
                      label={profile.role === "admin" ? "Admin Access" : "Member Access"}
                      sx={{
                        color: profile.role === "admin" ? "#FFFFFF" : PROFILE_NAVY,
                        backgroundColor: profile.role === "admin"
                          ? PROFILE_RED
                          : alpha("#DCE7FF", 0.68),
                        fontWeight: 700
                      }}
                    />
                    <Chip
                      icon={<SportsCricketRoundedIcon />}
                      label={isTeamLoading ? "Loading team..." : resolvedTeamName}
                      sx={{
                        color: PROFILE_NAVY,
                        backgroundColor: alpha("#DCE7FF", 0.68),
                        fontWeight: 700
                      }}
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
                    <Typography variant="h5" sx={{ fontWeight: 800, color: PROFILE_NAVY_DEEP }}>
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

                    {isProfileComplete && (
                      <Button component={Link} href="/dashboard" variant="outlined">
                        Back to Dashboard
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
                          color: PROFILE_NAVY_DEEP,
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
                    <Typography variant="h5" sx={{ fontWeight: 800, color: PROFILE_NAVY_DEEP }}>
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
