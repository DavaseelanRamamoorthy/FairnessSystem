'use client';

import {
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
} from "@mui/material";

type MatchSummaryProps = {
  match: any;
  isSelected: boolean;
  onClick: () => void;
};

export default function MatchSummaryCard({
  match,
  isSelected,
  onClick,
}: MatchSummaryProps) {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: "pointer",
        border: isSelected ? "2px solid" : "1px solid transparent",
        borderColor: isSelected ? "primary.main" : "divider",
        transition: "all 0.2s ease",
        "&:hover": {
          borderColor: "primary.main",
        },
      }}
    >
      <CardContent>
        <Stack spacing={1}>
          
          {/* Opponent */}
          <Typography variant="h6">
            vs {match.opponent_name}
          </Typography>

          {/* Match Date */}
          <Typography variant="body2" color="text.secondary">
            {match.match_date}
          </Typography>

          {/* Result Chip */}
          <Chip
            label={match.result === "Won" ? "Won" : "Lost"}
            color={match.result === "Won" ? "success" : "error"}
            size="small"
            sx={{ width: "fit-content", mt: 1 }}
          />

        </Stack>
      </CardContent>
    </Card>
  );
}