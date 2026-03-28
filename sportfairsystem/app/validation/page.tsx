"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import PaginationFooter from "@/app/components/common/PaginationFooter";
import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import {
  numericTableCellSx,
  numericTableHeadCellSx
} from "@/app/components/common/tableCellStyles";
import { usePagination } from "@/app/hooks/usePagination";
import { useActiveTeamBranding } from "@/app/layout/useActiveTeamBranding";
import { canAccessValidationWorkspace, canManageValidationWorkspace } from "@/app/services/accessControlService";
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

type ScopeDetailItem = {
  key: string;
  title: string;
  detail: string;
};

type ProjectSummaryItem = {
  key: string;
  title: string;
  detail: string;
};

type ReleaseNotesSection = {
  key: string;
  title: string;
  intro: string;
  items: ScopeDetailItem[];
};

const RELEASE_LOCK_CHECKS: ReleaseLockItem[] = [
  {
    key: "quality-gates",
    title: "Code quality gates are green",
    detail: "Release lock assumes the latest hardening pass is clean on TypeScript, ESLint, and production build output."
  },
  {
    key: "database-migrations",
    title: "Core workspace data setup is ready",
    detail: "Confirm the release environment already has the required access, profile, and mapping support in place."
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

const PROJECT_SUMMARY_ITEMS: ProjectSummaryItem[] = [
  {
    key: "platform-state",
    title: "SportFairSystem is live as a stable internal V1.0 platform",
    detail: "The current release is a production-facing internal cricket operations system that connects scorecards, squad identity, planning, validation, analytics, and role-aware workflows in one place."
  },
  {
    key: "workflow-coverage",
    title: "The core team workflow is now connected end to end",
    detail: "V1.0 covers scorecard ingestion, squad management, planner support, player profiles, matches, dashboard, analytics, validation, and admin configuration within the current single-team operating model."
  },
  {
    key: "hardening-state",
    title: "The release moved from feature build-out to hardening and lock",
    detail: "This version reflects the late V1 hardening cycle: identity repair, safer planner matching, admin player-user mapping, auth and profile hardening, validation cleanup, responsive work, and release QA are now part of the shipped state."
  }
];

const V1_IMPLEMENTATION_ITEMS: ScopeDetailItem[] = [
  {
    key: "scorecards-and-data",
    title: "Scorecard ingestion and structured match storage",
    detail: "V1.0 imports cricket scorecards, parses innings and player activity, and saves match data into the core workspace with safer identity and save-time validation behavior."
  },
  {
    key: "identity-and-mapping",
    title: "Squad identity, player linkage, and admin user mapping",
    detail: "The release includes player_id-first squad identity handling, planner-safe matching, and an admin membership workspace to map authenticated users to squad players."
  },
  {
    key: "planner-and-workflows",
    title: "Planner workflows and match decision support",
    detail: "Attendance planning, lineup generation, bench visibility, and squad-aware player matching are part of the shipped V1 workflow for internal team operations."
  },
  {
    key: "profiles-dashboard-analytics",
    title: "Profiles, dashboard, analytics, matches, and validation",
    detail: "V1.0 includes player profiles, dashboard KPIs, analytics views, match detail views, validation tooling, and responsive hardening for the primary operational pages."
  },
  {
    key: "auth-and-roles",
    title: "Authentication, role-aware access, and admin-only workspaces",
    detail: "The live release supports sign-in flows, profile state handling, role-based workspace access, and protected admin surfaces such as Memberships and Validation."
  }
];

const FUTURE_SCOPE_DETAILS: ScopeDetailItem[] = [
  {
    key: "team-creation",
    title: "Team creation and onboarding flows",
    detail: "Self-serve team creation, invite setup, and first-time team onboarding are out of scope for the current internal single-team release."
  },
  {
    key: "membership-and-invites",
    title: "Invites, join requests, and membership lifecycle",
    detail: "Invite flows, join-request approval, and a full membership model refactor are deferred until after the stable internal V1 usage cycle."
  },
  {
    key: "multi-team-and-ownership",
    title: "Multi-team support and expanded ownership hierarchy",
    detail: "The current product is intentionally single-team. Cross-team switching, organization structures, and layered ownership controls remain future scope."
  },
  {
    key: "major-auth-redesign",
    title: "Major authentication or account product redesign",
    detail: "The app keeps the current role-aware auth model for V1. Broader account-system redesign, richer access products, or membership architecture changes are postponed."
  },
  {
    key: "new-major-modules",
    title: "New major modules and non-blocking product ideas",
    detail: "Large additions such as live scoring, tournament systems, advanced collaboration modules, and nice-to-have experiments should not enter the locked V1 branch."
  }
];

const V2_PROJECT_SUMMARY_ITEMS: ScopeDetailItem[] = [
  {
    key: "v2-platform-state",
    title: "SportFairSystem V2.0 is a role-aware team operations release",
    detail: "The current V2.0 direction expands the app from an internal scorecard platform into a team operations system centered on onboarding, memberships, planner continuity, fairness visibility, and organiser-player workflow split."
  },
  {
    key: "v2-team-core",
    title: "Team Core became the main operational foundation",
    detail: "V2.0 adds team-code-first onboarding, organiser approval, membership lifecycle management, identity linking, and workspace permissions as the practical release baseline."
  },
  {
    key: "v2-hardening",
    title: "Release work focused on hardening instead of feature sprawl",
    detail: "This version prioritizes permission cleanup, dashboard split, memberships usability, planner fairness continuity, match pipeline verification, and release QA over broad feature expansion."
  }
];

const V2_IMPLEMENTATION_ITEMS: ScopeDetailItem[] = [
  {
    key: "v2-onboarding",
    title: "Team-code-first onboarding and join-request review",
    detail: "Join requests, organiser approval, duplicate-member review, and role assignment are part of the practical V2.0 release path."
  },
  {
    key: "v2-memberships",
    title: "Memberships as the operational team-admin workspace",
    detail: "Membership management now covers role, status, season, linked user, linked player, external names, and inline player metadata editing inside one admin flow."
  },
  {
    key: "v2-permissions",
    title: "Permission-aware workspace and RLS hardening",
    detail: "Legacy admin-only assumptions were reduced across shell navigation, feedback, identity, memberships, and match pipeline access, supported by the Phase 11-13 migration path."
  },
  {
    key: "v2-dashboard",
    title: "Split dashboard experience for organisers and players",
    detail: "The dashboard now supports Team View and My View so organisers get team-performance visibility while players get personal opportunity, fairness, and planner context."
  },
  {
    key: "v2-planner-fairness",
    title: "Planner and fairness continuity for release",
    detail: "Friendly planner logic now includes previous actual opportunity correction, and fairness visibility is carried across organiser and self-service views."
  }
];

const V2_RELEASE_GATES: ScopeDetailItem[] = [
  {
    key: "v2-schema-gate",
    title: "Production must be migrated through Phase 13",
    detail: "The target Supabase environment must include the V2 permission-aware migration set before release is considered production-safe."
  },
  {
    key: "v2-build-gate",
    title: "TypeScript, lint, and build must stay green",
    detail: "Release signoff assumes branch-wide verification passes on the final release branch immediately before deployment."
  },
  {
    key: "v2-smoke-gate",
    title: "Organiser, player, upload, planner, and fairness smoke flows must be green",
    detail: "The release requires successful organiser and player workspace checks, parser-preview validation, saved-match verification, and no critical console or network failures."
  },
  {
    key: "v2-post-deploy-gate",
    title: "Post-deploy smoke is mandatory before final go-live signoff",
    detail: "Login, dashboard, memberships, upload, matches, planner, fairness, analytics, and validation must be rechecked after deployment."
  }
];

const V2_FUTURE_SCOPE_DETAILS: ScopeDetailItem[] = [
  {
    key: "v2-events",
    title: "Events and RSVP remain future scope",
    detail: "Event workflows are intentionally held out of the narrowed V2.0 release and should not block signoff."
  },
  {
    key: "v2-social",
    title: "Posts, polls, and comments remain future scope",
    detail: "Communication modules are moved to the future roadmap and are not part of the practical V2.0 go-live baseline."
  },
  {
    key: "v2-fresh-insert",
    title: "A fresh unseen PDF test is still recommended before the final production go decision",
    detail: "Current smoke testing confirmed parser preview, duplicate detection, and saved-match lookup, but one brand-new unseen insert remains the best final confidence check."
  }
];

const RELEASE_NOTES_BY_VERSION: Array<{
  key: string;
  title: string;
  badgeLabel: string;
  intro: string;
  sections: ReleaseNotesSection[];
}> = [
  {
    key: "v1-release-notes",
    title: "V1.0 Release Note",
    badgeLabel: "Locked",
    intro: "V1.0 is live and locked. This note captures what V1 shipped, what hardening work defined the release, and what was deliberately kept out of the locked branch.",
    sections: [
      {
        key: "v1-summary",
        title: "Current Project Summary",
        intro: "This gives the present-day picture of what happened in V1.0 and where the project stands now.",
        items: PROJECT_SUMMARY_ITEMS
      },
      {
        key: "v1-implementation",
        title: "Current V1.0 Implementation",
        intro: "This is the shipped scope that V1.0 is intended to support in production today.",
        items: V1_IMPLEMENTATION_ITEMS
      },
      {
        key: "v1-future",
        title: "Post-V1 / Future Scope",
        intro: "These items are intentionally deferred and should stay out of the locked release branch unless one becomes a real production blocker.",
        items: FUTURE_SCOPE_DETAILS
      },
      {
        key: "v1-lock",
        title: "Release Lock",
        intro: "These rules explain how the branch should be treated after the V1.0 release and what qualifies as acceptable work.",
        items: RELEASE_LOCK_CHECKS
      }
    ]
  },
  {
    key: "v2-release-notes",
    title: "V2.0 Release Note",
    badgeLabel: "Near-Go",
    intro: "V2.0 is the narrowed team-operations release focused on memberships, onboarding, permissions, dashboard split, planner continuity, fairness visibility, and release hardening.",
    sections: [
      {
        key: "v2-summary",
        title: "Current Project Summary",
        intro: "This is the practical V2.0 position based on the current repository release path.",
        items: V2_PROJECT_SUMMARY_ITEMS
      },
      {
        key: "v2-implementation",
        title: "Current V2.0 Implementation",
        intro: "These are the major release-facing capabilities that now define the V2.0 product baseline.",
        items: V2_IMPLEMENTATION_ITEMS
      },
      {
        key: "v2-release-gates",
        title: "Release Signoff Gate",
        intro: "These are the conditions that still define the final production go decision for V2.0.",
        items: V2_RELEASE_GATES
      },
      {
        key: "v2-future",
        title: "Future Scope / Final Caveats",
        intro: "These items remain outside the narrowed V2.0 release or are still recommended validation steps before final production go-live.",
        items: V2_FUTURE_SCOPE_DETAILS
      }
    ]
  }
];

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

function ReleaseNotesAccordion({
  title,
  badgeLabel,
  intro,
  sections,
  defaultExpanded = false
}: {
  title: string;
  badgeLabel: string;
  intro: string;
  sections: ReleaseNotesSection[];
  defaultExpanded?: boolean;
}) {
  return (
    <Accordion
      disableGutters
      defaultExpanded={defaultExpanded}
      elevation={0}
      sx={{
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        "&::before": {
          display: "none"
        }
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreRoundedIcon />}
        sx={{
          px: 3,
          py: 1.5,
          backgroundColor: "background.paper",
          "& .MuiAccordionSummary-content": {
            my: 0
          }
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          sx={{ width: "100%" }}
        >
          <Typography fontWeight={800}>
            {title}
          </Typography>
          <Chip label={badgeLabel} color="info" size="small" />
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ px: 0, py: 0 }}>
        <Stack spacing={0}>
          <Box sx={{ px: 3, py: 2.25 }}>
            <Typography color="text.secondary">
              {intro}
            </Typography>
          </Box>

          {sections.map((section, sectionIndex) => (
            <Box key={section.key}>
              {sectionIndex > 0 && <Divider />}
              <Box sx={{ px: 3, py: 2.25 }}>
                <Stack spacing={1.25}>
                  <Typography fontWeight={700}>
                    {section.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {section.intro}
                  </Typography>
                </Stack>
              </Box>

              {section.items.map((item) => (
                <Box key={item.key}>
                  <Divider />
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
            </Box>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
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
  const { teamName } = useActiveTeamBranding();
  const [canAccessWorkspace, setCanAccessWorkspace] = useState<boolean | null>(null);
  const [canManageWorkspace, setCanManageWorkspace] = useState(false);
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
    let isActive = true;

    const loadValidationAccess = async () => {
      try {
        const [nextCanAccessWorkspace, nextCanManageWorkspace] = await Promise.all([
          canAccessValidationWorkspace(),
          canManageValidationWorkspace()
        ]);

        if (isActive) {
          setCanAccessWorkspace(nextCanAccessWorkspace);
          setCanManageWorkspace(nextCanManageWorkspace);
        }
      } catch {
        if (isActive) {
          setCanAccessWorkspace(false);
          setCanManageWorkspace(false);
        }
      }
    };

    void loadValidationAccess();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!canAccessWorkspace) {
      setSnapshot(null);
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsLoading(false);
      return;
    }

    void loadValidationSnapshot(selectedSeason);
  }, [canAccessWorkspace, loadValidationSnapshot, selectedSeason]);

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

              {canManageWorkspace && (
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

        {canAccessWorkspace === false && (
          <AutoHideAlert severity="info" variant="outlined">
            Validation is available to organisers, captains, or members with stats or identity access.
          </AutoHideAlert>
        )}

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {successMessage && (
          <AutoHideAlert severity="success" resetKey={successMessage}>
            {successMessage}
          </AutoHideAlert>
        )}

        {canAccessWorkspace && isLoading ? (
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
        ) : canAccessWorkspace && snapshot ? (
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
                  helper={`${teamName} names seen across team contexts`}
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

            <AutoHideAlert severity="info" variant="outlined">
              XI reconstruction diagnostics are hidden for now and tracked as future scope.
              {snapshot.metrics.xiWarnings > 0 ? ` ${snapshot.metrics.xiWarnings} hidden warning(s) remain in this scope.` : ""}
            </AutoHideAlert>

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
                title="Release Notes"
                countLabel="V1.0 + V2.0"
                countTone="info"
              >
                <Stack spacing={2} sx={{ px: 3, pb: 3 }}>
                  <Box sx={{ px: 3, pb: 2 }}>
                    <Typography color="text.secondary">
                      Keep V1.0 as the locked historical baseline and use V2.0 as the active release signoff note for the current team-operations release.
                    </Typography>
                  </Box>

                  {RELEASE_NOTES_BY_VERSION.map((releaseNotes, index) => (
                    <ReleaseNotesAccordion
                      key={releaseNotes.key}
                      title={releaseNotes.title}
                      badgeLabel={releaseNotes.badgeLabel}
                      intro={releaseNotes.intro}
                      sections={releaseNotes.sections}
                      defaultExpanded={index === 1}
                    />
                  ))}
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
                              No cross-team name collisions found for current-team players.
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
