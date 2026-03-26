"use client";

import { useEffect, useMemo, useState } from "react";

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
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
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
  cancelTeamInvite,
  createExistingMemberInvite,
  createNewMemberInvite,
  listTeamInvites,
  TeamInviteRecord,
  TeamInviteRole
} from "@/app/services/inviteService";
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
  TeamMemberAliasRecord,
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
  createLinkedPlayerForMember,
  createSquadPlayer,
  primarySquadRoleTagOptions,
  squadRoleTagOptions,
  updateSquadPlayerMetadata
} from "@/app/services/squadService";
import {
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

function sortAliases(aliases: TeamMemberAliasRecord[]) {
  return [...aliases].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }

    if (left.aliasType !== right.aliasType) {
      return left.aliasType.localeCompare(right.aliasType);
    }

    return left.alias.localeCompare(right.alias);
  });
}

function normalizeMembershipMatchValue(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
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

type InviteManagementSectionProps = {
  memberships: TeamMembershipRecord[];
  seasons: MembershipSeasonRecord[];
  invites: TeamInviteRecord[];
  onInviteCreated: (invite: TeamInviteRecord) => void;
  onInviteCancelled: (inviteId: string) => void;
  onErrorMessage: (message: string | null) => void;
  onSuccessMessage: (message: string | null) => void;
};

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

  const openApproveDialog = (request: TeamJoinRequestRecord) => {
    const activeSeason = seasons.find((season) => season.isActive) ?? seasons[0] ?? null;
    const defaultSuggestions = getExistingMemberSuggestions(request, unclaimedMembershipOptions);
    const defaultSuggestedMembership = defaultSuggestions.find((candidate) => candidate.isStrong)?.membership ?? null;
    setApprovalRequest(request);
    setApprovalRole(defaultSuggestedMembership?.role ?? "player");
    setApprovalSeasonId(defaultSuggestedMembership?.seasonId ?? activeSeason?.id ?? "");
    setApprovalExistingMemberId(defaultSuggestedMembership?.memberId ?? "");
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
  };

  const handleExistingMemberDraftChange = (memberId: string) => {
    setApprovalExistingMemberId(memberId);

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
            disabled={Boolean(processingRequestId) || !approvalRequest || !approvalSeasonId || seasons.length === 0}
          >
            {processingRequestId ? "Approving..." : "Approve Request"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

function InviteManagementSection({
  memberships,
  seasons,
  invites,
  onInviteCreated,
  onInviteCancelled,
  onErrorMessage,
  onSuccessMessage
}: InviteManagementSectionProps) {
  const [isCreatingExistingInvite, setIsCreatingExistingInvite] = useState(false);
  const [isCreatingNewInvite, setIsCreatingNewInvite] = useState(false);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);
  const [existingInviteMemberId, setExistingInviteMemberId] = useState("");
  const [existingInviteEmailInput, setExistingInviteEmailInput] = useState("");
  const [newInviteNameInput, setNewInviteNameInput] = useState("");
  const [newInviteEmailInput, setNewInviteEmailInput] = useState("");
  const [newInviteSeasonId, setNewInviteSeasonId] = useState("");
  const [newInviteRole, setNewInviteRole] = useState<TeamInviteRole>("player");
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === "pending"),
    [invites]
  );
  const invitableMemberships = useMemo(() => {
    const pendingMemberIds = new Set(
      pendingInvites
        .map((invite) => invite.memberId)
        .filter((memberId): memberId is string => Boolean(memberId))
    );

    return memberships.filter((membership) => !membership.userId && !pendingMemberIds.has(membership.memberId));
  }, [memberships, pendingInvites]);

  const handleExistingInviteMemberChange = (memberId: string) => {
    setExistingInviteMemberId(memberId);
    const selectedMembership = memberships.find((membership) => membership.memberId === memberId);
    setExistingInviteEmailInput(selectedMembership?.userEmail ?? "");
    setLatestInviteUrl(null);
    onErrorMessage(null);
    onSuccessMessage(null);
  };

  const handleCopyInviteUrl = async (inviteUrl: string) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard copy is not available in this browser.");
      }

      await navigator.clipboard.writeText(inviteUrl);
      onSuccessMessage("Invite link copied to clipboard.");
    } catch (error) {
      onErrorMessage(error instanceof Error ? error.message : "Could not copy the invite link.");
    }
  };

  const handleCreateExistingInvite = async () => {
    if (!existingInviteMemberId || !existingInviteEmailInput.trim()) {
      return;
    }

    try {
      setIsCreatingExistingInvite(true);
      onErrorMessage(null);
      onSuccessMessage(null);

      const result = await createExistingMemberInvite({
        memberId: existingInviteMemberId,
        email: existingInviteEmailInput
      });

      onInviteCreated(result.invite);
      setLatestInviteUrl(result.inviteUrl);
      setExistingInviteMemberId("");
      setExistingInviteEmailInput("");
      onSuccessMessage(`Created a claim invite for ${result.invite.inviteName}. Copy the link before leaving this page.`);
    } catch (error) {
      onErrorMessage(error instanceof Error ? error.message : "Could not create the existing member invite.");
    } finally {
      setIsCreatingExistingInvite(false);
    }
  };

  const handleCreateNewInvite = async () => {
    if (!newInviteNameInput.trim() || !newInviteEmailInput.trim()) {
      return;
    }

    try {
      setIsCreatingNewInvite(true);
      onErrorMessage(null);
      onSuccessMessage(null);

      const result = await createNewMemberInvite({
        inviteName: newInviteNameInput,
        email: newInviteEmailInput,
        seasonId: newInviteSeasonId || null,
        invitedRole: newInviteRole
      });

      onInviteCreated(result.invite);
      setLatestInviteUrl(result.inviteUrl);
      setNewInviteNameInput("");
      setNewInviteEmailInput("");
      setNewInviteSeasonId("");
      setNewInviteRole("player");
      onSuccessMessage(`Created a new member invite for ${result.invite.inviteName}. Copy the link before leaving this page.`);
    } catch (error) {
      onErrorMessage(error instanceof Error ? error.message : "Could not create the new member invite.");
    } finally {
      setIsCreatingNewInvite(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      setCancellingInviteId(inviteId);
      onErrorMessage(null);
      onSuccessMessage(null);

      await cancelTeamInvite(inviteId);
      onInviteCancelled(inviteId);
      onSuccessMessage("Cancelled the pending invite.");
    } catch (error) {
      onErrorMessage(error instanceof Error ? error.message : "Could not cancel the invite.");
    } finally {
      setCancellingInviteId(null);
    }
  };

  return (
    <>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
            <CardContent>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <GroupAddRoundedIcon color="primary" />
                  <Stack spacing={0.25}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>Invite Existing Member</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Claim an existing roster member without creating duplicate people or players.
                    </Typography>
                  </Stack>
                </Stack>

                <FormControl fullWidth size="small">
                  <InputLabel id="existing-invite-member-label">Member</InputLabel>
                  <Select
                    labelId="existing-invite-member-label"
                    value={existingInviteMemberId}
                    label="Member"
                    onChange={(event) => handleExistingInviteMemberChange(event.target.value)}
                  >
                    <MenuItem value="">Select a member</MenuItem>
                    {invitableMemberships.map((membership) => (
                      <MenuItem key={membership.memberId} value={membership.memberId}>
                        {formatName(membership.name)}
                        {membership.seasonName ? ` - ${membership.seasonName}` : ""}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  size="small"
                  label="Invite Email"
                  value={existingInviteEmailInput}
                  onChange={(event) => setExistingInviteEmailInput(event.target.value)}
                  placeholder="member@example.com"
                />

                <Button
                  variant="contained"
                  onClick={() => void handleCreateExistingInvite()}
                  disabled={isCreatingExistingInvite || !existingInviteMemberId || !existingInviteEmailInput.trim()}
                >
                  {isCreatingExistingInvite ? "Creating Invite..." : "Create Claim Invite"}
                </Button>

                {invitableMemberships.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Every unclaimed member already has an active claim invite or is already linked to a user.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
            <CardContent>
              <Stack spacing={2.5}>
                <Stack spacing={0.25}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>Invite New Member</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Create an invite for someone who is not on the roster yet. Their team membership record will be created when they accept.
                  </Typography>
                </Stack>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Member Name"
                      value={newInviteNameInput}
                      onChange={(event) => setNewInviteNameInput(event.target.value)}
                      placeholder="John Doe"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Invite Email"
                      value={newInviteEmailInput}
                      onChange={(event) => setNewInviteEmailInput(event.target.value)}
                      placeholder="john@example.com"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="new-invite-season-label">Season</InputLabel>
                      <Select
                        labelId="new-invite-season-label"
                        value={newInviteSeasonId}
                        label="Season"
                        onChange={(event) => setNewInviteSeasonId(event.target.value)}
                      >
                        <MenuItem value="">Use acceptance-time default</MenuItem>
                        {seasons.map((season) => (
                          <MenuItem key={season.id} value={season.id}>{season.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="new-invite-role-label">Team Role</InputLabel>
                      <Select
                        labelId="new-invite-role-label"
                        value={newInviteRole}
                        label="Team Role"
                        onChange={(event) => setNewInviteRole(event.target.value as TeamInviteRole)}
                      >
                        {TEAM_BUSINESS_ROLE_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Button
                  variant="contained"
                  onClick={() => void handleCreateNewInvite()}
                  disabled={isCreatingNewInvite || !newInviteNameInput.trim() || !newInviteEmailInput.trim()}
                >
                  {isCreatingNewInvite ? "Creating Invite..." : "Create New Member Invite"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {latestInviteUrl && (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Latest Invite Link</Typography>
              <Typography variant="body2" color="text.secondary">
                Tokens are only shown when the invite is created. Copy this link now, then share it with the invited person.
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={latestInviteUrl}
                slotProps={{ input: { readOnly: true } }}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  variant="contained"
                  startIcon={<ContentCopyRoundedIcon />}
                  onClick={() => void handleCopyInviteUrl(latestInviteUrl)}
                >
                  Copy Invite Link
                </Button>
                <Button variant="text" onClick={() => setLatestInviteUrl(null)}>
                  Hide Link
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between">
              <Stack spacing={0.25}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Pending Invites</Typography>
                <Typography variant="body2" color="text.secondary">
                  Track outstanding claim and new-member onboarding links. Pending invite links cannot be recovered later, so cancelling and reissuing is the safe reset path.
                </Typography>
              </Stack>
              <Chip
                label={`${pendingInvites.length} pending`}
                size="small"
                color={pendingInvites.length > 0 ? "warning" : "default"}
                variant="outlined"
              />
            </Stack>

            {pendingInvites.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No pending invites yet.
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Season</TableCell>
                      <TableCell>Expires</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingInvites.map((invite) => (
                      <TableRow key={invite.inviteId}>
                        <TableCell>{formatName(invite.inviteName)}</TableCell>
                        <TableCell>{invite.email}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={invite.inviteType === "existing_member" ? "Existing Member" : "New Member"}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{seasons.find((season) => season.id === invite.seasonId)?.name ?? "Default"}</TableCell>
                        <TableCell>{new Date(invite.tokenExpiresAt).toLocaleDateString()}</TableCell>
                        <TableCell align="right">
                          <Button
                            color="error"
                            variant="text"
                            onClick={() => void handleCancelInvite(invite.inviteId)}
                            disabled={cancellingInviteId === invite.inviteId}
                          >
                            {cancellingInviteId === invite.inviteId ? "Cancelling..." : "Cancel"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </CardContent>
      </Card>
    </>
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
  const [invites, setInvites] = useState<TeamInviteRecord[]>([]);
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
          setInvites([]);
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

        const [nextMemberships, nextSeasons, nextTeamUserOptions, nextTeamPlayerOptions, nextInvites, nextJoinRequests] = await Promise.all([
          getTeamMembershipRecords(),
          getMembershipSeasons(),
          nextCanEditExternalNames ? getTeamMembershipUserOptions() : Promise.resolve([]),
          nextCanEditExternalNames ? getTeamMembershipPlayerOptions() : Promise.resolve([]),
          accessFlags.canManageInvites ? listTeamInvites() : Promise.resolve([]),
          accessFlags.canManageInvites ? listPendingTeamJoinRequests() : Promise.resolve([])
        ]);

        if (!isActive.current) return;

        setMemberships(nextMemberships);
        setSeasons(nextSeasons);
        setCanEditExternalNames(nextCanEditExternalNames);
        setTeamUserOptions(nextTeamUserOptions);
        setTeamPlayerOptions(nextTeamPlayerOptions);
        setInvites(nextInvites);
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
        setInvites([]);
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
    return memberships.filter((membership) => {
      const seasonMatches = selectedSeason === "all" || membership.seasonId === selectedSeason;
      const statusMatches = selectedStatus === "all" || membership.status === selectedStatus;
      const roleMatches = selectedRole === "all" || membership.role === selectedRole;
      return seasonMatches && statusMatches && roleMatches;
    });
  }, [memberships, selectedRole, selectedSeason, selectedStatus]);

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
  const pendingInviteCount = invites.filter((invite) => invite.status === "pending").length;

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

  const handleInviteCreated = (invite: TeamInviteRecord) => {
    setInvites((current) => [invite, ...current]);
  };

  const handleInviteCancelled = (inviteId: string) => {
    setInvites((current) =>
      current.map((invite) =>
        invite.inviteId === inviteId
          ? { ...invite, status: "cancelled", updatedAt: new Date().toISOString() }
          : invite
      )
    );
  };

  const handleJoinRequestApproved = async (requestId: string) => {
    setJoinRequests((current) => current.filter((request) => request.requestId !== requestId));
    const activity = { current: true };
    await loadMembershipWorkspace(activity, { canManageInvites });
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

      const shouldUpdateLinkedUser =
        canEditExternalNames && nextUserId !== currentMembership.userId
          ;

      const shouldUpdateLinkedPlayer =
        canEditExternalNames && nextPlayerId !== currentMembership.playerId
          ;

      const [roleResult] = await Promise.all([
        roleUpdate,
        statusUpdate,
        seasonUpdate
      ]);

      const linkedUserResult = shouldUpdateLinkedUser
        ? await updateTeamMembershipLinkedUser(memberId, nextUserId)
        : null;
      const linkedPlayerResult = shouldUpdateLinkedPlayer
        ? await updateTeamMembershipLinkedPlayer(memberId, nextPlayerId)
        : null;
      const shouldUpdatePlayerMetadata =
        Boolean(linkedPlayerResult?.playerId ?? nextPlayerId ?? currentMembership.playerId)
        && (
          nextBattingStyle !== (currentMembership.battingStyle ?? "")
          || nextIsCaptain !== currentMembership.isCaptain
          || nextIsWicketKeeper !== currentMembership.isWicketKeeper
          || JSON.stringify(nextRoleTags) !== JSON.stringify(currentMembership.roleTags)
        );
      const metadataPlayerId = linkedPlayerResult?.playerId ?? nextPlayerId ?? currentMembership.playerId;
      const updatedPlayer = shouldUpdatePlayerMetadata && metadataPlayerId
        ? await updateSquadPlayerMetadata(metadataPlayerId, {
            battingStyle: nextBattingStyle,
            isCaptain: nextIsCaptain,
            isWicketKeeper: nextIsWicketKeeper,
            roleTags: nextRoleTags
          })
        : null;
      let nextAliases = currentMembership.aliases;

      if (shouldUpdateExternalName) {
        if (!nextExternalName || normalizedNextExternalName === normalizedMemberName) {
          if (currentExternalAlias) {
            await deleteTeamMemberAlias(currentExternalAlias.aliasId);
            nextAliases = currentMembership.aliases.filter((alias) => alias.aliasId !== currentExternalAlias.aliasId);
          }
        } else if (currentExternalAlias) {
          const result = await updateTeamMemberAlias(currentExternalAlias.aliasId, nextExternalName);
          nextAliases = sortAliases(
            currentMembership.aliases.map((alias) =>
              alias.aliasId === currentExternalAlias.aliasId ? result.alias : alias
            )
          );
        } else {
          const result = await createTeamMemberAlias(currentMembership.memberId, nextExternalName, "legacy");
          nextAliases = sortAliases([...currentMembership.aliases, result.alias]);
        }
      }

      setMemberships((current) =>
        current.map((membership) =>
          membership.memberId === memberId
            ? {
              ...membership,
              role: roleResult?.role ?? membership.role,
              permissions: roleResult?.permissions ?? membership.permissions,
              status: canManageMembershipDetails ? nextStatus : membership.status,
              seasonId: canManageMembershipDetails ? nextSeasonId : membership.seasonId,
              seasonName: canManageMembershipDetails
                ? (nextSeasonId ? (seasons.find((season) => season.id === nextSeasonId)?.name ?? null) : null)
                : membership.seasonName,
              userId: linkedUserResult?.userId ?? membership.userId,
              userDisplayName: linkedUserResult?.userDisplayName ?? membership.userDisplayName,
              userEmail: linkedUserResult?.userEmail ?? membership.userEmail,
              playerId: linkedPlayerResult?.playerId ?? membership.playerId,
              playerName: linkedPlayerResult?.playerName ?? membership.playerName,
              battingStyle: updatedPlayer?.battingStyle ?? nextBattingStyle,
              isCaptain: updatedPlayer?.isCaptain ?? nextIsCaptain,
              isWicketKeeper: updatedPlayer?.isWicketKeeper ?? nextIsWicketKeeper,
              roleTags: updatedPlayer?.roleTags ?? nextRoleTags,
              aliases: membership.memberId === currentMembership.memberId ? nextAliases : membership.aliases
            }
            : membership
        )
      );
      setDraftAliasInputs((current) => ({
        ...current,
        [memberId]: nextAliases.find((alias) => !alias.isPrimary)?.alias ?? ""
      }));
      setDraftBattingStyles((current) => ({
        ...current,
        [memberId]: updatedPlayer?.battingStyle ?? nextBattingStyle
      }));
      setDraftIsCaptain((current) => ({
        ...current,
        [memberId]: updatedPlayer?.isCaptain ?? nextIsCaptain
      }));
      setDraftIsWicketKeeper((current) => ({
        ...current,
        [memberId]: updatedPlayer?.isWicketKeeper ?? nextIsWicketKeeper
      }));
      setDraftRoleTags((current) => ({
        ...current,
        [memberId]: updatedPlayer?.roleTags ?? nextRoleTags
      }));

      if (linkedUserResult) {
        setTeamUserOptions((current) =>
          current.map((option) => {
            if (option.linkedMemberId === memberId && option.userId !== linkedUserResult.userId) {
              return { ...option, linkedMemberId: null };
            }

            if (linkedUserResult.userId && option.userId === linkedUserResult.userId) {
              return { ...option, linkedMemberId: memberId };
            }

            return option;
          })
        );
      }

      if (linkedPlayerResult) {
        setTeamPlayerOptions((current) =>
          current.map((option) => {
            if (option.linkedMemberId === memberId && option.playerId !== linkedPlayerResult.playerId) {
              return { ...option, linkedMemberId: null };
            }

            if (linkedPlayerResult.playerId && option.playerId === linkedPlayerResult.playerId) {
              return { ...option, linkedMemberId: memberId };
            }

            return option;
          })
        );
      }

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

      const refreshedPlayerOptions = await getTeamMembershipPlayerOptions();

      setTeamPlayerOptions(refreshedPlayerOptions);
      setMemberships((current) =>
        current.map((membership) =>
          membership.memberId === linkedPlayerDialogMembership.memberId
            ? {
              ...membership,
              playerId: result.player.id,
              playerName: formatName(result.player.name),
              battingStyle: result.player.battingStyle,
              isCaptain: result.player.isCaptain,
              isWicketKeeper: result.player.isWicketKeeper,
              roleTags: result.player.roleTags
            }
            : membership
        )
      );
      setDraftPlayerIds((current) => ({
        ...current,
        [linkedPlayerDialogMembership.memberId]: result.player.id
      }));
      setDraftBattingStyles((current) => ({
        ...current,
        [linkedPlayerDialogMembership.memberId]: result.player.battingStyle ?? ""
      }));
      setDraftIsCaptain((current) => ({
        ...current,
        [linkedPlayerDialogMembership.memberId]: result.player.isCaptain
      }));
      setDraftIsWicketKeeper((current) => ({
        ...current,
        [linkedPlayerDialogMembership.memberId]: result.player.isWicketKeeper
      }));
      setDraftRoleTags((current) => ({
        ...current,
        [linkedPlayerDialogMembership.memberId]: result.player.roleTags
      }));
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

      const refreshedMemberships = await getTeamMembershipRecords();
      const refreshedPlayerOptions = await getTeamMembershipPlayerOptions();

      setMemberships(refreshedMemberships);
      setTeamPlayerOptions(refreshedPlayerOptions);
      setDraftRoles(refreshedMemberships.reduce<Record<string, TeamMembershipRole>>((acc, membership) => {
        acc[membership.memberId] = membership.role;
        return acc;
      }, {}));
      setDraftStatuses(refreshedMemberships.reduce<Record<string, TeamMembershipStatus>>((acc, membership) => {
        acc[membership.memberId] = membership.status;
        return acc;
      }, {}));
      setDraftSeasonIds(refreshedMemberships.reduce<Record<string, string>>((acc, membership) => {
        acc[membership.memberId] = membership.seasonId ?? "";
        return acc;
      }, {}));
      setDraftUserIds(refreshedMemberships.reduce<Record<string, string>>((acc, membership) => {
        acc[membership.memberId] = membership.userId ?? "";
        return acc;
      }, {}));
      setDraftPlayerIds(refreshedMemberships.reduce<Record<string, string>>((acc, membership) => {
        acc[membership.memberId] = membership.playerId ?? "";
        return acc;
      }, {}));
      setDraftBattingStyles(refreshedMemberships.reduce<Record<string, string>>((acc, membership) => {
        acc[membership.memberId] = membership.battingStyle ?? "";
        return acc;
      }, {}));
      setDraftIsCaptain(refreshedMemberships.reduce<Record<string, boolean>>((acc, membership) => {
        acc[membership.memberId] = membership.isCaptain;
        return acc;
      }, {}));
      setDraftIsWicketKeeper(refreshedMemberships.reduce<Record<string, boolean>>((acc, membership) => {
        acc[membership.memberId] = membership.isWicketKeeper;
        return acc;
      }, {}));
      setDraftRoleTags(refreshedMemberships.reduce<Record<string, string[]>>((acc, membership) => {
        acc[membership.memberId] = membership.roleTags;
        return acc;
      }, {}));
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
              <>
                <JoinRequestManagementSection
                  joinRequests={joinRequests}
                  memberships={memberships}
                  seasons={seasons}
                  onJoinRequestApproved={handleJoinRequestApproved}
                  onJoinRequestRejected={handleJoinRequestRejected}
                  onErrorMessage={setErrorMessage}
                  onSuccessMessage={setSuccessMessage}
                />

                <Accordion
                  disableGutters
                  defaultExpanded={pendingInviteCount > 0}
                  sx={{
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: "divider",
                    backgroundColor: "background.paper",
                    "&::before": { display: "none" }
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1.5}
                      alignItems={{ xs: "flex-start", md: "center" }}
                      justifyContent="space-between"
                      sx={{ width: "100%", pr: 1 }}
                    >
                      <Stack spacing={0.35}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          Advanced Invite Links
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Team ID and join approval are the main V2 path. Keep invite links only for exceptional admin flows like claiming an existing unlinked member.
                        </Typography>
                      </Stack>
                      <Chip
                        size="small"
                        label={pendingInviteCount > 0 ? `${pendingInviteCount} pending` : "Optional flow"}
                        color={pendingInviteCount > 0 ? "warning" : "default"}
                        variant="outlined"
                      />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    <InviteManagementSection
                      memberships={memberships}
                      seasons={seasons}
                      invites={invites}
                      onInviteCreated={handleInviteCreated}
                      onInviteCancelled={handleInviteCancelled}
                      onErrorMessage={setErrorMessage}
                      onSuccessMessage={setSuccessMessage}
                    />
                  </AccordionDetails>
                </Accordion>
              </>
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
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<PersonAddAlt1RoundedIcon />}
                            onClick={handleOpenCreateRosterPlayerDialog}
                          >
                            Create Player
                          </Button>
                        )}
                      </Stack>
                    </Stack>

                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
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
                      const isEditingMember = editingMemberId === membership.memberId;
                      const resolvedUserLabel = membership.userDisplayName ?? membership.userEmail ?? "Not Linked";
                      const resolvedPlayerLabel = membership.playerName ? formatName(membership.playerName) : "Not Linked";

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
                              <Chip
                                size="small"
                                label={membership.userId && membership.playerId ? "Fully linked" : "Needs linking"}
                                color={membership.userId && membership.playerId ? "success" : "warning"}
                                variant="outlined"
                              />
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
                                        <Button
                                          variant="outlined"
                                          size="small"
                                          startIcon={<PersonAddAlt1RoundedIcon />}
                                          onClick={() => handleOpenLinkedPlayerDialog(membership.memberId)}
                                        >
                                          Create Player
                                        </Button>
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
                                          <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<PersonAddAlt1RoundedIcon />}
                                            onClick={() => handleOpenLinkedPlayerDialog(membership.memberId)}
                                            sx={{ alignSelf: "flex-start" }}
                                          >
                                            Create Player
                                          </Button>
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
                                        disabled={!isEditingMember}
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
