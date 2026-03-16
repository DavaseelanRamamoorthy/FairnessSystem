"use client";

import { FormEvent, useState } from "react";
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
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";

import { currentTeamName } from "@/app/config/teamConfig";
import { useAuth } from "@/app/context/AuthContext";

const SIGNUP_NAVY = "#061230";
const SIGNUP_NAVY_MID = "#0A1A49";
const SIGNUP_RED = "#E53935";

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setErrorMessage("Use at least 8 characters for the password.");
      setIsSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Password and confirm password do not match.");
      setIsSubmitting(false);
      return;
    }

    const result = await signUp(email, password);

    if (result.error) {
      setErrorMessage(result.error);
      setIsSubmitting(false);
      return;
    }

    if (result.requiresEmailConfirmation) {
      setSuccessMessage(
        "Account created. Check your inbox to confirm your email, then sign in."
      );
      setIsSubmitting(false);
      return;
    }

    router.replace("/dashboard");
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
        background: `linear-gradient(145deg, ${alpha(SIGNUP_NAVY, 0.98)} 0%, ${alpha(SIGNUP_NAVY_MID, 0.96)} 58%, #14337A 100%)`
      }}
    >
      <Card
        variant="outlined"
        sx={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 4,
          overflow: "hidden",
          borderColor: alpha(SIGNUP_RED, 0.2),
          boxShadow: `0 24px 56px ${alpha(SIGNUP_NAVY, 0.3)}`
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 3,
            color: "#FFFFFF",
            background: `linear-gradient(135deg, ${SIGNUP_NAVY} 0%, ${SIGNUP_NAVY_MID} 68%, #14337A 100%)`
          }}
        >
          <Stack spacing={1}>
            <Typography variant="overline" sx={{ letterSpacing: 1.2, color: alpha("#FFFFFF", 0.7) }}>
              SportFairSystem
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Create your {currentTeamName} account
            </Typography>
            <Typography sx={{ color: alpha("#FFFFFF", 0.74) }}>
              New accounts start with member access. Admin privileges can be assigned later from
              `public.users`.
            </Typography>
          </Stack>
        </Box>

        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
            {successMessage && <Alert severity="success">{successMessage}</Alert>}

            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              fullWidth
              autoComplete="email"
            />

            <TextField
              label="Password"
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

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <PersonAddAlt1RoundedIcon />}
              sx={{
                mt: 1,
                py: 1.2,
                fontWeight: 800
              }}
            >
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </Button>

            <MuiLink
              href="/login"
              underline="hover"
              sx={{
                alignSelf: "flex-start",
                fontWeight: 600
              }}
            >
              Already have an account? Sign in
            </MuiLink>

            <MuiLink
              href="/reset-password"
              underline="hover"
              sx={{
                alignSelf: "flex-start",
                fontWeight: 600
              }}
            >
              Forgot your password?
            </MuiLink>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
