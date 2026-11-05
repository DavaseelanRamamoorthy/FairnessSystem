import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { DEFAULT_RULES } from "@/src/engine";

// Placeholder until the v3 screens land (build order step 3+).
export default function HomePage() {
  const w = DEFAULT_RULES.battingWeights;
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Stack spacing={2}>
        <Typography variant="h4">Moonwalkers</Typography>
        <Typography color="text.secondary">
          v3 is being rebuilt. How fair chances will be counted:
        </Typography>
        <Typography component="ul" sx={{ pl: 3 }}>
          <li>Selection: every paid player who confirms on Spond before the deadline is owed an equal share of the {DEFAULT_RULES.xiSize} places.</li>
          <li>Batting: top-order slots count {w.top}, middle {w.middle}, lower {w.lower}; the order rotates toward whoever is owed most, within each player&apos;s preference.</li>
          <li>Bowling: overs are shared between the bowlers in the XI.</li>
          <li>Late answers only fill gaps. Unpaid members are not selected.</li>
        </Typography>
      </Stack>
    </Container>
  );
}
