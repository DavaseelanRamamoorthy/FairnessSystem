"use client";

import { useEffect, useState } from "react";

import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import GroupWorkRoundedIcon from "@mui/icons-material/GroupWorkRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import { useViewMode } from "@/app/context/ViewModeContext";
import { formatName } from "@/app/services/formatname";
import {
  getValidationSnapshot,
  ValidationSnapshot
} from "@/app/services/validationService";
import { formatDate } from "@/app/utils/formatDate";

type MetricCardProps = {
  label: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
  accent: string;
};

function MetricCard({ label, value, helper, icon, accent }: MetricCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        borderColor: "divider",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)"
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: accent,
                  backgroundColor: `${accent}18`
                }}
              >
                {icon}
              </Box>

              <Typography variant="subtitle2" color="text.secondary">
                {label}
              </Typography>
            </Stack>

            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: accent,
                boxShadow: `0 0 0 5px ${accent}22`
              }}
            />
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1 }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {helper}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function ValidationPage() {
  const { isAdminMode } = useViewMode();
  const [selectedSeason, setSelectedSeason] = useState("all");
  const [snapshot, setSnapshot] = useState<ValidationSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const visibleIssueCount = snapshot
    ? snapshot.metrics.missingPlayerLinks
      + snapshot.metrics.duplicateNameRisks
      + snapshot.metrics.guestPromotionCandidates
    : 0;

  useEffect(() => {
    if (!isAdminMode) {
      setIsLoading(false);
      return;
    }

    const loadValidation = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextSnapshot = await getValidationSnapshot(
          selectedSeason === "all" ? undefined : selectedSeason
        );
        setSnapshot(nextSnapshot);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not load validation checks.";

        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadValidation();
  }, [isAdminMode, selectedSeason]);

  return (
    <Container maxWidth="xl">
      <Stack spacing={4}>
        <TeamPageHeader
          eyebrow="Admin Workspace"
          title="Validation"
          description="High-signal checks for player linking, squad quality, and XI reconstruction."
          action={(
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="validation-season-filter-label">Season</InputLabel>
              <Select
                labelId="validation-season-filter-label"
                value={selectedSeason}
                label="Season"
                onChange={(event) => setSelectedSeason(event.target.value)}
              >
                <MenuItem value="all">All Seasons</MenuItem>
                {snapshot?.seasons.map((season) => (
                  <MenuItem key={season.value} value={season.value}>
                    {season.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        {!isAdminMode && (
          <Alert severity="info" variant="outlined">
            Validation workspace is available in Admin Mode only. Switch the topbar toggle back to
            Admin Mode to review data quality issues.
          </Alert>
        )}

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        {isAdminMode && isLoading ? (
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
        ) : isAdminMode && snapshot ? (
          <>
            <Grid container spacing={3} alignItems="stretch">
              <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                <MetricCard
                  label="Total Issues"
                  value={visibleIssueCount}
                  helper="Active validation findings in scope"
                  icon={<WarningAmberRoundedIcon />}
                  accent="#FF6B35"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                <MetricCard
                  label="Missing Links"
                  value={snapshot.metrics.missingPlayerLinks}
                  helper="Current-team rows missing player_id"
                  icon={<LinkOffRoundedIcon />}
                  accent="#E53935"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                <MetricCard
                  label="Name Risks"
                  value={snapshot.metrics.duplicateNameRisks}
                  helper="Moonwalkers names seen across team contexts"
                  icon={<PersonSearchRoundedIcon />}
                  accent="#7C3AED"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                <MetricCard
                  label="Guest Candidates"
                  value={snapshot.metrics.guestPromotionCandidates}
                  helper="Guest players worth reviewing for squad promotion"
                  icon={<GroupWorkRoundedIcon />}
                  accent="#0F9D58"
                />
              </Grid>
            </Grid>

            <Alert severity="info" variant="outlined">
              XI reconstruction diagnostics are hidden for now and tracked as future scope.
            </Alert>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, lg: 7 }}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 0 }}>
                    <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Typography variant="h5">Missing Player Links</Typography>
                        <Chip
                          label={`${snapshot.missingPlayerLinks.length} issues`}
                          color={snapshot.missingPlayerLinks.length > 0 ? "error" : "success"}
                          size="small"
                        />
                      </Stack>
                    </Box>

                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Match</TableCell>
                            <TableCell>Opponent</TableCell>
                            <TableCell>Player</TableCell>
                            <TableCell>Source</TableCell>
                            <TableCell>Issue</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {snapshot.missingPlayerLinks.map((item, index) => (
                            <TableRow key={`${item.matchId}-${item.playerName}-${item.source}-${index}`}>
                              <TableCell>
                                <Stack spacing={0.25}>
                                  <Typography fontWeight={700}>
                                    {item.matchCode ?? "Unknown Match"}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {item.matchDate ? formatDate(item.matchDate) : "Date unavailable"}
                                  </Typography>
                                </Stack>
                              </TableCell>
                              <TableCell>{item.opponentName ?? "Unknown Opponent"}</TableCell>
                              <TableCell>{formatName(item.playerName)}</TableCell>
                              <TableCell>{item.source}</TableCell>
                              <TableCell>{item.detail}</TableCell>
                            </TableRow>
                          ))}

                          {snapshot.missingPlayerLinks.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5}>
                                <Typography color="text.secondary">
                                  No missing current-team player_id links found in this scope.
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, lg: 5 }}>
                <Stack spacing={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 0 }}>
                      <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Typography variant="h5">Duplicate-Name Risks</Typography>
                          <Chip
                            label={`${snapshot.duplicateNameRisks.length} risks`}
                            color={snapshot.duplicateNameRisks.length > 0 ? "warning" : "success"}
                            size="small"
                          />
                        </Stack>
                      </Box>

                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Name</TableCell>
                              <TableCell>Teams</TableCell>
                              <TableCell>Appearances</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {snapshot.duplicateNameRisks.map((item) => (
                              <TableRow key={item.normalizedName}>
                                <TableCell>
                                  <Stack spacing={0.25}>
                                    <Typography fontWeight={700}>
                                      {formatName(item.displayName)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {item.note}
                                    </Typography>
                                  </Stack>
                                </TableCell>
                                <TableCell>{item.teams.map(formatName).join(", ")}</TableCell>
                                <TableCell>{item.appearances}</TableCell>
                              </TableRow>
                            ))}

                            {snapshot.duplicateNameRisks.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={3}>
                                  <Typography color="text.secondary">
                                    No cross-team name collisions found for Moonwalkers players.
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>

                  <Card variant="outlined">
                    <CardContent sx={{ p: 0 }}>
                      <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Typography variant="h5">Guest Promotion Candidates</Typography>
                          <Chip
                            label={`${snapshot.guestPromotionCandidates.length} players`}
                            color={snapshot.guestPromotionCandidates.length > 0 ? "info" : "success"}
                            size="small"
                          />
                        </Stack>
                      </Box>

                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Player</TableCell>
                              <TableCell>Matches</TableCell>
                              <TableCell>Bat</TableCell>
                              <TableCell>Bowl</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {snapshot.guestPromotionCandidates.map((item) => (
                              <TableRow key={item.playerId}>
                                <TableCell>{formatName(item.playerName)}</TableCell>
                                <TableCell>{item.matchCount}</TableCell>
                                <TableCell>{item.battingMatches}</TableCell>
                                <TableCell>{item.bowlingMatches}</TableCell>
                              </TableRow>
                            ))}

                            {snapshot.guestPromotionCandidates.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={4}>
                                  <Typography color="text.secondary">
                                    No guest players currently stand out as promotion candidates.
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Stack>
              </Grid>
            </Grid>
          </>
        ) : null}
      </Stack>
    </Container>
  );
}
