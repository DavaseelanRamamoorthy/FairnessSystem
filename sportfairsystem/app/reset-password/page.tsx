"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Link as MuiLink,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";

import { currentTeamName } from "@/app/config/teamConfig";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/app/services/supabaseClient";

const RESET_NAVY = "#061230";
const RESET_NAVY_MID = "#0A1A49";
const RESET_RED = "#E53935";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { isAuthenticated, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPasswordUpdateMode = useMemo(() => {
    return isAuthenticated;
  }, [isAuthenticated]);

  const handleEmailResetRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage("Password reset email sent. Open the link in your inbox to continue.");
    setIsSubmitting(false);
  };

  const handlePasswordUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setErrorMessage("Use at least 8 characters for the new password.");
      setIsSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("New password and confirm password do not match.");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage("Password updated successfully. Sign in again with your new password.");
    await signOut();
    setIsSubmitting(false);
    router.replace("/login");
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
        background: `linear-gradient(145deg, ${alpha(RESET_NAVY, 0.98)} 0%, ${alpha(RESET_NAVY_MID, 0.96)} 58%, #14337A 100%)`
      }}
    >
      <Card
        variant="outlined"
        sx={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 4,
          overflow: "hidden",
          borderColor: alpha(RESET_RED, 0.2),
          boxShadow: `0 24px 56px ${alpha(RESET_NAVY, 0.3)}`
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 3,
            color: "#FFFFFF",
            background: `linear-gradient(135deg, ${RESET_NAVY} 0%, ${RESET_NAVY_MID} 68%, #14337A 100%)`
          }}
        >
          <Stack spacing={1}>
            <Typography variant="overline" sx={{ letterSpacing: 1.2, color: alpha("#FFFFFF", 0.7) }}>
              SportFairSystem
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {isPasswordUpdateMode ? "Set a new password" : `Reset password for ${currentTeamName}`}
            </Typography>
            <Typography sx={{ color: alpha("#FFFFFF", 0.74) }}>
              {isPasswordUpdateMode
                ? "Enter a new password to finish the recovery flow."
                : "Request a password reset email for your team account."}
            </Typography>
          </Stack>
        </Box>

        <CardContent sx={{ p: 3 }}>
          <Stack
            spacing={2.5}
            component="form"
            onSubmit={isPasswordUpdateMode ? handlePasswordUpdate : handleEmailResetRequest}
          >
            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
            {successMessage && <Alert severity="success">{successMessage}</Alert>}

            {isPasswordUpdateMode ? (
              <>
                <TextField
                  label="New Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  fullWidth
                  autoComplete="new-password"
                />

                <TextField
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  fullWidth
                  autoComplete="new-password"
                />
              </>
            ) : (
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                fullWidth
                autoComplete="email"
              />
            )}

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <LockResetRoundedIcon />}
              sx={{
                mt: 1,
                py: 1.2,
                fontWeight: 800
              }}
            >
              {isSubmitting
                ? (isPasswordUpdateMode ? "Updating..." : "Sending...")
                : (isPasswordUpdateMode ? "Update Password" : "Send Reset Email")}
            </Button>

            <MuiLink
              href="/signup"
              underline="hover"
              sx={{
                alignSelf: "flex-start",
                fontWeight: 600
              }}
            >
              Need an account? Sign up
            </MuiLink>

            <MuiLink
              href="/login"
              underline="hover"
              sx={{
                alignSelf: "flex-start",
                fontWeight: 600
              }}
            >
              Back to sign in
            </MuiLink>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
