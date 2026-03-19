"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
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
import {
  numericTableCellSx,
  numericTableHeadCellSx
} from "@/app/components/common/tableCellStyles";
import { useAuth } from "@/app/context/AuthContext";
import { usePagination } from "@/app/hooks/usePagination";
import { formatName } from "@/app/services/formatname";
import { bridgeCurrentTeamPlayerIdentities } from "@/app/services/squadService";
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

type HistoricalCleanupStep = {
  key: string;
  title: string;
  detail: string;
  countLabel: string;
  tone: "success" | "warning";
};

type ReleaseLockItem = {
  key: string;
  title: string;
  detail: string;
};

const RELEASE_LOCK_CHECKS: ReleaseLockItem[] = [
  {
    key: "quality-gates",
    title: "Code quality gates are green",
    detail: "Release lock assumes the latest hardening pass is clean on TypeScript, ESLint, and production build output."
  },
  {
    key: "database-migrations",
    title: "V1 database migrations are applied",
    detail: "Confirm v1_team_rls.sql, v1_auth_access_control.sql, v1_user_profile_fields.sql, and v1_admin_player_mapping.sql are already applied in Supabase."
  },
  {
    key: "validation-scope",
    title: "Validation workspace is reviewed before release",
    detail: "Repair missing links, review ambiguous identities, confirm guest promotion candidates, and clear rulebook findings still in scope."
  },
  {
    key: "scope-control",
    title: "New work stays inside the locked V1 scope",
    detail: "Any new request must either support the release checklist directly or be held for the post-V1 backlog."
  }
];

const FUTURE_SCOPE_ITEMS = [
  "team creation flow",
  "invite flow",
  "join request flow",
  "full membership model refactor",
  "multi-team support",
  "expanded ownership hierarchy",
  "major auth product redesign",
  "new major modules",
  "non-blocking feature ideas"
] as const;

