"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
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
  TextField,
  Typography
} from "@mui/material";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import CreatePlayerIconButton from "@/app/components/common/CreatePlayerIconButton";
import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import PlayerRosterDialog, { CreateRosterPlayerValues } from "@/app/components/players/PlayerRosterDialog";
import {
  canAccessMembershipWorkspace,
  canManageMembershipRecords,
  canManageMembershipRoles,
  canManageRosterPlayers,
  canManageTeamInvites
} from "@/app/services/accessControlService";
import { formatName } from "@/app/services/formatname";
import {
  ApproveTeamJoinRequestInput,
  approveTeamJoinRequest,
  listPendingTeamJoinRequests,
  rejectTeamJoinRequest,
  TeamJoinRequestRecord
} from "@/app/services/teamJoinRequestService";
import {
  canManageExternalNames,
  createTeamMemberAlias,
  createMembershipSeason,
  deleteTeamMemberAlias,
  getMembershipSeasons,
  getTeamMembershipRecords,
  getTeamMembershipPlayerOptions,
  getTeamMembershipUserOptions,
  hasMembershipFoundationSupport,
  MembershipSeasonRecord,
  TeamMembershipPlayerOption,
  TeamMembershipRecord,
  TeamMembershipRole,
  TeamMembershipUserOption,
  TeamMembershipStatus,
  updateTeamMembershipLinkedPlayer,
  updateTeamMemberAlias,
  updateTeamMembershipRole,
  updateTeamMembershipLinkedUser,
  updateTeamMembershipSeason,
  updateTeamMembershipStatus
} from "@/app/services/membershipService";
import { SeasonOption } from "@/app/services/playerProfileService";
import {
  bridgeCurrentTeamPlayerIdentities,
  createLinkedPlayerForMember,
  createSquadPlayer,
  primarySquadRoleTagOptions,
  squadRoleTagOptions,
  updateSquadPlayerMetadata
} from "@/app/services/squadService";
import {
  getTeamBusinessRoleLabel,
  TEAM_BUSINESS_ROLE_OPTIONS
} from "@/app/services/teamRoles";

function MetricCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <Card variant="outlined" sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={0.75}>
          <Typography variant="subtitle2" color="text.secondary">{label}</Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1 }}>{value}</Typography>
          <Typography variant="body2" color="text.secondary">{helper}</Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function normalizeExternalNameInput(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeMembershipMatchValue(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function buildMembershipSearchIndex(membership: TeamMembershipRecord) {
  return [
    membership.name,
    membership.userDisplayName,
    membership.userEmail,
    membership.playerName,
    membership.seasonName,
    ...membership.aliases.map((alias) => alias.alias)
  ]
    .map((value) => normalizeMembershipMatchValue(value))
    .filter(Boolean)
    .join(" ");
}

function tokenizeMembershipMatchValue(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function getEmailHandle(email: string | null | undefined) {
  const normalizedEmail = (email ?? "").trim().toLowerCase();

  if (!normalizedEmail.includes("@")) {
    return normalizedEmail;
  }

  return normalizedEmail.split("@")[0] ?? "";
}

type ExistingMemberSuggestion = {
  membership: TeamMembershipRecord;
  score: number;
  reasons: string[];
  isStrong: boolean;
};

function getExistingMemberSuggestions(
  request: TeamJoinRequestRecord | null,
  memberships: TeamMembershipRecord[]
): ExistingMemberSuggestion[] {
  if (!request) {
    return [];
  }

  const normalizedRequesterName = normalizeMembershipMatchValue(request.requesterName);
  const requesterNameTokens = tokenizeMembershipMatchValue(request.requesterName);
  const normalizedRequesterEmailHandle = normalizeMembershipMatchValue(getEmailHandle(request.requesterEmail));

  return memberships
    .map((membership) => {
      const normalizedMemberName = normalizeMembershipMatchValue(membership.name);
      const membershipNameTokens = tokenizeMembershipMatchValue(membership.name);
      const aliasValues = membership.aliases
        .map((alias) => alias.alias)
        .filter((alias) => normalizeMembershipMatchValue(alias) !== normalizedMemberName);
      const normalizedAliasValues = aliasValues.map((alias) => normalizeMembershipMatchValue(alias));

      let score = 0;
      const reasons: string[] = [];
      let isStrong = false;

      if (normalizedRequesterName && normalizedRequesterName === normalizedMemberName) {
        score += 160;
        reasons.push("Exact member name match");
        isStrong = true;
      }

      if (normalizedRequesterName && normalizedAliasValues.includes(normalizedRequesterName)) {
        score += 150;
        reasons.push("Exact alias match");
        isStrong = true;
      }

      if (
        normalizedRequesterEmailHandle
        && (normalizedRequesterEmailHandle === normalizedMemberName
          || normalizedAliasValues.includes(normalizedRequesterEmailHandle))
      ) {
        score += 80;
        reasons.push("Email handle matches member name");
      }

      if (
        !isStrong
        && normalizedRequesterName
        && normalizedMemberName
        && (
          normalizedMemberName.includes(normalizedRequesterName)
          || normalizedRequesterName.includes(normalizedMemberName)
        )
      ) {
        score += 45;
        reasons.push("Very similar member name");
      }

      const sharedNameTokens = requesterNameTokens.filter((token) => membershipNameTokens.includes(token));
      if (!isStrong && sharedNameTokens.length >= 2) {
        score += 35;
        reasons.push("Shared name parts");
      }

      if (score === 0) {
        return null;
      }

      return {
        membership,
        score,
        reasons: Array.from(new Set(reasons)),
        isStrong
      } satisfies ExistingMemberSuggestion;
    })
    .filter((candidate): candidate is ExistingMemberSuggestion => Boolean(candidate))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.membership.name.localeCompare(right.membership.name);
    });
}

type JoinRequestManagementSectionProps = {
  joinRequests: TeamJoinRequestRecord[];
  memberships: TeamMembershipRecord[];
  seasons: MembershipSeasonRecord[];
  onJoinRequestApproved: (requestId: string) => void;
  onJoinRequestRejected: (requestId: string) => void;
  onErrorMessage: (message: string | null) => void;
  onSuccessMessage: (message: string | null) => void;
};

function JoinRequestManagementSection({
  joinRequests,
  memberships,
  seasons,
  onJoinRequestApproved,
  onJoinRequestRejected,
  onErrorMessage,
  onSuccessMessage
}: JoinRequestManagementSectionProps) {
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [approvalRequest, setApprovalRequest] = useState<TeamJoinRequestRecord | null>(null);
  const [approvalRole, setApprovalRole] = useState<TeamMembershipRole>("player");
  const [approvalSeasonId, setApprovalSeasonId] = useState("");
  const [approvalExistingMemberId, setApprovalExistingMemberId] = useState("");
  const [approvalLinkDecisionMade, setApprovalLinkDecisionMade] = useState(false);

  const unclaimedMembershipOptions = useMemo(
    () => memberships.filter((membership) => !membership.userId),
    [memberships]
  );
  const suggestedExistingMembers = useMemo(
    () => getExistingMemberSuggestions(approvalRequest, unclaimedMembershipOptions).slice(0, 3),
    [approvalRequest, unclaimedMembershipOptions]
  );
  const selectedSuggestedMembership = suggestedExistingMembers.find(
    (candidate) => candidate.membership.memberId === approvalExistingMemberId
  ) ?? null;
  const approvalRoleOption = TEAM_BUSINESS_ROLE_OPTIONS.find((option) => option.value === approvalRole) ?? null;
  const requiresExplicitLinkDecision = suggestedExistingMembers.length > 0 && !approvalLinkDecisionMade;

  const openApproveDialog = (request: TeamJoinRequestRecord) => {
    const activeSeason = seasons.find((season) => season.isActive) ?? seasons[0] ?? null;
    const defaultSuggestions = getExistingMemberSuggestions(request, unclaimedMembershipOptions);
    const defaultSuggestedMembership = defaultSuggestions.find((candidate) => candidate.isStrong)?.membership ?? null;
    setApprovalRequest(request);
    setApprovalRole(defaultSuggestedMembership?.role ?? "player");
    setApprovalSeasonId(defaultSuggestedMembership?.seasonId ?? activeSeason?.id ?? "");
    setApprovalExistingMemberId(defaultSuggestedMembership?.memberId ?? "");
    setApprovalLinkDecisionMade(Boolean(defaultSuggestedMembership) || defaultSuggestions.length === 0);
    onErrorMessage(null);
    onSuccessMessage(null);
  };

  const closeApproveDialog = () => {
    if (processingRequestId) {
      return;
    }

    setApprovalRequest(null);
    setApprovalRole("player");
    setApprovalSeasonId("");
    setApprovalExistingMemberId("");
    setApprovalLinkDecisionMade(false);
  };

  const handleExistingMemberDraftChange = (memberId: string) => {
    setApprovalExistingMemberId(memberId);
    setApprovalLinkDecisionMade(true);

    if (!memberId) {
      return;
    }

    const selectedMembership = memberships.find((membership) => membership.memberId === memberId);

    if (!selectedMembership) {
      return;
    }

    setApprovalRole(selectedMembership.role);

    if (selectedMembership.seasonId) {
      setApprovalSeasonId(selectedMembership.seasonId);
    }
  };

  const handleApprove = async () => {
    if (!approvalRequest) {
      return;
    }

    if (!approvalSeasonId) {
      onErrorMessage("Select a season before approving the join request.");
      return;
    }

    if (requiresExplicitLinkDecision) {
      onErrorMessage("Choose whether to link this request to an existing member or create a new member before approving.");
      return;
    }

    const approvalInput: ApproveTeamJoinRequestInput = {
      role: approvalRole,
      seasonId: approvalSeasonId,
      existingMemberId: approvalExistingMemberId || null
    };

    try {
      setProcessingRequestId(approvalRequest.requestId);
      onErrorMessage(null);
      onSuccessMessage(null);
      await approveTeamJoinRequest(approvalRequest.requestId, approvalInput);
      onJoinRequestApproved(approvalRequest.requestId);
      onSuccessMessage(`Approved ${approvalRequest.requesterName} for ${approvalRequest.teamName ?? "the selected team"}.`);
      setApprovalRequest(null);
      setApprovalRole("player");
      setApprovalSeasonId("");
      setApprovalExistingMemberId("");
      setApprovalLinkDecisionMade(false);
    } catch (error) {
      onErrorMessage(error instanceof Error ? error.message : "Could not approve the team join request.");
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleReject = async (request: TeamJoinRequestRecord) => {
    try {
      setProcessingRequestId(request.requestId);
      onErrorMessage(null);
      onSuccessMessage(null);
      await rejectTeamJoinRequest(request.requestId);
      onJoinRequestRejected(request.requestId);
      onSuccessMessage(`Rejected the join request from ${request.requesterName}.`);
    } catch (error) {
      onErrorMessage(error instanceof Error ? error.message : "Could not reject the team join request.");
    } finally {
      setProcessingRequestId(null);
    }
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={2.5}>
          <Stack spacing={0.5}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Pending Join Requests</Typography>
            <Typography variant="body2" color="text.secondary">
              Teamless users can request access with a 6-character Team ID. Approve a request to create the
              membership and assign the user to this team.
            </Typography>
          </Stack>

          {joinRequests.length === 0 ? (
            <Typography color="text.secondary">No pending join requests right now.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Requested User</TableCell>
                    <TableCell>Requested At</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {joinRequests.map((request) => (
                    <TableRow key={request.requestId}>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography fontWeight={700}>{formatName(request.requesterName)}</Typography>
                          <Typography variant="body2" color="text.secondary">{request.requesterEmail}</Typography>
                          <Typography variant="caption" color="text.secondary">User ID: {request.requesterUserId}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(request.requestedAt).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => openApproveDialog(request)}
                            disabled={processingRequestId === request.requestId}
                          >
                            Review & Approve
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => void handleReject(request)}
                            disabled={processingRequestId === request.requestId}
                          >
                            Reject
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </CardContent>

      <Dialog
        open={Boolean(approvalRequest)}
        onClose={closeApproveDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Approve Join Request
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <Typography fontWeight={700}>
                {approvalRequest ? formatName(approvalRequest.requesterName) : "Pending requester"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {approvalRequest?.requesterEmail ?? "No email available"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Choose the final membership role and season now. You can optionally link this requester to an existing unclaimed member instead of creating a new one.
              </Typography>
            </Stack>

            {suggestedExistingMembers.length > 0 && (
              <Alert severity={suggestedExistingMembers.some((candidate) => candidate.isStrong) ? "warning" : "info"}>
                <Stack spacing={1.25}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {suggestedExistingMembers.some((candidate) => candidate.isStrong)
                      ? "Possible duplicate detected"
                      : "Possible existing member matches"}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {suggestedExistingMembers.map((candidate) => (
                      <Chip
                        key={candidate.membership.memberId}
                        label={formatName(candidate.membership.name)}
                        color={candidate.membership.memberId === approvalExistingMemberId ? "primary" : "default"}
                        variant={candidate.membership.memberId === approvalExistingMemberId ? "filled" : "outlined"}
                        onClick={() => handleExistingMemberDraftChange(candidate.membership.memberId)}
                      />
                    ))}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {selectedSuggestedMembership
                      ? selectedSuggestedMembership.reasons.join(" • ")
                      : suggestedExistingMembers[0]?.reasons.join(" • ")}
                  </Typography>
                </Stack>
              </Alert>
            )}

            {requiresExplicitLinkDecision && (
              <Alert severity="warning">
                Choose whether this requester should link to an existing unclaimed member or create a new member before approval continues.
              </Alert>
            )}

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="join-request-role-label">Role</InputLabel>
                  <Select
                    labelId="join-request-role-label"
                    value={approvalRole}
                    label="Role"
                    onChange={(event) => setApprovalRole(event.target.value as TeamMembershipRole)}
                  >
                    {TEAM_BUSINESS_ROLE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {approvalRoleOption?.helper ?? `${getTeamBusinessRoleLabel(approvalRole)} access will be applied during approval.`}
                  </FormHelperText>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="join-request-season-label">Season</InputLabel>
                  <Select
                    labelId="join-request-season-label"
                    value={approvalSeasonId}
                    label="Season"
                    onChange={(event) => setApprovalSeasonId(event.target.value)}
                  >
                    {seasons.map((season) => (
                      <MenuItem key={season.id} value={season.id}>
                        {season.name}{season.isActive ? " (Active)" : ""}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="join-request-existing-member-label">Link To Existing Member</InputLabel>
                  <Select
                    labelId="join-request-existing-member-label"
                    value={approvalExistingMemberId}
                    label="Link To Existing Member"
                    onChange={(event) => handleExistingMemberDraftChange(event.target.value)}
                  >
                    <MenuItem value="">Create new member</MenuItem>
                    {unclaimedMembershipOptions.map((membership) => (
                      <MenuItem key={membership.memberId} value={membership.memberId}>
                        {formatName(membership.name)}
                        {membership.seasonName ? ` - ${membership.seasonName}` : ""}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {requiresExplicitLinkDecision
                      ? "Review the suggested matches and explicitly choose Create new member or a linked member."
                      : approvalExistingMemberId
                        ? "This request will attach to the selected unclaimed member."
                        : "Leave this on Create new member to approve the requester as a brand-new member."}
                  </FormHelperText>
                </FormControl>
              </Grid>
            </Grid>

            {seasons.length === 0 && (
              <Alert severity="warning">
                Create a membership season before approving this request.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeApproveDialog} disabled={Boolean(processingRequestId)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleApprove()}
            disabled={
              Boolean(processingRequestId)
              || !approvalRequest
              || !approvalSeasonId
              || seasons.length === 0
              || requiresExplicitLinkDecision
            }
          >
            {processingRequestId ? "Approving..." : "Approve Request"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

export default function MembershipsPage() {
  const [canAccessWorkspace, setCanAccessWorkspace] = useState<boolean | null>(null);
  const [canManageMembershipDetails, setCanManageMembershipDetails] = useState(false);
  const [canManageRoleAssignments, setCanManageRoleAssignments] = useState(false);
  const [canManageInvites, setCanManageInvites] = useState(false);
  const [canManageRosterPlayerCreation, setCanManageRosterPlayerCreation] = useState(false);
  const [memberships, setMemberships] = useState<TeamMembershipRecord[]>([]);
  const [seasons, setSeasons] = useState<MembershipSeasonRecord[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("all");
  const [hasInitializedSeasonFilter, setHasInitializedSeasonFilter] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [selectedRole, setSelectedRole] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [draftRoles, setDraftRoles] = useState<Record<string, TeamMembershipRole>>({});
  const [draftStatuses, setDraftStatuses] = useState<Record<string, TeamMembershipStatus>>({});
  const [draftSeasonIds, setDraftSeasonIds] = useState<Record<string, string>>({});
  const [draftUserIds, setDraftUserIds] = useState<Record<string, string>>({});
  const [draftPlayerIds, setDraftPlayerIds] = useState<Record<string, string>>({});
  const [draftAliasInputs, setDraftAliasInputs] = useState<Record<string, string>>({});
  const [draftBattingStyles, setDraftBattingStyles] = useState<Record<string, string>>({});
  const [draftIsCaptain, setDraftIsCaptain] = useState<Record<string, boolean>>({});
  const [draftIsWicketKeeper, setDraftIsWicketKeeper] = useState<Record<string, boolean>>({});
  const [draftRoleTags, setDraftRoleTags] = useState<Record<string, string[]>>({});
  const [teamUserOptions, setTeamUserOptions] = useState<TeamMembershipUserOption[]>([]);
  const [teamPlayerOptions, setTeamPlayerOptions] = useState<TeamMembershipPlayerOption[]>([]);
  const [joinRequests, setJoinRequests] = useState<TeamJoinRequestRecord[]>([]);
  const [canEditExternalNames, setCanEditExternalNames] = useState(false);
  const [membershipFoundationReady, setMembershipFoundationReady] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [creatingLinkedPlayerMemberId, setCreatingLinkedPlayerMemberId] = useState<string | null>(null);
  const [linkedPlayerDialogMemberId, setLinkedPlayerDialogMemberId] = useState<string | null>(null);
  const [isCreateRosterPlayerDialogOpen, setIsCreateRosterPlayerDialogOpen] = useState(false);
  const [isCreatingRosterPlayer, setIsCreatingRosterPlayer] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState<string | false>(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [isCreatingSeason, setIsCreatingSeason] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [seasonNameInput, setSeasonNameInput] = useState("");
  const [seasonStartDateInput, setSeasonStartDateInput] = useState("");
  const [seasonEndDateInput, setSeasonEndDateInput] = useState("");
  const [seasonActiveInput, setSeasonActiveInput] = useState(false);

  const loadMembershipWorkspace = useMemo(() => {
    return async (isActive: { current: boolean }, accessFlags: { canManageInvites: boolean }) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const foundationReady = await hasMembershipFoundationSupport();

        if (!isActive.current) return;

        setMembershipFoundationReady(foundationReady);

        if (!foundationReady) {
          setMemberships([]);
          setSeasons([]);
          setTeamUserOptions([]);
          setTeamPlayerOptions([]);
          setJoinRequests([]);
          setDraftAliasInputs({});
          setDraftRoles({});
          setDraftStatuses({});
          setDraftSeasonIds({});
          setDraftUserIds({});
          setDraftPlayerIds({});
          setDraftBattingStyles({});
          setDraftIsCaptain({});
          setDraftIsWicketKeeper({});
          setDraftRoleTags({});
          setCanEditExternalNames(false);
          return;
        }

        const nextCanEditExternalNames = await canManageExternalNames();

        if (!isActive.current) return;

        const [nextMemberships, nextSeasons, nextTeamUserOptions, nextTeamPlayerOptions, nextJoinRequests] = await Promise.all([
          getTeamMembershipRecords(),
          getMembershipSeasons(),
          nextCanEditExternalNames ? getTeamMembershipUserOptions() : Promise.resolve([]),
          nextCanEditExternalNames ? getTeamMembershipPlayerOptions() : Promise.resolve([]),
          accessFlags.canManageInvites ? listPendingTeamJoinRequests() : Promise.resolve([])
        ]);

        if (!isActive.current) return;

        setMemberships(nextMemberships);
        setSeasons(nextSeasons);
        setCanEditExternalNames(nextCanEditExternalNames);
        setTeamUserOptions(nextTeamUserOptions);
        setTeamPlayerOptions(nextTeamPlayerOptions);
        setJoinRequests(nextJoinRequests);
        setDraftAliasInputs({});
        setDraftRoles(nextMemberships.reduce<Record<string, TeamMembershipRole>>((acc, membership) => {
          acc[membership.memberId] = membership.role;
          return acc;
        }, {}));
        setDraftStatuses(nextMemberships.reduce<Record<string, TeamMembershipStatus>>((acc, membership) => {
          acc[membership.memberId] = membership.status;
          return acc;
        }, {}));
        setDraftSeasonIds(nextMemberships.reduce<Record<string, string>>((acc, membership) => {
          acc[membership.memberId] = membership.seasonId ?? "";
          return acc;
        }, {}));
        setDraftUserIds(nextMemberships.reduce<Record<string, string>>((acc, membership) => {
          acc[membership.memberId] = membership.userId ?? "";
          return acc;
        }, {}));
        setDraftPlayerIds(nextMemberships.reduce<Record<string, string>>((acc, membership) => {
          acc[membership.memberId] = membership.playerId ?? "";
          return acc;
        }, {}));
        setDraftBattingStyles(nextMemberships.reduce<Record<string, string>>((acc, membership) => {
          acc[membership.memberId] = membership.battingStyle ?? "";
          return acc;
        }, {}));
        setDraftIsCaptain(nextMemberships.reduce<Record<string, boolean>>((acc, membership) => {
          acc[membership.memberId] = membership.isCaptain;
          return acc;
        }, {}));
        setDraftIsWicketKeeper(nextMemberships.reduce<Record<string, boolean>>((acc, membership) => {
          acc[membership.memberId] = membership.isWicketKeeper;
          return acc;
        }, {}));
        setDraftRoleTags(nextMemberships.reduce<Record<string, string[]>>((acc, membership) => {
          acc[membership.memberId] = membership.roleTags;
          return acc;
        }, {}));
      } catch (error) {
        if (!isActive.current) return;
        setMemberships([]);
        setSeasons([]);
        setTeamUserOptions([]);
        setTeamPlayerOptions([]);
        setJoinRequests([]);
        setCanEditExternalNames(false);
        setDraftAliasInputs({});
        setDraftRoles({});
        setDraftStatuses({});
        setDraftSeasonIds({});
        setDraftUserIds({});
        setDraftPlayerIds({});
        setDraftBattingStyles({});
        setDraftIsCaptain({});
        setDraftIsWicketKeeper({});
        setDraftRoleTags({});
        setErrorMessage(error instanceof Error ? error.message : "Could not load the membership workspace.");
      } finally {
        if (isActive.current) setIsLoading(false);
      }
    };
  }, []);

  const refreshMembershipWorkspace = useCallback(async () => {
    const activity = { current: true };
    await loadMembershipWorkspace(activity, { canManageInvites });
  }, [canManageInvites, loadMembershipWorkspace]);

  useEffect(() => {
    const activity = { current: true };

    const loadWorkspace = async () => {
      try {
        const [
          nextCanAccessWorkspace,
          nextCanManageMembershipDetails,
          nextCanManageRoleAssignments,
          nextCanManageInvites,
          nextCanManageRosterPlayerCreation
        ] = await Promise.all([
          canAccessMembershipWorkspace(),
          canManageMembershipRecords(),
          canManageMembershipRoles(),
          canManageTeamInvites(),
          canManageRosterPlayers()
        ]);

        if (!activity.current) {
          return;
        }

        setCanAccessWorkspace(nextCanAccessWorkspace);
        setCanManageMembershipDetails(nextCanManageMembershipDetails);
        setCanManageRoleAssignments(nextCanManageRoleAssignments);
        setCanManageInvites(nextCanManageInvites);
        setCanManageRosterPlayerCreation(nextCanManageRosterPlayerCreation);

        if (!nextCanAccessWorkspace) {
          setIsLoading(false);
          return;
        }

        await loadMembershipWorkspace(activity, { canManageInvites: nextCanManageInvites });
      } catch (error) {
        if (!activity.current) {
          return;
        }

        setCanAccessWorkspace(false);
        setCanManageMembershipDetails(false);
        setCanManageRoleAssignments(false);
        setCanManageInvites(false);
        setCanManageRosterPlayerCreation(false);
        setIsLoading(false);
        setErrorMessage(error instanceof Error ? error.message : "Could not load the membership workspace.");
      }
    };

    void loadWorkspace();

    return () => {
      activity.current = false;
    };
  }, [loadMembershipWorkspace]);

  useEffect(() => {
    if (hasInitializedSeasonFilter) {
      return;
    }

    const activeSeason = seasons.find((season) => season.isActive);

    if (activeSeason) {
      setSelectedSeason(activeSeason.id);
    }

    if (seasons.length > 0) {
      setHasInitializedSeasonFilter(true);
    }
  }, [hasInitializedSeasonFilter, seasons]);

  const filteredMemberships = useMemo(() => {
    const normalizedSearchQuery = normalizeMembershipMatchValue(searchQuery);

    return memberships.filter((membership) => {
      const seasonMatches = selectedSeason === "all" || membership.seasonId === selectedSeason;
      const statusMatches = selectedStatus === "all" || membership.status === selectedStatus;
      const roleMatches = selectedRole === "all" || membership.role === selectedRole;
      const searchMatches =
        !normalizedSearchQuery || buildMembershipSearchIndex(membership).includes(normalizedSearchQuery);
      return seasonMatches && statusMatches && roleMatches && searchMatches;
    });
  }, [memberships, searchQuery, selectedRole, selectedSeason, selectedStatus]);

  const playerSeasonOptions = useMemo<SeasonOption[]>(
    () => seasons.map((season) => ({
      value: season.id,
      label: season.name
    })),
    [seasons]
  );

  const linkedPlayerDialogMembership = useMemo(
    () => memberships.find((membership) => membership.memberId === linkedPlayerDialogMemberId) ?? null,
    [linkedPlayerDialogMemberId, memberships]
  );

  const membershipColumns = useMemo(() => {
    return filteredMemberships.reduce<[TeamMembershipRecord[], TeamMembershipRecord[]]>(
      (columns, membership, index) => {
        columns[index % 2].push(membership);
        return columns;
      },
      [[], []]
    );
  }, [filteredMemberships]);

  const activeSeasonCount = seasons.filter((season) => season.isActive).length;
  const activeMemberCount = filteredMemberships.filter((membership) => membership.status === "active").length;
  const inactiveMemberCount = filteredMemberships.filter((membership) => membership.status === "inactive").length;
  const fullyLinkedCount = filteredMemberships.filter((membership) => membership.userId && membership.playerId).length;

  const hasMembershipPendingChanges = (membership: TeamMembershipRecord) => {
    const currentExternalAlias = membership.aliases.find((alias) => !alias.isPrimary) ?? null;
    const currentExternalName = currentExternalAlias?.alias ?? "";
    const nextExternalName = draftAliasInputs[membership.memberId] ?? currentExternalName;

    return (
      (draftRoles[membership.memberId] ?? membership.role) !== membership.role
      || (draftStatuses[membership.memberId] ?? membership.status) !== membership.status
      || (draftSeasonIds[membership.memberId] ?? membership.seasonId ?? "") !== (membership.seasonId ?? "")
      || (draftUserIds[membership.memberId] ?? membership.userId ?? "") !== (membership.userId ?? "")
      || (draftPlayerIds[membership.memberId] ?? membership.playerId ?? "") !== (membership.playerId ?? "")
      || (draftBattingStyles[membership.memberId] ?? membership.battingStyle ?? "") !== (membership.battingStyle ?? "")
      || (draftIsCaptain[membership.memberId] ?? membership.isCaptain) !== membership.isCaptain
      || (draftIsWicketKeeper[membership.memberId] ?? membership.isWicketKeeper) !== membership.isWicketKeeper
      || JSON.stringify(draftRoleTags[membership.memberId] ?? membership.roleTags) !== JSON.stringify(membership.roleTags)
      || normalizeExternalNameInput(nextExternalName) !== normalizeExternalNameInput(currentExternalName)
    );
  };

  const getMembershipPendingChangeLabels = (membership: TeamMembershipRecord) => {
    const currentExternalAlias = membership.aliases.find((alias) => !alias.isPrimary) ?? null;
    const currentExternalName = currentExternalAlias?.alias ?? "";
    const nextExternalName = draftAliasInputs[membership.memberId] ?? currentExternalName;
    const labels: string[] = [];

    if ((draftRoles[membership.memberId] ?? membership.role) !== membership.role) {
      labels.push("Role");
    }
    if ((draftStatuses[membership.memberId] ?? membership.status) !== membership.status) {
      labels.push("Status");
    }
    if ((draftSeasonIds[membership.memberId] ?? membership.seasonId ?? "") !== (membership.seasonId ?? "")) {
      labels.push("Season");
    }
    if ((draftUserIds[membership.memberId] ?? membership.userId ?? "") !== (membership.userId ?? "")) {
      labels.push("Linked User");
    }
    if ((draftPlayerIds[membership.memberId] ?? membership.playerId ?? "") !== (membership.playerId ?? "")) {
      labels.push("Linked Player");
    }
    if ((draftBattingStyles[membership.memberId] ?? membership.battingStyle ?? "") !== (membership.battingStyle ?? "")) {
      labels.push("Batting Style");
    }
    if ((draftIsCaptain[membership.memberId] ?? membership.isCaptain) !== membership.isCaptain) {
      labels.push("Captain");
    }
    if ((draftIsWicketKeeper[membership.memberId] ?? membership.isWicketKeeper) !== membership.isWicketKeeper) {
      labels.push("Wicket Keeper");
    }
    if (JSON.stringify(draftRoleTags[membership.memberId] ?? membership.roleTags) !== JSON.stringify(membership.roleTags)) {
      labels.push("Role Tags");
    }
    if (normalizeExternalNameInput(nextExternalName) !== normalizeExternalNameInput(currentExternalName)) {
      labels.push("External Name");
    }

    return labels;
  };

  useEffect(() => {
    if (expandedMemberId && !filteredMemberships.some((membership) => membership.memberId === expandedMemberId)) {
      setExpandedMemberId(false);
    }
  }, [expandedMemberId, filteredMemberships]);

  const handleAliasInputChange = (memberId: string, alias: string) => {
    setDraftAliasInputs((current) => ({ ...current, [memberId]: alias }));
    setSuccessMessage(null);
  };

  const handleRoleDraftChange = (memberId: string, role: TeamMembershipRole) => {
    setDraftRoles((current) => ({ ...current, [memberId]: role }));
    setSuccessMessage(null);
  };

  const handleStatusDraftChange = (memberId: string, status: TeamMembershipStatus) => {
    setDraftStatuses((current) => ({ ...current, [memberId]: status }));
    setSuccessMessage(null);
  };

  const handleSeasonDraftChange = (memberId: string, seasonId: string) => {
    setDraftSeasonIds((current) => ({ ...current, [memberId]: seasonId }));
    setSuccessMessage(null);
  };

  const handleUserDraftChange = (memberId: string, userId: string) => {
    setDraftUserIds((current) => ({ ...current, [memberId]: userId }));
    setSuccessMessage(null);
  };

  const handlePlayerDraftChange = (memberId: string, playerId: string) => {
    setDraftPlayerIds((current) => ({ ...current, [memberId]: playerId }));
    setSuccessMessage(null);
  };

  const handleBattingStyleDraftChange = (memberId: string, battingStyle: string) => {
    setDraftBattingStyles((current) => ({ ...current, [memberId]: battingStyle }));
    setSuccessMessage(null);
  };

  const handleCaptainDraftChange = (memberId: string, isCaptain: boolean) => {
    setDraftIsCaptain((current) => ({ ...current, [memberId]: isCaptain }));
    setSuccessMessage(null);
  };

  const handleWicketKeeperDraftChange = (memberId: string, isWicketKeeper: boolean) => {
    setDraftIsWicketKeeper((current) => ({ ...current, [memberId]: isWicketKeeper }));
    setSuccessMessage(null);
  };

  const handleRoleTagDraftToggle = (memberId: string, roleTag: string) => {
    setDraftRoleTags((current) => {
      const currentRoleTags = current[memberId] ?? [];
      const hasRoleTag = currentRoleTags.includes(roleTag);
      const isPrimaryRole = primarySquadRoleTagOptions.includes(
        roleTag as (typeof primarySquadRoleTagOptions)[number]
      );

      if (hasRoleTag) {
        return {
          ...current,
          [memberId]: currentRoleTags.filter((tag) => tag !== roleTag)
        };
      }

      if (isPrimaryRole) {
        const secondaryTags = currentRoleTags.filter((tag) => !primarySquadRoleTagOptions.includes(
          tag as (typeof primarySquadRoleTagOptions)[number]
        ));

        return {
          ...current,
          [memberId]: [...secondaryTags, roleTag]
        };
      }

      return {
        ...current,
        [memberId]: [...currentRoleTags, roleTag]
      };
    });
    setSuccessMessage(null);
  };

  const handleOpenLinkedPlayerDialog = (memberId: string) => {
    setLinkedPlayerDialogMemberId(memberId);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleCloseLinkedPlayerDialog = () => {
    if (creatingLinkedPlayerMemberId) {
      return;
    }

    setLinkedPlayerDialogMemberId(null);
  };

  const handleOpenCreateRosterPlayerDialog = () => {
    setIsCreateRosterPlayerDialogOpen(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleCloseCreateRosterPlayerDialog = () => {
    if (isCreatingRosterPlayer) {
      return;
    }

    setIsCreateRosterPlayerDialogOpen(false);
  };

  const resetMembershipDraft = (membership: TeamMembershipRecord) => {
    setDraftRoles((current) => ({ ...current, [membership.memberId]: membership.role }));
    setDraftStatuses((current) => ({ ...current, [membership.memberId]: membership.status }));
    setDraftSeasonIds((current) => ({ ...current, [membership.memberId]: membership.seasonId ?? "" }));
    setDraftUserIds((current) => ({ ...current, [membership.memberId]: membership.userId ?? "" }));
    setDraftPlayerIds((current) => ({ ...current, [membership.memberId]: membership.playerId ?? "" }));
    setDraftBattingStyles((current) => ({ ...current, [membership.memberId]: membership.battingStyle ?? "" }));
    setDraftIsCaptain((current) => ({ ...current, [membership.memberId]: membership.isCaptain }));
    setDraftIsWicketKeeper((current) => ({ ...current, [membership.memberId]: membership.isWicketKeeper }));
    setDraftRoleTags((current) => ({ ...current, [membership.memberId]: membership.roleTags }));
    setDraftAliasInputs((current) => ({
      ...current,
      [membership.memberId]: membership.aliases.find((alias) => !alias.isPrimary)?.alias ?? ""
    }));
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleEditMembership = (memberId: string) => {
    setExpandedMemberId(memberId);
    setEditingMemberId(memberId);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleResetMembership = (membership: TeamMembershipRecord) => {
    resetMembershipDraft(membership);
    setEditingMemberId((current) => (current === membership.memberId ? null : current));
  };

  const effectiveLinkedMemberIdByUserId = useMemo(() => {
    const linkedMemberIdByUserId = new Map<string, string | null>();

    teamUserOptions.forEach((option) => {
      linkedMemberIdByUserId.set(option.userId, option.linkedMemberId);
    });

    memberships.forEach((membership) => {
      const nextDraftUserId = draftUserIds[membership.memberId] ?? membership.userId ?? "";

      if (membership.userId && membership.userId !== nextDraftUserId) {
        linkedMemberIdByUserId.set(membership.userId, null);
      }

      if (nextDraftUserId) {
        linkedMemberIdByUserId.set(nextDraftUserId, membership.memberId);
      }
    });

    return linkedMemberIdByUserId;
  }, [draftUserIds, memberships, teamUserOptions]);

  const effectiveLinkedMemberIdByPlayerId = useMemo(() => {
    const linkedMemberIdByPlayerId = new Map<string, string | null>();

    teamPlayerOptions.forEach((option) => {
      linkedMemberIdByPlayerId.set(option.playerId, option.linkedMemberId);
    });

    memberships.forEach((membership) => {
      const nextDraftPlayerId = draftPlayerIds[membership.memberId] ?? membership.playerId ?? "";

      if (membership.playerId && membership.playerId !== nextDraftPlayerId) {
        linkedMemberIdByPlayerId.set(membership.playerId, null);
      }

      if (nextDraftPlayerId) {
        linkedMemberIdByPlayerId.set(nextDraftPlayerId, membership.memberId);
      }
    });

    return linkedMemberIdByPlayerId;
  }, [draftPlayerIds, memberships, teamPlayerOptions]);

  const handleJoinRequestApproved = async (requestId: string) => {
    setJoinRequests((current) => current.filter((request) => request.requestId !== requestId));
    await refreshMembershipWorkspace();
  };

  const handleJoinRequestRejected = (requestId: string) => {
    setJoinRequests((current) => current.filter((request) => request.requestId !== requestId));
  };

  const handleSaveMembership = async (memberId: string) => {
    const currentMembership = memberships.find((membership) => membership.memberId === memberId);
    const nextRole = draftRoles[memberId];
    const nextStatus = draftStatuses[memberId];
    const nextSeasonId = draftSeasonIds[memberId] || null;
    const nextUserId = draftUserIds[memberId] || null;
    const nextPlayerId = draftPlayerIds[memberId] || null;
    const nextBattingStyle = draftBattingStyles[memberId] ?? currentMembership?.battingStyle ?? "";
    const nextIsCaptain = draftIsCaptain[memberId] ?? currentMembership?.isCaptain ?? false;
    const nextIsWicketKeeper = draftIsWicketKeeper[memberId] ?? currentMembership?.isWicketKeeper ?? false;
    const nextRoleTags = draftRoleTags[memberId] ?? currentMembership?.roleTags ?? [];
    const currentExternalAlias = currentMembership?.aliases.find((alias) => !alias.isPrimary) ?? null;
    const nextExternalName = (
      draftAliasInputs[memberId]
      ?? currentExternalAlias?.alias
      ?? ""
    ).trim();
    const normalizedNextExternalName = normalizeExternalNameInput(nextExternalName);
    const normalizedCurrentExternalName = normalizeExternalNameInput(currentExternalAlias?.alias ?? "");
    const normalizedMemberName = normalizeExternalNameInput(currentMembership?.name ?? "");
    const shouldUpdateExternalName =
      Boolean(currentMembership)
      && canEditExternalNames
      && normalizedNextExternalName !== normalizedCurrentExternalName;
    const shouldUpdateLinkedUser =
      canEditExternalNames && nextUserId !== currentMembership?.userId;
    const shouldUpdateLinkedPlayer =
      canEditExternalNames && nextPlayerId !== currentMembership?.playerId;
    const nextEffectiveLinkedPlayerId =
      shouldUpdateLinkedPlayer
        ? nextPlayerId
        : currentMembership?.playerId ?? null;

    if (
      !currentMembership
      || !nextRole
      || !nextStatus
      || (
        nextRole === currentMembership.role
        && nextStatus === currentMembership.status
        && nextSeasonId === currentMembership.seasonId
        && nextUserId === currentMembership.userId
        && nextPlayerId === currentMembership.playerId
        && nextBattingStyle === (currentMembership.battingStyle ?? "")
        && nextIsCaptain === currentMembership.isCaptain
        && nextIsWicketKeeper === currentMembership.isWicketKeeper
        && JSON.stringify(nextRoleTags) === JSON.stringify(currentMembership.roleTags)
        && !shouldUpdateExternalName
      )
    ) {
      return;
    }

    if (
      shouldUpdateExternalName
      && normalizedNextExternalName
      && !nextEffectiveLinkedPlayerId
    ) {
      setErrorMessage(
        currentExternalAlias
          ? "Relink a player before changing the external name. You can still clear the current external name while the member is unlinked."
          : "Link a player before setting an external name."
      );
      return;
    }

    try {
      setSavingMemberId(memberId);
      setErrorMessage(null);
      setSuccessMessage(null);

      const roleUpdate =
        canManageRoleAssignments && nextRole !== currentMembership.role
          ? updateTeamMembershipRole(memberId, nextRole)
          : Promise.resolve(null);

      const statusUpdate =
        canManageMembershipDetails && nextStatus !== currentMembership.status
          ? updateTeamMembershipStatus(memberId, nextStatus)
          : Promise.resolve(null);

      const seasonUpdate =
        canManageMembershipDetails && nextSeasonId !== currentMembership.seasonId
          ? updateTeamMembershipSeason(memberId, nextSeasonId)
          : Promise.resolve(null);

      const [roleResult] = await Promise.all([
        roleUpdate,
        statusUpdate,
        seasonUpdate
      ]);

      let nextResolvedUserId = nextUserId;
      let nextResolvedUserDisplayName = currentMembership.userDisplayName;
      let nextResolvedUserEmail = currentMembership.userEmail;
      if (shouldUpdateLinkedUser) {
        const linkedUserResult = await updateTeamMembershipLinkedUser(memberId, nextUserId);
        nextResolvedUserId = linkedUserResult.userId;
        nextResolvedUserDisplayName = linkedUserResult.userDisplayName;
        nextResolvedUserEmail = linkedUserResult.userEmail;
      }

      let nextResolvedPlayerId = nextPlayerId;
      let nextResolvedPlayerName = currentMembership.playerName;
      const linkedPlayerResult = shouldUpdateLinkedPlayer
        ? await updateTeamMembershipLinkedPlayer(memberId, nextPlayerId)
        : null;
      if (linkedPlayerResult) {
        nextResolvedPlayerId = linkedPlayerResult.playerId;
        nextResolvedPlayerName = linkedPlayerResult.playerName;
      }
      const shouldUpdatePlayerMetadata =
        Boolean(nextResolvedPlayerId ?? currentMembership.playerId)
        && (
          nextBattingStyle !== (currentMembership.battingStyle ?? "")
          || nextIsCaptain !== currentMembership.isCaptain
          || nextIsWicketKeeper !== currentMembership.isWicketKeeper
          || JSON.stringify(nextRoleTags) !== JSON.stringify(currentMembership.roleTags)
        );
      const metadataPlayerId = nextResolvedPlayerId ?? currentMembership.playerId;
      if (shouldUpdatePlayerMetadata && metadataPlayerId) {
        await updateSquadPlayerMetadata(metadataPlayerId, {
            battingStyle: nextBattingStyle,
            isCaptain: nextIsCaptain,
            isWicketKeeper: nextIsWicketKeeper,
            roleTags: nextRoleTags
          });
      }

      let nextAliases = currentMembership.aliases;
      if (shouldUpdateExternalName) {
        if (!nextExternalName || normalizedNextExternalName === normalizedMemberName) {
          if (currentExternalAlias) {
            await deleteTeamMemberAlias(currentExternalAlias.aliasId);
            nextAliases = currentMembership.aliases.filter((alias) => alias.aliasId !== currentExternalAlias.aliasId);
          }
        } else if (currentExternalAlias) {
          const updatedAliasResult = await updateTeamMemberAlias(currentExternalAlias.aliasId, nextExternalName);
          nextAliases = currentMembership.aliases.map((alias) =>
            alias.aliasId === updatedAliasResult.alias.aliasId ? updatedAliasResult.alias : alias
          );
        } else {
          const createdAliasResult = await createTeamMemberAlias(currentMembership.memberId, nextExternalName, "legacy");
          nextAliases = [...currentMembership.aliases, createdAliasResult.alias];
        }
      }

      const playerIdForHistoryRepair = nextResolvedPlayerId ?? currentMembership.playerId;
      if (playerIdForHistoryRepair && (shouldUpdateExternalName || shouldUpdateLinkedPlayer)) {
        try {
          await bridgeCurrentTeamPlayerIdentities({ playerIds: [playerIdForHistoryRepair] });
        } catch (repairError) {
          console.warn("Could not repair historical scorecard identity links after membership update.", repairError);
        }
      }

      const nextSeasonName = nextSeasonId
        ? (seasons.find((season) => season.id === nextSeasonId)?.name ?? currentMembership.seasonName)
        : null;
      const fallbackUserOption = nextResolvedUserId
        ? (teamUserOptions.find((option) => option.userId === nextResolvedUserId) ?? null)
        : null;
      const fallbackPlayerOption = nextResolvedPlayerId
        ? (teamPlayerOptions.find((option) => option.playerId === nextResolvedPlayerId) ?? null)
        : null;
      const updatedMembership: TeamMembershipRecord = {
        ...currentMembership,
        role: nextRole,
        status: nextStatus,
        seasonId: nextSeasonId,
        seasonName: nextSeasonName,
        userId: nextResolvedUserId,
        userDisplayName: nextResolvedUserDisplayName ?? fallbackUserOption?.displayName ?? null,
        userEmail: nextResolvedUserEmail ?? fallbackUserOption?.email ?? null,
        playerId: nextResolvedPlayerId,
        playerName: nextResolvedPlayerName ?? fallbackPlayerOption?.displayName ?? null,
        battingStyle: metadataPlayerId ? nextBattingStyle : currentMembership.battingStyle,
        isCaptain: metadataPlayerId ? nextIsCaptain : currentMembership.isCaptain,
        isWicketKeeper: metadataPlayerId ? nextIsWicketKeeper : currentMembership.isWicketKeeper,
        roleTags: metadataPlayerId ? nextRoleTags : currentMembership.roleTags,
        aliases: nextAliases,
        permissions: roleResult?.permissions ?? currentMembership.permissions
      };

      setMemberships((current) =>
        current.map((membership) =>
          membership.memberId === memberId ? updatedMembership : membership
        )
      );

      if (shouldUpdateLinkedUser) {
        setTeamUserOptions((current) =>
          current.map((option) => {
            if (currentMembership.userId && option.userId === currentMembership.userId) {
              return { ...option, linkedMemberId: null };
            }

            if (nextResolvedUserId && option.userId === nextResolvedUserId) {
              return { ...option, linkedMemberId: memberId };
            }

            return option;
          })
        );
      }

      if (shouldUpdateLinkedPlayer) {
        setTeamPlayerOptions((current) =>
          current.map((option) => {
            if (currentMembership.playerId && option.playerId === currentMembership.playerId) {
              return { ...option, linkedMemberId: null };
            }

            if (nextResolvedPlayerId && option.playerId === nextResolvedPlayerId) {
              return { ...option, linkedMemberId: memberId };
            }

            return option;
          })
        );
      }

      resetMembershipDraft(updatedMembership);
      setEditingMemberId((current) => (current === memberId ? null : current));
      setSuccessMessage(`Updated ${currentMembership.name} membership details.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update the membership details.");
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleCreateSeason = async () => {
    try {
      setIsCreatingSeason(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      await createMembershipSeason({
        name: seasonNameInput,
        startDate: seasonStartDateInput,
        endDate: seasonEndDateInput,
        isActive: seasonActiveInput
      });

      const nextSeasons = await getMembershipSeasons();
      setSeasons(nextSeasons);
      setSeasonNameInput("");
      setSeasonStartDateInput("");
      setSeasonEndDateInput("");
      setSeasonActiveInput(false);
      setSuccessMessage("Created the new membership season.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create the membership season.");
    } finally {
      setIsCreatingSeason(false);
    }
  };

  const handleCreateLinkedPlayer = async (values: CreateRosterPlayerValues) => {
    if (!linkedPlayerDialogMembership) {
      return;
    }

    try {
      setCreatingLinkedPlayerMemberId(linkedPlayerDialogMembership.memberId);
      setErrorMessage(null);
      setSuccessMessage(null);

      const result = await createLinkedPlayerForMember({
        memberId: linkedPlayerDialogMembership.memberId,
        name: values.name,
        battingStyle: values.battingStyle,
        isCaptain: values.isCaptain,
        isWicketKeeper: values.isWicketKeeper,
        roleTags: values.roleTags
      });

      await refreshMembershipWorkspace();
      setLinkedPlayerDialogMemberId(null);
      setSuccessMessage(`Created and linked ${formatName(result.player.name)} for ${formatName(linkedPlayerDialogMembership.name)}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create the linked player.");
    } finally {
      setCreatingLinkedPlayerMemberId(null);
    }
  };

  const handleCreateRosterPlayer = async (values: CreateRosterPlayerValues) => {
    try {
      setIsCreatingRosterPlayer(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      await createSquadPlayer({
        name: values.name,
        seasonId: values.seasonId,
        status: values.status === "inactive" ? "inactive" : "active",
        battingStyle: values.battingStyle,
        isCaptain: values.isCaptain,
        isWicketKeeper: values.isWicketKeeper,
        roleTags: values.roleTags
      });

      await refreshMembershipWorkspace();
      setIsCreateRosterPlayerDialogOpen(false);
      setSuccessMessage(`Created ${formatName(values.name)} in the roster.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create the roster player.");
    } finally {
      setIsCreatingRosterPlayer(false);
    }
  };

  return (
    <Container maxWidth="xl">
      <Stack spacing={4}>
        <TeamPageHeader
          eyebrow="V2 Foundation"
          title="Membership Workspace"
          description="Inspect and correct the V2 membership model across team members, active or inactive status, season assignment, linked app accounts, linked player identities, and external names used across attendance and scorecards."
        />

        {canAccessWorkspace === false && (
          <AutoHideAlert severity="info" variant="outlined">
            This workspace is available only to organisers or members with explicit membership-management access.
          </AutoHideAlert>
        )}

        {membershipFoundationReady === false && (
          <AutoHideAlert severity="warning" variant="outlined">
            Membership foundation is not available in this environment yet.
          </AutoHideAlert>
        )}

        {membershipFoundationReady && !canEditExternalNames && (
          <AutoHideAlert severity="info" variant="outlined">
            External names are visible here, but only the organiser can edit them.
          </AutoHideAlert>
        )}

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {successMessage && (
          <AutoHideAlert severity="success" resetKey={successMessage}>
            {successMessage}
          </AutoHideAlert>
        )}

        {canAccessWorkspace && isLoading ? (
          <Box sx={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : canAccessWorkspace && membershipFoundationReady ? (
          <>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <MetricCard label="Team Members" value={filteredMemberships.length} helper="Membership records in the current filter" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <MetricCard label="Active Members" value={activeMemberCount} helper="Active members in the current filter" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <MetricCard label="Inactive Members" value={inactiveMemberCount} helper="Inactive members in the current filter" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <MetricCard label="Fully Linked" value={fullyLinkedCount} helper="Members linked to both user and player in the current filter" />
              </Grid>
            </Grid>

            <AutoHideAlert severity="info" variant="outlined">
              The backfill defaulted unresolved members into the active season. Use this page to mark older players inactive and create missing seasons like 2025 before assigning people into them.
            </AutoHideAlert>

            {canManageRoleAssignments && (
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>Add Membership Season</Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <TextField fullWidth size="small" label="Season Name" value={seasonNameInput} onChange={(event) => setSeasonNameInput(event.target.value)} placeholder="2025" />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <TextField fullWidth size="small" label="Start Date" type="date" value={seasonStartDateInput} onChange={(event) => setSeasonStartDateInput(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <TextField fullWidth size="small" label="End Date" type="date" value={seasonEndDateInput} onChange={(event) => setSeasonEndDateInput(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" sx={{ height: "100%" }}>
                          <FormControlLabel control={<Checkbox checked={seasonActiveInput} onChange={(event) => setSeasonActiveInput(event.target.checked)} />} label="Active Season" />
                          <Button variant="contained" onClick={() => void handleCreateSeason()} disabled={isCreatingSeason}>
                            {isCreatingSeason ? "Creating..." : "Add Season"}
                          </Button>
                        </Stack>
                      </Grid>
                    </Grid>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {canManageInvites && (
              <JoinRequestManagementSection
                joinRequests={joinRequests}
                memberships={memberships}
                seasons={seasons}
                onJoinRequestApproved={handleJoinRequestApproved}
                onJoinRequestRejected={handleJoinRequestRejected}
                onErrorMessage={setErrorMessage}
                onSuccessMessage={setSuccessMessage}
              />
            )}

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between">
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <BadgeRoundedIcon color="primary" />
                        <Stack spacing={0.25}>
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>Team Membership Records</Typography>
                          <Typography variant="body2" color="text.secondary">Review members, change active or inactive state, assign the correct season, and manage external names used across attendance sheets, scorecards, and legacy tools.</Typography>
                        </Stack>
                      </Stack>

                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Chip icon={<EventRepeatRoundedIcon />} label={`${seasons.length} season${seasons.length === 1 ? "" : "s"}`} size="small" variant="outlined" />
                        <Chip label={`${activeSeasonCount} active season${activeSeasonCount === 1 ? "" : "s"}`} size="small" color={activeSeasonCount > 0 ? "success" : "default"} variant="outlined" />
                        {canManageRosterPlayerCreation && (
                          <CreatePlayerIconButton onClick={handleOpenCreateRosterPlayerDialog} />
                        )}
                      </Stack>
                    </Stack>

                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                      <TextField
                        size="small"
                        label="Search Members"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Name, email, player, alias"
                        sx={{ minWidth: { xs: "100%", md: 260 } }}
                      />

                      <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 220 } }}>
                        <InputLabel id="membership-season-filter-label">Season</InputLabel>
                        <Select labelId="membership-season-filter-label" value={selectedSeason} label="Season" onChange={(event) => setSelectedSeason(event.target.value)}>
                          <MenuItem value="all">All Seasons</MenuItem>
                          {seasons.map((season) => (
                            <MenuItem key={season.id} value={season.id}>{season.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 180 } }}>
                        <InputLabel id="membership-status-filter-label">Status</InputLabel>
                        <Select labelId="membership-status-filter-label" value={selectedStatus} label="Status" onChange={(event) => setSelectedStatus(event.target.value)}>
                          <MenuItem value="all">All Statuses</MenuItem>
                          <MenuItem value="active">Active</MenuItem>
                          <MenuItem value="inactive">Inactive</MenuItem>
                          <MenuItem value="invited">Invited</MenuItem>
                          <MenuItem value="archived">Archived</MenuItem>
                        </Select>
                      </FormControl>

                      <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 180 } }}>
                        <InputLabel id="membership-role-filter-label">Role</InputLabel>
                        <Select labelId="membership-role-filter-label" value={selectedRole} label="Role" onChange={(event) => setSelectedRole(event.target.value)}>
                          <MenuItem value="all">All Roles</MenuItem>
                          {TEAM_BUSINESS_ROLE_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  </Stack>
                </Box>

                {filteredMemberships.length === 0 ? (
                  <Box sx={{ px: 3, pb: 3 }}>
                    <Typography color="text.secondary">No membership records match the current filters.</Typography>
                  </Box>
                ) : (
                  <Grid container spacing={1.5} alignItems="flex-start" sx={{ px: 2, pb: 2 }}>
                    {membershipColumns.map((columnMemberships, columnIndex) => (
                      <Grid key={`membership-column-${columnIndex}`} size={{ xs: 12, md: 6 }}>
                        <Stack spacing={1.5}>
                          {columnMemberships.map((membership) => {
                      const visibleExternalNames = membership.aliases.filter((alias) => !alias.isPrimary);
                      const editingExternalAlias = visibleExternalNames[0] ?? null;
                      const externalNameInputValue =
                        draftAliasInputs[membership.memberId]
                        ?? editingExternalAlias?.alias
                        ?? "";
                      const draftMemberBattingStyle = draftBattingStyles[membership.memberId] ?? membership.battingStyle ?? "";
                      const draftMemberIsCaptain = draftIsCaptain[membership.memberId] ?? membership.isCaptain;
                      const draftMemberIsWicketKeeper = draftIsWicketKeeper[membership.memberId] ?? membership.isWicketKeeper;
                      const draftMemberRoleTags = draftRoleTags[membership.memberId] ?? membership.roleTags;
                      const hasPendingChanges = hasMembershipPendingChanges(membership);
                      const pendingChangeLabels = getMembershipPendingChangeLabels(membership);
                      const isEditingMember = editingMemberId === membership.memberId;
                      const effectiveLinkedPlayerId = draftPlayerIds[membership.memberId] ?? membership.playerId ?? "";
                      const canEditExternalNameField =
                        isEditingMember && (Boolean(effectiveLinkedPlayerId) || Boolean(editingExternalAlias));
                      const resolvedUserLabel = membership.userDisplayName ?? membership.userEmail ?? "Not Linked";
                      const resolvedPlayerLabel = membership.playerName ? formatName(membership.playerName) : "Not Linked";
                      const linkedCricketProfileChips = [
                        membership.primaryRole,
                        membership.battingStyle ? `${membership.battingStyle} batting` : null,
                        membership.bowlingStyle ? `${membership.bowlingStyle} bowling` : null,
                        membership.batterPreference ? `${membership.batterPreference} batter pref` : null,
                        membership.bowlerPreference ? `${membership.bowlerPreference} bowler pref` : null
                      ].filter((value): value is string => Boolean(value));
                      const hasLinkedCricketProfile = linkedCricketProfileChips.length > 0 || Boolean(membership.cricHeroesName);

                            return (
                        <Accordion
                          key={membership.memberId}
                          expanded={expandedMemberId === membership.memberId}
                          onChange={(_, isExpanded) => setExpandedMemberId(isExpanded ? membership.memberId : false)}
                          disableGutters
                          sx={{
                            borderRadius: "20px !important",
                            overflow: "hidden",
                            border: "1px solid",
                            borderColor: hasPendingChanges ? "primary.main" : "divider",
                            backgroundColor: "background.paper",
                            boxShadow: hasPendingChanges ? "0 10px 26px rgba(25, 118, 210, 0.12)" : "none",
                            "&::before": {
                              display: "none"
                            }
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMoreRoundedIcon />}
                            sx={{
                              px: 2,
                              py: 1.25,
                              "& .MuiAccordionSummary-content": {
                                my: 0
                              }
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1.25}
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ width: "100%", minWidth: 0, pr: 1 }}
                            >
                              <Typography sx={{ fontWeight: 800, color: "text.primary" }}>
                                {formatName(membership.name)}
                              </Typography>
                              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="flex-end">
                                {hasPendingChanges ? (
                                  <Chip
                                    size="small"
                                    label={`${pendingChangeLabels.length} pending`}
                                    color="primary"
                                    variant="filled"
                                  />
                                ) : null}
                                <Chip
                                  size="small"
                                  label={membership.userId && membership.playerId ? "Fully linked" : "Needs linking"}
                                  color={membership.userId && membership.playerId ? "success" : "warning"}
                                  variant="outlined"
                                />
                              </Stack>
                            </Stack>
                          </AccordionSummary>

                          <AccordionDetails sx={{ px: 1.5, pb: 1.5, pt: 0 }}>
                            <Divider sx={{ mb: 1.5 }} />

                            <Grid container spacing={1.5}>
                              <Grid size={{ xs: 12 }}>
                                <Box
                                  sx={{
                                    px: 0.5,
                                    py: 0.25
                                  }}
                                >
                                  <Stack spacing={1.5}>
                                    {hasPendingChanges ? (
                                      <Alert severity="info" variant="outlined">
                                        Unsaved changes: {pendingChangeLabels.join(", ")}
                                      </Alert>
                                    ) : null}
                                    {hasLinkedCricketProfile ? (
                                      <Box
                                        sx={{
                                          p: 1.5,
                                          borderRadius: 2,
                                          border: "1px solid",
                                          borderColor: "divider",
                                          backgroundColor: "background.default"
                                        }}
                                      >
                                        <Stack spacing={1}>
                                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                            Player Preferences
                                          </Typography>
                                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                            {linkedCricketProfileChips.map((label) => (
                                              <Chip key={`${membership.memberId}-${label}`} size="small" label={label} variant="outlined" />
                                            ))}
                                          </Stack>
                                          {membership.cricHeroesName ? (
                                            <Typography variant="body2" color="text.secondary">
                                              CricHeroes: {membership.cricHeroesName}
                                            </Typography>
                                          ) : null}
                                        </Stack>
                                      </Box>
                                    ) : null}
                                    <Grid container spacing={1}>
                                      <Grid size={{ xs: 12, md: 4 }}>
                                        <FormControl size="small" fullWidth>
                                          <InputLabel id={`membership-role-${membership.memberId}`}>Role</InputLabel>
                                          <Select
                                            labelId={`membership-role-${membership.memberId}`}
                                            value={draftRoles[membership.memberId] ?? membership.role}
                                            label="Role"
                                            onChange={(event) => handleRoleDraftChange(membership.memberId, event.target.value as TeamMembershipRole)}
                                            disabled={!isEditingMember || !canManageRoleAssignments}
                                          >
                                            {TEAM_BUSINESS_ROLE_OPTIONS.map((option) => (
                                              <MenuItem key={option.value} value={option.value}>
                                                {option.label}
                                              </MenuItem>
                                            ))}
                                          </Select>
                                        </FormControl>
                                      </Grid>

                                      <Grid size={{ xs: 12, md: 4 }}>
                                        <FormControl size="small" fullWidth>
                                          <InputLabel id={`membership-status-${membership.memberId}`}>Status</InputLabel>
                                          <Select
                                            labelId={`membership-status-${membership.memberId}`}
                                            value={draftStatuses[membership.memberId] ?? membership.status}
                                            label="Status"
                                            onChange={(event) => handleStatusDraftChange(membership.memberId, event.target.value as TeamMembershipStatus)}
                                            disabled={!isEditingMember || !canManageMembershipDetails}
                                          >
                                            <MenuItem value="active">Active</MenuItem>
                                            <MenuItem value="inactive">Inactive</MenuItem>
                                            <MenuItem value="invited">Invited</MenuItem>
                                            <MenuItem value="archived">Archived</MenuItem>
                                          </Select>
                                        </FormControl>
                                      </Grid>

                                      <Grid size={{ xs: 12, md: 4 }}>
                                        <FormControl size="small" fullWidth>
                                          <InputLabel id={`membership-season-${membership.memberId}`}>Season</InputLabel>
                                          <Select
                                            labelId={`membership-season-${membership.memberId}`}
                                            value={draftSeasonIds[membership.memberId] ?? membership.seasonId ?? ""}
                                            label="Season"
                                            onChange={(event) => handleSeasonDraftChange(membership.memberId, event.target.value)}
                                            disabled={!isEditingMember || !canManageMembershipDetails}
                                          >
                                            <MenuItem value="">Not Assigned</MenuItem>
                                            {seasons.map((season) => (
                                              <MenuItem key={season.id} value={season.id}>{season.name}</MenuItem>
                                            ))}
                                          </Select>
                                        </FormControl>
                                      </Grid>
                                    </Grid>
                                  </Stack>
                                </Box>
                              </Grid>

                              <Grid size={{ xs: 12 }}>
                                <Box
                                  sx={{
                                    px: 0.5,
                                    py: 0.25
                                  }}
                                >
                                  <Stack spacing={1.5}>
                                    {canEditExternalNames ? (
                                      <FormControl size="small" fullWidth>
                                        <InputLabel id={`membership-user-${membership.memberId}`}>Linked User</InputLabel>
                                        <Select
                                          labelId={`membership-user-${membership.memberId}`}
                                          value={draftUserIds[membership.memberId] ?? membership.userId ?? ""}
                                          label="Linked User"
                                          onChange={(event) => handleUserDraftChange(membership.memberId, event.target.value)}
                                          disabled={!isEditingMember}
                                        >
                                          <MenuItem value="">Not Linked</MenuItem>
                                          {teamUserOptions
                                            .filter((option) =>
                                              (effectiveLinkedMemberIdByUserId.get(option.userId) ?? null) === null
                                              || effectiveLinkedMemberIdByUserId.get(option.userId) === membership.memberId
                                            )
                                            .map((option) => (
                                              <MenuItem key={option.userId} value={option.userId}>
                                                {option.displayName}{option.email ? ` (${option.email})` : ""}
                                              </MenuItem>
                                            ))}
                                        </Select>
                                      </FormControl>
                                    ) : (
                                      <TextField
                                        size="small"
                                        fullWidth
                                        label="Linked User"
                                        value={resolvedUserLabel}
                                        disabled
                                      />
                                    )}

                                    {canEditExternalNames ? (
                                      <FormControl size="small" fullWidth>
                                        <InputLabel id={`membership-player-${membership.memberId}`}>Linked Player</InputLabel>
                                        <Select
                                          labelId={`membership-player-${membership.memberId}`}
                                          value={draftPlayerIds[membership.memberId] ?? membership.playerId ?? ""}
                                          label="Linked Player"
                                          onChange={(event) => handlePlayerDraftChange(membership.memberId, event.target.value)}
                                          disabled={!isEditingMember}
                                        >
                                          <MenuItem value="">Not Linked</MenuItem>
                                          {teamPlayerOptions
                                            .filter((option) =>
                                              (effectiveLinkedMemberIdByPlayerId.get(option.playerId) ?? null) === null
                                              || effectiveLinkedMemberIdByPlayerId.get(option.playerId) === membership.memberId
                                            )
                                            .map((option) => (
                                              <MenuItem key={option.playerId} value={option.playerId}>
                                                {option.displayName}{option.isGuest ? " (Guest)" : ""}
                                              </MenuItem>
                                            ))}
                                        </Select>
                                      </FormControl>
                                    ) : (
                                      <TextField
                                        size="small"
                                        fullWidth
                                        label="Linked Player"
                                        value={resolvedPlayerLabel}
                                        disabled
                                      />
                                    )}

                                    {canManageRosterPlayerCreation
                                      && !(draftPlayerIds[membership.memberId] ?? membership.playerId ?? "")
                                      && isEditingMember && (
                                        <CreatePlayerIconButton
                                          onClick={() => handleOpenLinkedPlayerDialog(membership.memberId)}
                                        />
                                      )}
                                  </Stack>
                                </Box>
                              </Grid>

                              <Grid size={{ xs: 12 }}>
                                  <Box
                                    sx={{
                                      px: 0.5,
                                      py: 0.25
                                    }}
                                  >
                                    <Stack spacing={1.25}>
                                      {membership.playerId ? (
                                        <>
                                          <TextField
                                            size="small"
                                            fullWidth
                                            label="Batting Style"
                                            value={draftMemberBattingStyle}
                                            onChange={(event) => handleBattingStyleDraftChange(membership.memberId, event.target.value)}
                                            placeholder="RHB / LHB"
                                            disabled={!isEditingMember}
                                          />
                                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                            <FormControlLabel
                                              control={(
                                                <Checkbox
                                                  checked={draftMemberIsCaptain}
                                                  onChange={(event) => handleCaptainDraftChange(membership.memberId, event.target.checked)}
                                                  disabled={!isEditingMember}
                                                />
                                              )}
                                              label="Captain"
                                            />
                                            <FormControlLabel
                                              control={(
                                                <Checkbox
                                                  checked={draftMemberIsWicketKeeper}
                                                  onChange={(event) => handleWicketKeeperDraftChange(membership.memberId, event.target.checked)}
                                                  disabled={!isEditingMember}
                                                />
                                              )}
                                              label="Wicket Keeper"
                                            />
                                          </Stack>
                                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                            {squadRoleTagOptions.map((roleTag) => (
                                              <FormControlLabel
                                                key={`${membership.memberId}-${roleTag}`}
                                                control={(
                                                  <Checkbox
                                                    checked={draftMemberRoleTags.includes(roleTag)}
                                                    onChange={() => handleRoleTagDraftToggle(membership.memberId, roleTag)}
                                                    disabled={!isEditingMember}
                                                  />
                                                )}
                                                label={roleTag}
                                                sx={{ mr: 1.5 }}
                                              />
                                            ))}
                                          </Stack>
                                        </>
                                      ) : (
                                        canManageRosterPlayerCreation && isEditingMember && (
                                          <Box sx={{ alignSelf: "flex-start" }}>
                                            <CreatePlayerIconButton
                                              onClick={() => handleOpenLinkedPlayerDialog(membership.memberId)}
                                            />
                                          </Box>
                                        )
                                      )}
                                    </Stack>
                                  </Box>
                                </Grid>

                              <Grid size={{ xs: 12 }}>
                                <Box
                                  sx={{
                                    px: 0.5,
                                    py: 0.25
                                  }}
                                >
                                  <Stack spacing={1.25}>
                                    {canEditExternalNames ? (
                                      <TextField
                                        size="small"
                                        fullWidth
                                        label="External Name"
                                        value={externalNameInputValue}
                                        onChange={(event) => handleAliasInputChange(membership.memberId, event.target.value)}
                                        placeholder="Spond Name"
                                        disabled={!canEditExternalNameField}
                                        helperText={
                                          !isEditingMember
                                            ? "Click Edit to update the external name."
                                            : effectiveLinkedPlayerId
                                              ? "Update the Spond or external display name, or leave it blank to use the member name."
                                              : editingExternalAlias
                                                ? "This member is currently unlinked. You can clear the existing external name here, or relink a player to replace it."
                                                : "Link a player first. External names now belong to the linked player identity for scorecards and stats."
                                        }
                                      />
                                    ) : visibleExternalNames.length > 0 ? (
                                      <TextField
                                        size="small"
                                        fullWidth
                                        label="External Name"
                                        value={visibleExternalNames[0]?.alias ?? ""}
                                        disabled
                                      />
                                    ) : (
                                      <TextField
                                        size="small"
                                        fullWidth
                                        label="External Name"
                                        value=""
                                        disabled
                                      />
                                    )}
                                  </Stack>
                                </Box>
                              </Grid>

                              <Grid size={{ xs: 12 }}>
                                <Box
                                  sx={{
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    gap: 1,
                                    px: 0.5,
                                    pt: 0.25
                                  }}
                                >
                                  <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} alignItems="center">
                                  <Button
                                    variant={isEditingMember ? "contained" : "outlined"}
                                    size="small"
                                    startIcon={<EditRoundedIcon />}
                                    onClick={() => handleEditMembership(membership.memberId)}
                                    disabled={savingMemberId === membership.memberId || isEditingMember}
                                  >
                                    {isEditingMember ? "Editing" : "Edit"}
                                  </Button>
                                  <Button
                                    variant="text"
                                    size="small"
                                    startIcon={<RestartAltRoundedIcon />}
                                    onClick={() => handleResetMembership(membership)}
                                    disabled={savingMemberId === membership.memberId || !hasPendingChanges}
                                  >
                                    Reset
                                  </Button>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<SaveRoundedIcon />}
                                    onClick={() => void handleSaveMembership(membership.memberId)}
                                    disabled={savingMemberId === membership.memberId || !hasPendingChanges || !isEditingMember}
                                  >
                                    {savingMemberId === membership.memberId ? "Saving..." : "Save"}
                                  </Button>
                                  </Stack>
                                </Box>
                              </Grid>
                            </Grid>
                          </AccordionDetails>
                        </Accordion>
                            );
                          })}
                        </Stack>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </Stack>

      <PlayerRosterDialog
        key={`membership-roster-create-${playerSeasonOptions[0]?.value ?? "none"}-${isCreateRosterPlayerDialogOpen ? "open" : "closed"}`}
        open={isCreateRosterPlayerDialogOpen}
        seasons={playerSeasonOptions}
        defaultSeasonId={
          selectedSeason !== "all"
            ? selectedSeason
            : (seasons.find((season) => season.isActive)?.id ?? playerSeasonOptions[0]?.value ?? "")
        }
        title="Create Player"
        saveLabel="Create Player"
        helperText="Create a roster player directly from Memberships when someone is missing from the current player list."
        isSaving={isCreatingRosterPlayer}
        onClose={handleCloseCreateRosterPlayerDialog}
        onSave={handleCreateRosterPlayer}
      />

      <PlayerRosterDialog
        key={linkedPlayerDialogMembership?.memberId ?? "membership-linked-player"}
        open={Boolean(linkedPlayerDialogMembership)}
        seasons={playerSeasonOptions}
        defaultSeasonId={linkedPlayerDialogMembership?.seasonId ?? playerSeasonOptions[0]?.value ?? ""}
        title={linkedPlayerDialogMembership ? `Create Player For ${formatName(linkedPlayerDialogMembership.name)}` : "Create Linked Player"}
        saveLabel="Create And Link"
        helperText="Create the linked player profile for this existing membership record so scorecards, planner, and player views all point to the same identity."
        showSeasonStatusFields={false}
        initialValues={linkedPlayerDialogMembership ? {
          name: linkedPlayerDialogMembership.playerName ?? linkedPlayerDialogMembership.name,
          seasonId: linkedPlayerDialogMembership.seasonId ?? playerSeasonOptions[0]?.value ?? "",
          status: linkedPlayerDialogMembership.status,
          roleTags: ["Batter"]
        } : undefined}
        isSaving={Boolean(creatingLinkedPlayerMemberId)}
        onClose={handleCloseLinkedPlayerDialog}
        onSave={handleCreateLinkedPlayer}
      />
    </Container>
  );
}
