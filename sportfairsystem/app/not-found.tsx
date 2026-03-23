"use client";

import Link from "next/link";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Stack,
  Typography
} from "@mui/material";

export default function NotFound() {
  return (
    <Container maxWidth="md">
      <Box
        sx={{
          minHeight: "calc(100vh - 120px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: { xs: 4, md: 6 }
        }}
      >
        <Card
          variant="outlined"
          sx={{
            width: "100%",
            borderRadius: 4,
            overflow: "hidden",
            background: "linear-gradient(180deg, #fff7ed 0%, #ffffff 72%)",
            borderColor: "rgba(194, 65, 12, 0.18)",
            boxShadow: "0 22px 60px rgba(15, 23, 42, 0.12)"
          }}
        >
          <CardContent
            sx={{
              px: { xs: 3, sm: 4, md: 5 },
              py: { xs: 4, sm: 5, md: 6 }
            }}
          >
            <Stack spacing={3}>
              <Stack spacing={1.5}>
                <Chip
                  label="404 Not Found"
                  color="warning"
                  variant="outlined"
                  sx={{ alignSelf: "flex-start", fontWeight: 700 }}
                />
                <Typography
                  variant="h2"
                  sx={{
                    fontWeight: 900,
                    color: "#111827",
                    fontSize: { xs: "2rem", sm: "2.6rem", md: "3.2rem" },
                    lineHeight: 1.05
                  }}
                >
                  This page does not exist.
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: "#4b5563",
                    maxWidth: 640,
                    lineHeight: 1.65
                  }}
                >
                  The link may be outdated, the page may have moved, or the URL may be incorrect.
                  Use one of the actions below to get back to the main workspace.
                </Typography>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  component={Link}
                  href="/dashboard"
                  variant="contained"
                  size="large"
                >
                  Go to Dashboard
                </Button>
                <Button
                  component={Link}
                  href="/memberships"
                  variant="outlined"
                  size="large"
                >
                  Open Memberships
                </Button>
              </Stack>

              <Box
                sx={{
                  mt: 1,
                  p: 2,
                  borderRadius: 3,
                  backgroundColor: "rgba(255,255,255,0.88)",
                  border: "1px solid rgba(148, 163, 184, 0.2)"
                }}
              >
                <Typography variant="body2" sx={{ color: "#475569" }}>
                  If you still hit this page for a valid route, refresh once and note which URL caused it.
                  That helps isolate whether the issue is routing, auth redirect behavior, or deployment config.
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