function MetricCard({ label, value, helper, icon, accent }: MetricCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        width: "100%",
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

function buildHistoricalCleanupSteps(snapshot: ValidationSnapshot): HistoricalCleanupStep[] {
  return [
    {
      key: "identity-links",
      title: "Repair missing player links first",
      detail: snapshot.metrics.missingPlayerLinks > 0
        ? "Run Repair Links, then recheck the missing-link list before changing anything else."
        : "Current-team player_id linkage is clean for the selected scope.",
      countLabel: `${snapshot.metrics.missingPlayerLinks} link issue${snapshot.metrics.missingPlayerLinks === 1 ? "" : "s"}`,
      tone: snapshot.metrics.missingPlayerLinks > 0 ? "warning" : "success"
    },
    {
      key: "duplicate-names",
      title: "Treat duplicate-name risks as manual review",
      detail: snapshot.metrics.duplicateNameRisks > 0
        ? "Do not auto-merge ambiguous historical names during V1. Confirm identity manually before any correction."
        : "No cross-team duplicate-name collisions are currently flagged.",
      countLabel: `${snapshot.metrics.duplicateNameRisks} name risk${snapshot.metrics.duplicateNameRisks === 1 ? "" : "s"}`,
      tone: snapshot.metrics.duplicateNameRisks > 0 ? "warning" : "success"
    },
    {
      key: "guest-candidates",
      title: "Promote repeated guests only when confirmed",
      detail: snapshot.metrics.guestPromotionCandidates > 0
        ? "Use guest promotion candidates as a review queue, not an automatic historical rewrite."
        : "No repeated guest records currently need squad-promotion review.",
      countLabel: `${snapshot.metrics.guestPromotionCandidates} guest candidate${snapshot.metrics.guestPromotionCandidates === 1 ? "" : "s"}`,
      tone: snapshot.metrics.guestPromotionCandidates > 0 ? "warning" : "success"
    },
    {
      key: "rulebook",
      title: "Fix saved-match rulebook findings before release lock",
      detail: snapshot.metrics.rulebookFindings > 0
        ? "Use the rulebook findings list to target saved matches that still need historical scorecard review."
        : "No saved-match rulebook findings are currently blocking release cleanup.",
      countLabel: `${snapshot.metrics.rulebookFindings} rule finding${snapshot.metrics.rulebookFindings === 1 ? "" : "s"}`,
      tone: snapshot.metrics.rulebookFindings > 0 ? "warning" : "success"
    }
  ];
}

export default function ValidationPage() {
  const { isAdmin } = useAuth();
  const [selectedSeason, setSelectedSeason] = useState("");
  const [snapshot, setSnapshot] = useState<ValidationSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRepairingLinks, setIsRepairingLinks] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const visibleIssueCount = snapshot
    ? snapshot.metrics.totalIssues
    : 0;
  const rulebookRowsPerPage = 5;
  const rulebookFindings = snapshot?.rulebookFindings ?? [];
  const historicalCleanupSteps = snapshot ? buildHistoricalCleanupSteps(snapshot) : [];
  const historicalCleanupOpenItems = historicalCleanupSteps.filter((step) => step.tone === "warning").length;
  const rulebookPagination = usePagination({
    items: rulebookFindings,
    pageSize: rulebookRowsPerPage,
    resetKeys: [selectedSeason, rulebookFindings.length]
  });

  const loadValidationSnapshot = useCallback(async (seasonValue: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextSnapshot = await getValidationSnapshot(
        !seasonValue || seasonValue === "all" ? undefined : seasonValue
      );
      setSnapshot(nextSnapshot);

      const storedSeason = readStoredSeasonFilter(VALIDATION_SEASON_STORAGE_KEY);
      const nextSeasonValues = new Set(nextSnapshot.seasons.map((season) => season.value));
      const resolvedSeason = seasonValue && (seasonValue === "all" || nextSeasonValues.has(seasonValue))
        ? seasonValue
        : storedSeason && nextSeasonValues.has(storedSeason)
          ? storedSeason
          : getLatestSeasonValue(nextSnapshot.seasons);

      setSelectedSeason((currentSeason) =>
        currentSeason === resolvedSeason ? currentSeason : resolvedSeason
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not load validation checks.";

      setSnapshot(null);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setSnapshot(null);
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsLoading(false);
      return;
    }

    void loadValidationSnapshot(selectedSeason);
  }, [isAdmin, loadValidationSnapshot, selectedSeason]);

  useEffect(() => {
    if (selectedSeason) {
      storeSeasonFilter(VALIDATION_SEASON_STORAGE_KEY, selectedSeason);
    }
  }, [selectedSeason]);

  const handleRepairLinks = async () => {
    try {
      setIsRepairingLinks(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const result = await bridgeCurrentTeamPlayerIdentities();
      await loadValidationSnapshot(selectedSeason);

      const repairedSummary = result.totalLinkedRows === 0
        ? "No missing player links needed repair."
        : `Repaired ${result.totalLinkedRows} missing player link${result.totalLinkedRows === 1 ? "" : "s"}.`;
      const ambiguousSummary = result.skippedAmbiguousNames.length > 0
        ? ` Skipped ${result.skippedAmbiguousNames.length} ambiguous squad name${result.skippedAmbiguousNames.length === 1 ? "" : "s"}.`
        : "";

      setSuccessMessage(`${repairedSummary}${ambiguousSummary}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not repair player identity links.";

      setErrorMessage(message);
    } finally {
      setIsRepairingLinks(false);
    }
  };

  return (
    <Container maxWidth="xl">
      <Stack spacing={4}>
        <TeamPageHeader
          eyebrow="Admin Workspace"
          title="Validation"
          description="High-signal checks for player linking, squad quality, and XI reconstruction."
          action={(
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: { xs: "100%", md: "auto" } }}>
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

              {isAdmin && (
                <Button
                  variant="outlined"
                  onClick={handleRepairLinks}
                  disabled={isLoading || isRepairingLinks}
                >
                  {isRepairingLinks ? "Repairing Links..." : "Repair Links"}
                </Button>
              )}
            </Stack>
          )}
        />

        {!isAdmin && (
          <Alert severity="info" variant="outlined">
            Validation workspace is available to admin users only.
          </Alert>
        )}

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {successMessage && <Alert severity="success">{successMessage}</Alert>}

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
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 3,
                alignItems: "stretch"
              }}
            >
              <Box sx={{ display: "flex" }}>
                <MetricCard
                  label="Total Issues"
                  value={visibleIssueCount}
                  helper="Visible validation findings in scope"
                  icon={<WarningAmberRoundedIcon />}
                  accent="#FF6B35"
                />
              </Box>

              <Box sx={{ display: "flex" }}>
                <MetricCard
                  label="Missing Links"
                  value={snapshot.metrics.missingPlayerLinks}
                  helper="Current-team rows missing player_id"
                  icon={<LinkOffRoundedIcon />}
                  accent="#E53935"
                />
              </Box>

              <Box sx={{ display: "flex" }}>
                <MetricCard
                  label="Name Risks"
                  value={snapshot.metrics.duplicateNameRisks}
                  helper="Moonwalkers names seen across team contexts"
                  icon={<PersonSearchRoundedIcon />}
                  accent="#7C3AED"
                />
              </Box>

              <Box sx={{ display: "flex" }}>
                <MetricCard
                  label="Guest Candidates"
                  value={snapshot.metrics.guestPromotionCandidates}
                  helper="Repeated guest players worth reviewing for squad promotion"
                  icon={<GroupWorkRoundedIcon />}
                  accent="#0F9D58"
                />
              </Box>

              <Box sx={{ display: "flex" }}>
                <MetricCard
                  label="Rulebook Findings"
                  value={snapshot.metrics.rulebookFindings}
                  helper="Saved matches that need cricket-rule review"
                  icon={<GavelRoundedIcon />}
                  accent="#1E40AF"
                />
              </Box>
            </Box>

            <Alert severity="info" variant="outlined">
              XI reconstruction diagnostics are hidden for now and tracked as future scope.
              {snapshot.metrics.xiWarnings > 0 ? ` ${snapshot.metrics.xiWarnings} hidden warning(s) remain in this scope.` : ""}
            </Alert>

            <Stack spacing={3}>
              <ValidationSectionCard
                title="Historical Cleanup Strategy"
                countLabel={historicalCleanupOpenItems > 0 ? `${historicalCleanupOpenItems} review steps open` : "Cleanup scope clear"}
                countTone={historicalCleanupOpenItems > 0 ? "warning" : "success"}
              >
                <Stack spacing={0}>
                  <Box sx={{ px: 3, pb: 2 }}>
                    <Typography color="text.secondary">
                      V1 cleanup stays targeted: repair links, review ambiguous names, confirm guest promotions, and avoid bulk historical rewrites or deletions during release hardening.
                    </Typography>
                  </Box>

                  {historicalCleanupSteps.map((step, index) => (
                    <Box key={step.key}>
                      {index > 0 && <Divider />}
                      <Box sx={{ px: 3, py: 2.25 }}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1.5}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", md: "center" }}
                        >
                          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                            <Typography fontWeight={700}>
                              {step.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {step.detail}
                            </Typography>
                          </Stack>

                          <Chip
                            label={step.countLabel}
                            color={step.tone}
                            size="small"
                            sx={{ flexShrink: 0 }}
                          />
                        </Stack>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </ValidationSectionCard>

              <ValidationSectionCard
                title="V1.0 Release Lock"
                countLabel="Scope locked"
                countTone="info"
              >
                <Stack spacing={0}>
                  <Box sx={{ px: 3, pb: 2 }}>
                    <Typography color="text.secondary">
                      V1 is now in release-lock mode. Ship only checklist work, blocker fixes, and production-safety changes. Everything else should move to future scope instead of stretching the release.
                    </Typography>
                  </Box>

                  {RELEASE_LOCK_CHECKS.map((item, index) => (
                    <Box key={item.key}>
                      {index > 0 && <Divider />}
                      <Box sx={{ px: 3, py: 2.25 }}>
                        <Stack spacing={0.5}>
                          <Typography fontWeight={700}>
                            {item.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.detail}
                          </Typography>
                        </Stack>
                      </Box>
                    </Box>
                  ))}

                  <Divider />

                  <Box sx={{ px: 3, py: 2.25 }}>
                    <Stack spacing={1.25}>
                      <Typography fontWeight={700}>
                        Post-V1 / Future Scope
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Keep these out of the V1 release branch unless one becomes a true blocker.
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {FUTURE_SCOPE_ITEMS.map((item) => (
                          <Chip key={item} label={item} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Stack>
                  </Box>
                </Stack>
              </ValidationSectionCard>

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
                        <TableCell sx={numericTableHeadCellSx}>Appearances</TableCell>
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
                          <TableCell sx={numericTableCellSx}>{item.appearances}</TableCell>
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
                        <TableCell sx={{ ...numericTableHeadCellSx, width: "14%" }}>Matches</TableCell>
                        <TableCell sx={{ ...numericTableHeadCellSx, width: "14%" }}>Bat</TableCell>
                        <TableCell sx={numericTableHeadCellSx}>Bowl</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {snapshot.guestPromotionCandidates.map((item) => (
                        <TableRow key={item.playerId}>
                          <TableCell>{formatName(item.playerName)}</TableCell>
                          <TableCell sx={numericTableCellSx}>{item.matchCount}</TableCell>
                          <TableCell sx={numericTableCellSx}>{item.battingMatches}</TableCell>
                          <TableCell sx={numericTableCellSx}>{item.bowlingMatches}</TableCell>
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
