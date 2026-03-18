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
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";

import PaginationFooter from "@/app/components/common/PaginationFooter";
import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import { useAuth } from "@/app/context/AuthContext";
import { usePagination } from "@/app/hooks/usePagination";
import { formatName } from "@/app/services/formatname";
import {
  getValidationSnapshot,
  ValidationSnapshot
} from "@/app/services/validationService";
import { formatDate } from "@/app/utils/formatDate";
import { getLatestSeasonValue } from "@/app/utils/seasonSelection";
import { readStoredSeasonFilter, storeSeasonFilter } from "@/app/utils/seasonFilterStorage";

const VALIDATION_SEASON_STORAGE_KEY = "sportfairsystem:season-filter:validation";

type MetricCardProps = {
  label: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
  accent: string;
};

type ValidationSectionCardProps = {
  title: string;
  countLabel: string;
  countTone: "success" | "error" | "warning" | "info";
  children: React.ReactNode;
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

function ValidationSectionCard({
  title,
  countLabel,
  countTone,
  children
}: ValidationSectionCardProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: 0 }}>
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="h5">{title}</Typography>
            <Chip label={countLabel} color={countTone} size="small" />
          </Stack>
        </Box>

        {children}
      </CardContent>
    </Card>
  );
}

export default function ValidationPage() {
  const { isAdmin } = useAuth();
  const [selectedSeason, setSelectedSeason] = useState("");
  const [snapshot, setSnapshot] = useState<ValidationSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const visibleIssueCount = snapshot
    ? snapshot.metrics.missingPlayerLinks
      + snapshot.metrics.duplicateNameRisks
      + snapshot.metrics.guestPromotionCandidates
      + snapshot.metrics.rulebookFindings
    : 0;
  const rulebookRowsPerPage = 5;
  const rulebookFindings = snapshot?.rulebookFindings ?? [];
  const rulebookPagination = usePagination({
    items: rulebookFindings,
    pageSize: rulebookRowsPerPage,
    resetKeys: [selectedSeason, rulebookFindings.length]
  });

  useEffect(() => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }

    const loadValidation = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextSnapshot = await getValidationSnapshot(
          !selectedSeason || selectedSeason === "all" ? undefined : selectedSeason
        );
        setSnapshot(nextSnapshot);
        const storedSeason = readStoredSeasonFilter(VALIDATION_SEASON_STORAGE_KEY);
        const nextSeasonValues = new Set(nextSnapshot.seasons.map((season) => season.value));
        const resolvedSeason = storedSeason && nextSeasonValues.has(storedSeason)
          ? storedSeason
          : getLatestSeasonValue(nextSnapshot.seasons);
        setSelectedSeason((currentSeason) =>
          currentSeason || resolvedSeason
        );
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
  }, [isAdmin, selectedSeason]);

  useEffect(() => {
    if (selectedSeason) {
      storeSeasonFilter(VALIDATION_SEASON_STORAGE_KEY, selectedSeason);
    }
  }, [selectedSeason]);

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
                value={selectedSeason || "all"}
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

        {!isAdmin && (
          <Alert severity="info" variant="outlined">
            Validation workspace is available to admin users only.
          </Alert>
        )}

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        {isAdmin && isLoading ? (
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
        ) : isAdmin && snapshot ? (
          <>
            <Grid container spacing={3} alignItems="stretch">
              <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                <MetricCard
                  label="Total Issues"
                  value={visibleIssueCount}
                  helper="Visible validation findings in scope"
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
                  helper="Repeated guest players worth reviewing for squad promotion"
                  icon={<GroupWorkRoundedIcon />}
                  accent="#0F9D58"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                <MetricCard
                  label="Rulebook Findings"
                  value={snapshot.metrics.rulebookFindings}
                  helper="Saved matches that need cricket-rule review"
                  icon={<GavelRoundedIcon />}
                  accent="#1E40AF"
                />
              </Grid>
            </Grid>

            <Alert severity="info" variant="outlined">
              XI reconstruction diagnostics are hidden for now and tracked as future scope.
              {snapshot.metrics.xiWarnings > 0 ? ` ${snapshot.metrics.xiWarnings} hidden warning(s) remain in this scope.` : ""}
            </Alert>

            <Stack spacing={3}>
              <ValidationSectionCard
                title="Missing Player Links"
                countLabel={`${snapshot.missingPlayerLinks.length} issues`}
                countTone={snapshot.missingPlayerLinks.length > 0 ? "error" : "success"}
              >
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: "18%" }}>Match</TableCell>
                        <TableCell sx={{ width: "16%" }}>Opponent</TableCell>
                        <TableCell sx={{ width: "18%" }}>Player</TableCell>
                        <TableCell sx={{ width: "12%" }}>Source</TableCell>
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
              </ValidationSectionCard>

              <ValidationSectionCard
                title="Cricket Rulebook Findings"
                countLabel={`${snapshot.rulebookFindings.length} findings`}
                countTone={snapshot.rulebookFindings.length > 0 ? "info" : "success"}
              >
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: "18%" }}>Match</TableCell>
                        <TableCell sx={{ width: "12%" }}>Severity</TableCell>
                        <TableCell>Finding</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rulebookPagination.paginatedItems.map((item, index) => (
                        <TableRow key={`${item.matchId}-${item.title}-${index}`}>
                          <TableCell>
                            <Stack spacing={0.25}>
                              <Typography fontWeight={700}>
                                {item.matchCode ?? "Unknown Match"}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {item.matchDate ? formatDate(item.matchDate) : "Date unavailable"}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {item.opponentName ?? "Unknown Opponent"}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={item.severity.toUpperCase()}
                              color={item.severity === "error" ? "error" : item.severity === "warning" ? "warning" : "info"}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.35}>
                              <Typography fontWeight={700}>
                                {item.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {item.rulebookName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {item.detail}
                              </Typography>
                              <Typography variant="body2">
                                Suggested action: {item.recommendation}
                              </Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}

                      {rulebookFindings.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3}>
                            <Typography color="text.secondary">
                              No saved-match rulebook findings are currently flagged in this scope.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {rulebookFindings.length > 0 && (
                  <PaginationFooter
                    pageStart={rulebookPagination.pageStart}
                    pageEnd={rulebookPagination.pageEnd}
                    totalCount={rulebookPagination.totalCount}
                    hasPreviousPage={rulebookPagination.hasPreviousPage}
                    hasNextPage={rulebookPagination.hasNextPage}
                    onPrevious={rulebookPagination.goToPreviousPage}
                    onNext={rulebookPagination.goToNextPage}
                    sx={{ px: 3, py: 2 }}
                  />
                )}
              </ValidationSectionCard>

              <ValidationSectionCard
                title="Duplicate-Name Risks"
                countLabel={`${snapshot.duplicateNameRisks.length} risks`}
                countTone={snapshot.duplicateNameRisks.length > 0 ? "warning" : "success"}
              >
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: "30%" }}>Name</TableCell>
                        <TableCell sx={{ width: "38%" }}>Teams</TableCell>
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
              </ValidationSectionCard>

              <ValidationSectionCard
                title="Guest Promotion Candidates"
                countLabel={`${snapshot.guestPromotionCandidates.length} players`}
                countTone={snapshot.guestPromotionCandidates.length > 0 ? "info" : "success"}
              >
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: "34%" }}>Player</TableCell>
                        <TableCell sx={{ width: "14%" }}>Matches</TableCell>
                        <TableCell sx={{ width: "14%" }}>Bat</TableCell>
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
                            <Stack spacing={0.35}>
                              <Typography color="text.secondary">
                                No guest players currently stand out as promotion candidates.
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Candidates appear here after repeated match involvement, not from one-off guest appearances.
                              </Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </ValidationSectionCard>
            </Stack>
          </>
        ) : null}
      </Stack>
    </Container>
  );
}
