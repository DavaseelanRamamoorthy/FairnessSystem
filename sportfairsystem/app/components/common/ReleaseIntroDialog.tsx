"use client";

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography
} from "@mui/material";

type ReleaseIntroDialogProps = {
  open: boolean;
  dontShowAgain: boolean;
  onDontShowAgainChange: (checked: boolean) => void;
  onContinue: () => void;
};

const featureHighlights = [
  {
    title: "Connected Match Pipeline",
    detail: "Upload scorecards, save structured match data, and keep player identity safer across matches, analytics, fairness, and planner workflows."
  },
  {
    title: "Memberships and Team Operations",
    detail: "Manage team roles, seasons, linked users, linked players, and organiser workflows in one operational memberships workspace."
  },
  {
    title: "Native Attendance and Friendly Planner",
    detail: "Run in-app attendance sessions, save availability, and generate friendly matchday plans without relying on spreadsheet uploads."
  },
  {
    title: "Transparent Fairness and Player Visibility",
    detail: "Track fairness alerts, bias watch, recent usage history, and the current week matchday plan from player-facing views."
  },
  {
    title: "Player Profiles and Preferences",
    detail: "Capture richer player details such as cricket role, batting and bowling style, preferences, and identity fields inside the profile flow."
  },
  {
    title: "Performance, Tournament, and Validation Support",
    detail: "Use player performance signals for tournament planning, monitor analytics and validation, and keep the release safer through role-aware access and QA hardening."
  }
];

export default function ReleaseIntroDialog({
  open,
  dontShowAgain,
  onDontShowAgainChange,
  onContinue
}: ReleaseIntroDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onContinue}
      fullWidth
      maxWidth="md"
      scroll="paper"
    >
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack spacing={1}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Introducing SportFairSystem v1.0
          </Typography>
          <Typography color="text.secondary">
            SportFairSystem has now grown into a practical end-to-end team operations platform for Moonwalkers, connecting organisers, players, planner workflows, fairness visibility, and player data in one place.
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          <Typography color="text.secondary">
            What started as a scorecard-driven cricket system now supports the real weekly flow of the team: onboarding, linked memberships, player profiles, native attendance, friendly planning, tournament support, fairness tracking, player dashboards, and feedback collection.
          </Typography>

          <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              What SportFairSystem now delivers end to end
            </Typography>

            {featureHighlights.map((item) => (
              <Box key={item.title}>
                <Typography sx={{ fontWeight: 700 }}>
                  {item.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.detail}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Stack spacing={1}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Built for Real Teams
            </Typography>
            <Typography color="text.secondary">
              This release is shaped around real Moonwalkers usage: organisers can manage the squad and weekly operations, while players can now see their profile, personal performance, fairness view, and current week friendly matchday plan transparently.
            </Typography>
          </Stack>

          <Stack spacing={1}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              What changed in the current release
            </Typography>
            <Typography color="text.secondary">
              The current product state adds native attendance as the standard friendly workflow, expands memberships and player profile management, improves fairness and bias visibility, sharpens player dashboard transparency, and hardens organiser-player access across the system.
            </Typography>
          </Stack>

          <Stack spacing={1}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Why this matters
            </Typography>
            <Typography color="text.secondary">
              Instead of relying on scattered spreadsheets, captain-only communication, or disconnected tools, SportFairSystem now keeps the weekly operating flow connected:
            </Typography>
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 2,
                bgcolor: "action.hover",
                border: "1px solid",
                borderColor: "divider"
              }}
            >
              <Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                Match Data -&gt; Player Insights -&gt; Team Decisions
              </Typography>
            </Box>
          </Stack>

          <Box
            sx={(theme) => ({
              px: 2,
              py: 1.75,
              borderRadius: 2.5,
              bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.12 : 0.16),
              border: "1px solid",
              borderColor: alpha(theme.palette.warning.main, 0.32)
            })}
          >
            <Stack spacing={0.5}>
              <Typography sx={{ fontWeight: 800 }}>
                Responsive Fit Disclaimer
              </Typography>
              <Typography variant="body2" color="text.secondary">
                SportFairSystem now works across desktop, tablet, and mobile, but denser organiser workflows such as analytics, memberships, and validation still feel best on larger screens.
              </Typography>
            </Stack>
          </Box>

          <Typography color="text.secondary">
            This release is designed to be usable, transparent, and stable in real team operations, while keeping bigger infrastructure and future expansion work for later versions.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2.5, justifyContent: "space-between" }}>
        <FormControlLabel
          control={(
            <Checkbox
              checked={dontShowAgain}
              onChange={(event) => onDontShowAgainChange(event.target.checked)}
            />
          )}
          label="Don't show me again"
        />

        <Button variant="contained" onClick={onContinue}>
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
}
import { alpha } from "@mui/material/styles";
