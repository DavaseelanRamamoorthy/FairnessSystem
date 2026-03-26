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
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import { useAuth } from "@/app/context/AuthContext";
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
  onJoinRequestApproved: (requestId: string) => void;
  onJoinRequestRejected: (requestId: string) => void;
  onErrorMessage: (message: string | null) => void;
  onSuccessMessage: (message: string | null) => void;
};

function JoinRequestManagementSection({
  joinRequests,
  onJoinRequestApproved,
  onJoinRequestRejected,
  onErrorMessage,
  onSuccessMessage
}: JoinRequestManagementSectionProps) {
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const handleApprove = async (request: TeamJoinRequestRecord) => {
    try {
      setProcessingRequestId(request.requestId);
      onErrorMessage(null);
      onSuccessMessage(null);
      await approveTeamJoinRequest(request.requestId);
      onJoinRequestApproved(request.requestId);
      onSuccessMessage(`Approved ${request.requesterName} for ${request.teamName ?? "the selected team"}.`);
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
                            onClick={() => void handleApprove(request)}
                            disabled={processingRequestId === request.requestId}
                          >
                            {processingRequestId === request.requestId ? "Working..." : "Approve"}
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
                      <InputLabel id="new-invite-role-label">Legacy Role</InputLabel>
                      <Select
                        labelId="new-invite-role-label"
                        value={newInviteRole}
                        label="Legacy Role"
                        onChange={(event) => setNewInviteRole(event.target.value as TeamInviteRole)}
                      >
                        <MenuItem value="player">Player</MenuItem>
                        <MenuItem value="captain">Captain</MenuItem>
                        <MenuItem value="admin">Admin</MenuItem>
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
  const { isAdmin } = useAuth();
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
  const [editingExternalNameMemberId, setEditingExternalNameMemberId] = useState<string | null>(null);
  const [editingExternalAliasIdByMemberId, setEditingExternalAliasIdByMemberId] = useState<Record<string, string | null>>({});
  const [teamUserOptions, setTeamUserOptions] = useState<TeamMembershipUserOption[]>([]);
  const [teamPlayerOptions, setTeamPlayerOptions] = useState<TeamMembershipPlayerOption[]>([]);
  const [invites, setInvites] = useState<TeamInviteRecord[]>([]);
  const [joinRequests, setJoinRequests] = useState<TeamJoinRequestRecord[]>([]);
  const [canEditExternalNames, setCanEditExternalNames] = useState(false);
  const [membershipFoundationReady, setMembershipFoundationReady] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [savingAliasMemberId, setSavingAliasMemberId] = useState<string | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<string | false>(false);
  const [isCreatingSeason, setIsCreatingSeason] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [seasonNameInput, setSeasonNameInput] = useState("");
  const [seasonStartDateInput, setSeasonStartDateInput] = useState("");
  const [seasonEndDateInput, setSeasonEndDateInput] = useState("");
  const [seasonActiveInput, setSeasonActiveInput] = useState(false);

  const loadMembershipWorkspace = useMemo(() => {
    return async (isActive: { current: boolean }) => {
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
          listTeamInvites(),
          listPendingTeamJoinRequests()
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
        setErrorMessage(error instanceof Error ? error.message : "Could not load the membership workspace.");
      } finally {
        if (isActive.current) setIsLoading(false);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }

    const activity = { current: true };
    void loadMembershipWorkspace(activity);

    return () => {
      activity.current = false;
    };
  }, [isAdmin, loadMembershipWorkspace]);

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

  const hasMembershipPendingChanges = (membership: TeamMembershipRecord) => (
    (draftRoles[membership.memberId] ?? membership.role) !== membership.role
    || (draftStatuses[membership.memberId] ?? membership.status) !== membership.status
    || (draftSeasonIds[membership.memberId] ?? membership.seasonId ?? "") !== (membership.seasonId ?? "")
    || (draftUserIds[membership.memberId] ?? membership.userId ?? "") !== (membership.userId ?? "")
    || (draftPlayerIds[membership.memberId] ?? membership.playerId ?? "") !== (membership.playerId ?? "")
  );

  useEffect(() => {
    if (expandedMemberId && !filteredMemberships.some((membership) => membership.memberId === expandedMemberId)) {
      setExpandedMemberId(false);
    }
  }, [expandedMemberId, filteredMemberships]);

  const handleAliasInputChange = (memberId: string, alias: string) => {
    setDraftAliasInputs((current) => ({ ...current, [memberId]: alias }));
    setSuccessMessage(null);
  };

  const openExternalNameEditor = (memberId: string, currentExternalName?: string | null) => {
    setDraftAliasInputs((current) => ({
      ...current,
      [memberId]: currentExternalName ?? ""
    }));
    setEditingExternalAliasIdByMemberId((current) => ({
      ...current,
      [memberId]: null
    }));
    setEditingExternalNameMemberId(memberId);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const openExistingExternalNameEditor = (memberId: string, alias: TeamMemberAliasRecord) => {
    setDraftAliasInputs((current) => ({
      ...current,
      [memberId]: alias.alias
    }));
    setEditingExternalAliasIdByMemberId((current) => ({
      ...current,
      [memberId]: alias.aliasId
    }));
    setEditingExternalNameMemberId(memberId);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const closeExternalNameEditor = (memberId: string) => {
    setEditingExternalNameMemberId((current) => (current === memberId ? null : current));
    setDraftAliasInputs((current) => ({ ...current, [memberId]: "" }));
    setEditingExternalAliasIdByMemberId((current) => ({
      ...current,
      [memberId]: null
    }));
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

  const resetMembershipDraft = (membership: TeamMembershipRecord) => {
    setDraftRoles((current) => ({ ...current, [membership.memberId]: membership.role }));
    setDraftStatuses((current) => ({ ...current, [membership.memberId]: membership.status }));
    setDraftSeasonIds((current) => ({ ...current, [membership.memberId]: membership.seasonId ?? "" }));
    setDraftUserIds((current) => ({ ...current, [membership.memberId]: membership.userId ?? "" }));
    setDraftPlayerIds((current) => ({ ...current, [membership.memberId]: membership.playerId ?? "" }));
    closeExternalNameEditor(membership.memberId);
    setSuccessMessage(null);
    setErrorMessage(null);
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
    await loadMembershipWorkspace(activity);
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
      )
    ) {
      return;
    }

    try {
      setSavingMemberId(memberId);
      setErrorMessage(null);
      setSuccessMessage(null);

      const roleUpdate =
        nextRole !== currentMembership.role
          ? updateTeamMembershipRole(memberId, nextRole)
          : Promise.resolve(null);

      const statusUpdate =
        nextStatus !== currentMembership.status
          ? updateTeamMembershipStatus(memberId, nextStatus)
          : Promise.resolve(null);

      const seasonUpdate =
        nextSeasonId !== currentMembership.seasonId
          ? updateTeamMembershipSeason(memberId, nextSeasonId)
          : Promise.resolve(null);

      const shouldUpdateLinkedUser =
        canEditExternalNames && nextUserId !== currentMembership.userId
          ;

      const shouldUpdateLinkedPlayer =
        canEditExternalNames && nextPlayerId !== currentMembership.playerId
          ;

      await Promise.all([
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

      setMemberships((current) =>
        current.map((membership) =>
          membership.memberId === memberId
            ? {
              ...membership,
              role: nextRole,
              status: nextStatus,
              seasonId: nextSeasonId,
              seasonName: nextSeasonId ? (seasons.find((season) => season.id === nextSeasonId)?.name ?? null) : null,
              userId: linkedUserResult?.userId ?? membership.userId,
              userDisplayName: linkedUserResult?.userDisplayName ?? membership.userDisplayName,
              userEmail: linkedUserResult?.userEmail ?? membership.userEmail,
              playerId: linkedPlayerResult?.playerId ?? membership.playerId,
              playerName: linkedPlayerResult?.playerName ?? membership.playerName
            }
            : membership
        )
      );

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

      setSuccessMessage(`Updated ${currentMembership.name} membership details.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update the membership details.");
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleSaveExternalName = async (
    membership: TeamMembershipRecord,
    existingAlias: TeamMemberAliasRecord | null
  ) => {
    const nextExternalName = (draftAliasInputs[membership.memberId] ?? "").trim();

    if (!nextExternalName) {
      return;
    }

    const normalizedNextExternalName = normalizeExternalNameInput(nextExternalName);
    const normalizedMemberName = normalizeExternalNameInput(membership.name);
    const normalizedExistingAlias = existingAlias ? normalizeExternalNameInput(existingAlias.alias) : null;

    if (!existingAlias && normalizedNextExternalName === normalizedMemberName) {
      closeExternalNameEditor(membership.memberId);
      return;
    }

    if (existingAlias && normalizedExistingAlias === normalizedNextExternalName) {
      closeExternalNameEditor(membership.memberId);
      return;
    }

    try {
      setSavingAliasMemberId(membership.memberId);
      setErrorMessage(null);
      setSuccessMessage(null);

      if (existingAlias && normalizedNextExternalName === normalizedMemberName) {
        await deleteTeamMemberAlias(existingAlias.aliasId);
        setMemberships((current) =>
          current.map((entry) =>
            entry.memberId === membership.memberId
              ? {
                ...entry,
                aliases: entry.aliases.filter((alias) => alias.aliasId !== existingAlias.aliasId)
              }
              : entry
          )
        );
        closeExternalNameEditor(membership.memberId);
        setSuccessMessage("External name reset to the member name.");
        return;
      }

      if (existingAlias) {
        const result = await updateTeamMemberAlias(existingAlias.aliasId, nextExternalName);
        setMemberships((current) =>
          current.map((entry) =>
            entry.memberId === membership.memberId
              ? {
                ...entry,
                aliases: entry.aliases.map((alias) =>
                  alias.aliasId === existingAlias.aliasId ? result.alias : alias
                ).sort((left, right) => {
                  if (left.isPrimary !== right.isPrimary) {
                    return left.isPrimary ? -1 : 1;
                  }

                  if (left.aliasType !== right.aliasType) {
                    return left.aliasType.localeCompare(right.aliasType);
                  }

                  return left.alias.localeCompare(right.alias);
                })
              }
              : entry
          )
        );
      } else {
        const result = await createTeamMemberAlias(membership.memberId, nextExternalName, "legacy");

        setMemberships((current) =>
          current.map((entry) => {
            if (entry.memberId !== result.memberId) {
              return entry;
            }

            return {
              ...entry,
              aliases: [...entry.aliases, result.alias].sort((left, right) => {
                if (left.isPrimary !== right.isPrimary) {
                  return left.isPrimary ? -1 : 1;
                }

                if (left.aliasType !== right.aliasType) {
                  return left.aliasType.localeCompare(right.aliasType);
                }

                return left.alias.localeCompare(right.alias);
              })
            };
          })
        );
      }

      closeExternalNameEditor(membership.memberId);
      setSuccessMessage(existingAlias ? "Updated the external name." : "Added the new external name.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save the external name.");
    } finally {
      setSavingAliasMemberId(null);
    }
  };

  const handleDeleteExternalName = async (membership: TeamMembershipRecord, alias: TeamMemberAliasRecord) => {
    try {
      setSavingAliasMemberId(membership.memberId);
      setErrorMessage(null);
      setSuccessMessage(null);

      await deleteTeamMemberAlias(alias.aliasId);
      setMemberships((current) =>
        current.map((entry) =>
          entry.memberId === membership.memberId
            ? {
              ...entry,
              aliases: entry.aliases.filter((entryAlias) => entryAlias.aliasId !== alias.aliasId)
            }
            : entry
        )
      );

      if (editingExternalAliasIdByMemberId[membership.memberId] === alias.aliasId) {
        closeExternalNameEditor(membership.memberId);
      }

      setSuccessMessage(`Removed external name from ${membership.name}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not delete the external name.");
    } finally {
      setSavingAliasMemberId(null);
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

  return (
    <Container maxWidth="xl">
      <Stack spacing={4}>
        <TeamPageHeader
          eyebrow="V2 Foundation"
          title="Membership Workspace"
          description="Inspect and correct the V2 membership model across team members, active or inactive status, season assignment, linked app accounts, linked player identities, and external names used across attendance and scorecards."
        />

        {!isAdmin && (
          <AutoHideAlert severity="info" variant="outlined">
            Membership management is available to admin users only.
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

        {isAdmin && isLoading ? (
          <Box sx={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : isAdmin && membershipFoundationReady ? (
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

            <JoinRequestManagementSection
              joinRequests={joinRequests}
              onJoinRequestApproved={handleJoinRequestApproved}
              onJoinRequestRejected={handleJoinRequestRejected}
              onErrorMessage={setErrorMessage}
              onSuccessMessage={setSuccessMessage}
            />

            <InviteManagementSection
              memberships={memberships}
              seasons={seasons}
              invites={invites}
              onInviteCreated={handleInviteCreated}
              onInviteCancelled={handleInviteCancelled}
              onErrorMessage={setErrorMessage}
              onSuccessMessage={setSuccessMessage}
            />

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
                          <MenuItem value="admin">Admin</MenuItem>
                          <MenuItem value="captain">Captain</MenuItem>
                          <MenuItem value="player">Player</MenuItem>
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
                      const isEditingExternalName = editingExternalNameMemberId === membership.memberId;
                      const editingExternalAliasId = editingExternalAliasIdByMemberId[membership.memberId] ?? null;
                      const editingExternalAlias = editingExternalAliasId
                        ? visibleExternalNames.find((alias) => alias.aliasId === editingExternalAliasId) ?? null
                        : null;
                      const externalNameMatchesPrimaryName =
                        normalizeExternalNameInput(draftAliasInputs[membership.memberId] ?? "")
                        === normalizeExternalNameInput(membership.name);
                      const hasPendingChanges = hasMembershipPendingChanges(membership);
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
                            <Divider sx={{ mb: 1.25 }} />

                            <Grid container spacing={1}>
                              <Grid size={{ xs: 12 }}>
                                <Typography variant="subtitle2" color="text.secondary">
                                  Membership Details
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormControl size="small" fullWidth>
                                  <InputLabel id={`membership-role-${membership.memberId}`}>Role</InputLabel>
                                  <Select
                                    labelId={`membership-role-${membership.memberId}`}
                                    value={draftRoles[membership.memberId] ?? membership.role}
                                    label="Role"
                                    onChange={(event) => handleRoleDraftChange(membership.memberId, event.target.value as TeamMembershipRole)}
                                  >
                                    <MenuItem value="admin">Admin</MenuItem>
                                    <MenuItem value="captain">Captain</MenuItem>
                                    <MenuItem value="player">Player</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>

                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormControl size="small" fullWidth>
                                  <InputLabel id={`membership-status-${membership.memberId}`}>Status</InputLabel>
                                  <Select
                                    labelId={`membership-status-${membership.memberId}`}
                                    value={draftStatuses[membership.memberId] ?? membership.status}
                                    label="Status"
                                    onChange={(event) => handleStatusDraftChange(membership.memberId, event.target.value as TeamMembershipStatus)}
                                  >
                                    <MenuItem value="active">Active</MenuItem>
                                    <MenuItem value="inactive">Inactive</MenuItem>
                                    <MenuItem value="invited">Invited</MenuItem>
                                    <MenuItem value="archived">Archived</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>

                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormControl size="small" fullWidth>
                                  <InputLabel id={`membership-season-${membership.memberId}`}>Season</InputLabel>
                                  <Select
                                    labelId={`membership-season-${membership.memberId}`}
                                    value={draftSeasonIds[membership.memberId] ?? membership.seasonId ?? ""}
                                    label="Season"
                                    onChange={(event) => handleSeasonDraftChange(membership.memberId, event.target.value)}
                                  >
                                    <MenuItem value="">Not Assigned</MenuItem>
                                    {seasons.map((season) => (
                                      <MenuItem key={season.id} value={season.id}>{season.name}</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>

                              <Grid size={{ xs: 12 }}>
                                <Typography variant="subtitle2" color="text.secondary">
                                  Linking
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                {canEditExternalNames ? (
                                  <FormControl size="small" fullWidth>
                                    <InputLabel id={`membership-user-${membership.memberId}`}>Linked User</InputLabel>
                                    <Select
                                      labelId={`membership-user-${membership.memberId}`}
                                      value={draftUserIds[membership.memberId] ?? membership.userId ?? ""}
                                      label="Linked User"
                                      onChange={(event) => handleUserDraftChange(membership.memberId, event.target.value)}
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
                                  <Stack spacing={0.5} sx={{ py: 0.75 }}>
                                    <Typography variant="caption" color="text.secondary">Linked User</Typography>
                                    <Typography variant="body2">{resolvedUserLabel}</Typography>
                                  </Stack>
                                )}
                              </Grid>

                              <Grid size={{ xs: 12, md: 6 }}>
                                {canEditExternalNames ? (
                                  <FormControl size="small" fullWidth>
                                    <InputLabel id={`membership-player-${membership.memberId}`}>Linked Player</InputLabel>
                                    <Select
                                      labelId={`membership-player-${membership.memberId}`}
                                      value={draftPlayerIds[membership.memberId] ?? membership.playerId ?? ""}
                                      label="Linked Player"
                                      onChange={(event) => handlePlayerDraftChange(membership.memberId, event.target.value)}
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
                                  <Stack spacing={0.5} sx={{ py: 0.75 }}>
                                    <Typography variant="caption" color="text.secondary">Linked Player</Typography>
                                    <Typography variant="body2">{resolvedPlayerLabel}</Typography>
                                  </Stack>
                                )}
                              </Grid>

                              <Grid size={{ xs: 12, md: 6 }}>
                                <Box
                                  sx={{
                                    borderRadius: 2,
                                    border: "1px solid",
                                    borderColor: "divider",
                                    px: 1.25,
                                    py: 1.25
                                  }}
                                >
                                  <Stack spacing={1}>
                                    <Stack
                                      direction={{ xs: "column", sm: "row" }}
                                      spacing={1}
                                      justifyContent="space-between"
                                      alignItems={{ xs: "flex-start", sm: "center" }}
                                    >
                                      <Typography variant="subtitle2" color="text.secondary">
                                        External Names
                                      </Typography>
                                      {canEditExternalNames && !isEditingExternalName && (
                                        <Button
                                          variant="text"
                                          size="small"
                                          startIcon={<AddRoundedIcon />}
                                          onClick={() => openExternalNameEditor(membership.memberId)}
                                          sx={{ minWidth: 0, px: 0.5 }}
                                        >
                                          Add External
                                        </Button>
                                      )}
                                    </Stack>

                                    {visibleExternalNames.length > 0 ? (
                                      <Stack spacing={1}>
                                        {visibleExternalNames.map((alias) => (
                                          <Stack
                                            key={alias.aliasId}
                                            direction={{ xs: "column", sm: "row" }}
                                            spacing={0.75}
                                            justifyContent="space-between"
                                            alignItems={{ xs: "flex-start", sm: "center" }}
                                            sx={{
                                              px: 1,
                                              py: 0.875,
                                              borderRadius: 1.5,
                                              backgroundColor: "action.hover"
                                            }}
                                          >
                                            <Typography variant="body2">{alias.alias}</Typography>
                                            {canEditExternalNames && (
                                              <Stack direction="row" spacing={1}>
                                                <Button
                                                  variant="text"
                                                  size="small"
                                                  startIcon={<EditRoundedIcon />}
                                                  onClick={() => openExistingExternalNameEditor(membership.memberId, alias)}
                                                  sx={{ minWidth: 0, px: 0.5 }}
                                                >
                                                  Edit
                                                </Button>
                                                <Button
                                                  variant="text"
                                                  size="small"
                                                  color="error"
                                                  startIcon={<DeleteOutlineRoundedIcon />}
                                                  onClick={() => void handleDeleteExternalName(membership, alias)}
                                                  disabled={savingAliasMemberId === membership.memberId}
                                                  sx={{ minWidth: 0, px: 0.5 }}
                                                >
                                                  Delete
                                                </Button>
                                              </Stack>
                                            )}
                                          </Stack>
                                        ))}
                                      </Stack>
                                    ) : (
                                      <Typography variant="body2" color="text.secondary">
                                        No external names added yet.
                                      </Typography>
                                    )}

                                    {canEditExternalNames && isEditingExternalName && (
                                      <Stack spacing={1}>
                                        <TextField
                                          size="small"
                                          fullWidth
                                          label="External Name"
                                          value={draftAliasInputs[membership.memberId] ?? ""}
                                          onChange={(event) => handleAliasInputChange(membership.memberId, event.target.value)}
                                          placeholder="Sharath"
                                          helperText={
                                            externalNameMatchesPrimaryName && editingExternalAlias
                                              ? "Saving this will reset the row to the member name."
                                              : "Use this for attendance sheets, scorecards, or legacy naming."
                                          }
                                        />
                                        <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75}>
                                          <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={() => void handleSaveExternalName(membership, editingExternalAlias)}
                                            disabled={
                                              savingAliasMemberId === membership.memberId
                                              || !(draftAliasInputs[membership.memberId] ?? "").trim()
                                            }
                                          >
                                            {savingAliasMemberId === membership.memberId
                                              ? "Saving..."
                                              : editingExternalAlias
                                                ? "Update External Name"
                                                : "Create External Name"}
                                          </Button>
                                          <Button
                                            variant="text"
                                            size="small"
                                            onClick={() => closeExternalNameEditor(membership.memberId)}
                                            disabled={savingAliasMemberId === membership.memberId}
                                          >
                                            Cancel
                                          </Button>
                                        </Stack>
                                      </Stack>
                                    )}
                                  </Stack>
                                </Box>
                              </Grid>

                              <Grid size={{ xs: 12, md: 6 }}>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} justifyContent="flex-end">
                                  <Button
                                    variant="text"
                                    size="small"
                                    startIcon={<RestartAltRoundedIcon />}
                                    onClick={() => resetMembershipDraft(membership)}
                                    disabled={savingMemberId === membership.memberId || savingAliasMemberId === membership.memberId}
                                  >
                                    Reset
                                  </Button>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<SaveRoundedIcon />}
                                    onClick={() => void handleSaveMembership(membership.memberId)}
                                    disabled={savingMemberId === membership.memberId || !hasPendingChanges}
                                  >
                                    {savingMemberId === membership.memberId ? "Saving..." : "Save"}
                                  </Button>
                                </Stack>
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
    </Container>
  );
}
