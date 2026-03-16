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
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";

import { currentTeamName } from "@/app/config/teamConfig";
import { useAuth } from "@/app/context/AuthContext";

const LOGIN_NAVY = "#061230";
const LOGIN_NAVY_MID = "#0A1A49";
const LOGIN_RED = "#E53935";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const error = await signIn(email, password);

    if (error) {
      setErrorMessage(error);
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
        background: `linear-gradient(145deg, ${alpha(LOGIN_NAVY, 0.98)} 0%, ${alpha(LOGIN_NAVY_MID, 0.96)} 58%, #14337A 100%)`
      }}
    >
      <Card
        variant="outlined"
        sx={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 4,
          overflow: "hidden",
          borderColor: alpha(LOGIN_RED, 0.2),
          boxShadow: `0 24px 56px ${alpha(LOGIN_NAVY, 0.3)}`
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 3,
            color: "#FFFFFF",
            background: `linear-gradient(135deg, ${LOGIN_NAVY} 0%, ${LOGIN_NAVY_MID} 68%, #14337A 100%)`
          }}
        >
          <Stack spacing={1}>
            <Typography variant="overline" sx={{ letterSpacing: 1.2, color: alpha("#FFFFFF", 0.7) }}>
              SportFairSystem
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Sign in to {currentTeamName}
            </Typography>
            <Typography sx={{ color: alpha("#FFFFFF", 0.74) }}>
              Use your team account to access match operations, player views, and admin tools.
            </Typography>
          </Stack>
        </Box>

        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

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
              autoComplete="current-password"
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <LoginRoundedIcon />}
              sx={{
                mt: 1,
                py: 1.2,
                fontWeight: 800
              }}
            >
              {isSubmitting ? "Signing In..." : "Sign In"}
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
              href="/reset-password"
              underline="hover"
              sx={{
                alignSelf: "flex-start",
                fontWeight: 600
              }}
            >
              Forgot your password?
            </MuiLink>

            <Alert severity="info" variant="outlined">
              After sign-in, your access is controlled by your `public.users` role and team
              mapping. Run `database/v1_auth_access_control.sql` before testing this flow.
            </Alert>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
