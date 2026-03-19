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
    title: "Scorecard Ingestion",
    detail: "Upload and parse cricket scorecards into structured match data."
  },
  {
    title: "Squad & Player Management",
    detail: "Build and manage your team with identity-linked player profiles."
  },
  {
    title: "Player Intelligence & Analytics",
    detail: "Track performance, trends, and usage across matches and seasons."
  },
  {
    title: "Planner Workflows",
    detail: "Plan matches using attendance data, generate Playing XI, and manage bench decisions."
  },
  {
    title: "Validation & Data Integrity",
    detail: "Detect missing links, duplicates, and inconsistencies with built-in validation tools."
  },
  {
    title: "Authentication & Role-Based Access",
    detail: "Secure, role-aware system with admin controls and protected workflows."
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
            After months of building, refining, and real-world validation, SportFairSystem v1.0 is live, stable, and ready for real usage.
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          <Typography color="text.secondary">
            SportFairSystem started as a simple scorecard parser. Today, it has evolved into a complete, role-aware team system that connects match data, player insights, and team decision-making into one unified platform.
          </Typography>

          <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              What SportFairSystem v1.0 offers
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
              SportFairSystem is currently designed as an internal platform for real team workflows, with a focus on simplicity, transparency, and data-driven decisions.
            </Typography>
          </Stack>

          <Stack spacing={1}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Version 1.0 Scope
            </Typography>
            <Typography color="text.secondary">
              This release is intentionally focused and stable. Features like multi-team support, live scoring, and tournament management are planned for future versions.
            </Typography>
          </Stack>

          <Stack spacing={1}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Why this matters
            </Typography>
            <Typography color="text.secondary">
              Most amateur teams rely on scattered tools or manual tracking. SportFairSystem brings everything together:
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
                SportFairSystem is responsive across desktop, tablet, and mobile, but the best experience is still on desktop or larger tablet screens. A few dense analytics and admin workflows may feel tighter on smaller phones.
              </Typography>
            </Stack>
          </Box>

          <Typography color="text.secondary">
            This is just the beginning. More to come.
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
