"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
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
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import { useAuth } from "@/app/context/AuthContext";
import { formatName } from "@/app/services/formatname";
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
  TeamMembershipUserOption,
  TeamMembershipStatus,
  updateTeamMembershipLinkedPlayer,
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

function getRoleChipColor(role: TeamMembershipRecord["role"]) {
  if (role === "admin") return "primary" as const;
  if (role === "captain") return "secondary" as const;
  return "default" as const;
}

function normalizeExternalNameInput(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export default function MembershipsPage() {
  const { isAdmin } = useAuth();
  const [memberships, setMemberships] = useState<TeamMembershipRecord[]>([]);
  const [seasons, setSeasons] = useState<MembershipSeasonRecord[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [selectedRole, setSelectedRole] = useState("all");
  const [draftStatuses, setDraftStatuses] = useState<Record<string, TeamMembershipStatus>>({});
  const [draftSeasonIds, setDraftSeasonIds] = useState<Record<string, string>>({});
  const [draftUserIds, setDraftUserIds] = useState<Record<string, string>>({});
  const [draftPlayerIds, setDraftPlayerIds] = useState<Record<string, string>>({});
  const [draftAliasInputs, setDraftAliasInputs] = useState<Record<string, string>>({});
  const [editingExternalNameMemberId, setEditingExternalNameMemberId] = useState<string | null>(null);
  const [teamUserOptions, setTeamUserOptions] = useState<TeamMembershipUserOption[]>([]);
  const [teamPlayerOptions, setTeamPlayerOptions] = useState<TeamMembershipPlayerOption[]>([]);
  const [canEditExternalNames, setCanEditExternalNames] = useState(false);
  const [membershipFoundationReady, setMembershipFoundationReady] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [savingAliasMemberId, setSavingAliasMemberId] = useState<string | null>(null);
  const [deletingAliasId, setDeletingAliasId] = useState<string | null>(null);
  const [isCreatingSeason, setIsCreatingSeason] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [seasonNameInput, setSeasonNameInput] = useState("");
  const [seasonStartDateInput, setSeasonStartDateInput] = useState("");
  const [seasonEndDateInput, setSeasonEndDateInput] = useState("");
  const [seasonActiveInput, setSeasonActiveInput] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }

    let isActive = true;

    const loadMembershipWorkspace = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const foundationReady = await hasMembershipFoundationSupport();

        if (!isActive) return;

        setMembershipFoundationReady(foundationReady);

        if (!foundationReady) {
          setMemberships([]);
          setSeasons([]);
          setTeamUserOptions([]);
          setTeamPlayerOptions([]);
          setDraftAliasInputs({});
          setDraftStatuses({});
          setDraftSeasonIds({});
          setDraftUserIds({});
          setDraftPlayerIds({});
          setCanEditExternalNames(false);
          return;
        }

        const nextCanEditExternalNames = await canManageExternalNames();

        if (!isActive) return;

        const [nextMemberships, nextSeasons, nextTeamUserOptions, nextTeamPlayerOptions] = await Promise.all([
          getTeamMembershipRecords(),
          getMembershipSeasons(),
          nextCanEditExternalNames ? getTeamMembershipUserOptions() : Promise.resolve([]),
          nextCanEditExternalNames ? getTeamMembershipPlayerOptions() : Promise.resolve([])
        ]);

        if (!isActive) return;

        setMemberships(nextMemberships);
        setSeasons(nextSeasons);
        setCanEditExternalNames(nextCanEditExternalNames);
        setTeamUserOptions(nextTeamUserOptions);
        setTeamPlayerOptions(nextTeamPlayerOptions);
        setDraftAliasInputs({});
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
        if (!isActive) return;
        setMemberships([]);
        setSeasons([]);
        setTeamUserOptions([]);
        setTeamPlayerOptions([]);
        setCanEditExternalNames(false);
        setDraftAliasInputs({});
        setDraftStatuses({});
        setDraftSeasonIds({});
        setDraftUserIds({});
        setDraftPlayerIds({});
        setErrorMessage(error instanceof Error ? error.message : "Could not load the membership workspace.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadMembershipWorkspace();

    return () => {
      isActive = false;
    };
  }, [isAdmin]);

  const filteredMemberships = useMemo(() => {
    return memberships.filter((membership) => {
      const seasonMatches = selectedSeason === "all" || membership.seasonId === selectedSeason;
      const statusMatches = selectedStatus === "all" || membership.status === selectedStatus;
      const roleMatches = selectedRole === "all" || membership.role === selectedRole;
      return seasonMatches && statusMatches && roleMatches;
    });
  }, [memberships, selectedRole, selectedSeason, selectedStatus]);

  const activeSeasonCount = seasons.filter((season) => season.isActive).length;
  const activeMemberCount = memberships.filter((membership) => membership.status === "active").length;
  const inactiveMemberCount = memberships.filter((membership) => membership.status === "inactive").length;
  const fullyLinkedCount = memberships.filter((membership) => membership.userId && membership.playerId).length;

  const handleAliasInputChange = (memberId: string, alias: string) => {
    setDraftAliasInputs((current) => ({ ...current, [memberId]: alias }));
    setSuccessMessage(null);
  };

  const openExternalNameEditor = (memberId: string, currentExternalName?: string | null) => {
    setDraftAliasInputs((current) => ({
      ...current,
      [memberId]: currentExternalName ?? ""
    }));
    setEditingExternalNameMemberId(memberId);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const closeExternalNameEditor = (memberId: string) => {
    setEditingExternalNameMemberId((current) => (current === memberId ? null : current));
    setDraftAliasInputs((current) => ({ ...current, [memberId]: "" }));
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

  const handleSaveMembership = async (memberId: string) => {
    const currentMembership = memberships.find((membership) => membership.memberId === memberId);
    const nextStatus = draftStatuses[memberId];
    const nextSeasonId = draftSeasonIds[memberId] || null;
    const nextUserId = draftUserIds[memberId] || null;
    const nextPlayerId = draftPlayerIds[memberId] || null;

    if (
      !currentMembership
      || !nextStatus
      || (
        nextStatus === currentMembership.status
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

  const handleCreateAlias = async (memberId: string) => {
    const aliasInput = (draftAliasInputs[memberId] ?? "").trim();

    if (!aliasInput) {
      return;
    }

    try {
      setSavingAliasMemberId(memberId);
      setErrorMessage(null);
      setSuccessMessage(null);

      const result = await createTeamMemberAlias(memberId, aliasInput, "legacy");

      setMemberships((current) =>
        current.map((membership) => {
          if (membership.memberId !== result.memberId) {
            return membership;
          }

          return {
            ...membership,
            aliases: [...membership.aliases, result.alias].sort((left, right) => {
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
      setDraftAliasInputs((current) => ({ ...current, [memberId]: "" }));
      setEditingExternalNameMemberId((current) => (current === memberId ? null : current));
      setSuccessMessage("Added the new external name.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create the external name.");
    } finally {
      setSavingAliasMemberId(null);
    }
  };

  const handleDeleteAlias = async (memberId: string, alias: TeamMemberAliasRecord) => {
    try {
      setDeletingAliasId(alias.aliasId);
      setErrorMessage(null);
      setSuccessMessage(null);

      await deleteTeamMemberAlias(alias.aliasId);

      setMemberships((current) =>
        current.map((membership) =>
          membership.memberId === memberId
            ? {
              ...membership,
              aliases: membership.aliases.filter((entry) => entry.aliasId !== alias.aliasId)
            }
            : membership
        )
      );
      setSuccessMessage(`Removed alias ${alias.alias}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not delete the alias.");
    } finally {
      setDeletingAliasId(null);
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
      }

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

      closeExternalNameEditor(membership.memberId);
      setSuccessMessage(existingAlias ? "Updated the external name." : "Added the new external name.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save the external name.");
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
                <MetricCard label="Team Members" value={memberships.length} helper="V2 membership records for the current team" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <MetricCard label="Active Members" value={activeMemberCount} helper="Current players and active team members" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <MetricCard label="Inactive Members" value={inactiveMemberCount} helper="Past players preserved for history" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <MetricCard label="Fully Linked" value={fullyLinkedCount} helper="Members linked to both user and player" />
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
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Member</TableCell>
                          <TableCell>Role</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Season</TableCell>
                          <TableCell>Linked User</TableCell>
                          <TableCell>Linked Player</TableCell>
                          <TableCell>External Names</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredMemberships.map((membership) => {
                          const visibleExternalNames = membership.aliases.filter((alias) => !alias.isPrimary);
                          const existingExternalName = visibleExternalNames[0] ?? null;
                          const effectiveCoveredName = formatName(membership.name);
                          const isEditingExternalName = editingExternalNameMemberId === membership.memberId;
                          const externalNameMatchesPrimaryName =
                            normalizeExternalNameInput(draftAliasInputs[membership.memberId] ?? "")
                            === normalizeExternalNameInput(membership.name);

                          return (
                          <TableRow key={membership.memberId}>
                            <TableCell>
                              <Stack spacing={0.35}>
                                <Typography fontWeight={700}>{formatName(membership.name)}</Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Chip label={membership.role} color={getRoleChipColor(membership.role)} size="small" variant={membership.role === "player" ? "outlined" : "filled"} />
                            </TableCell>
                            <TableCell>
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
                            </TableCell>
                            <TableCell>
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
                            </TableCell>
                            <TableCell>
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
                                        option.linkedMemberId === null
                                        || option.linkedMemberId === membership.memberId
                                      )
                                      .map((option) => (
                                        <MenuItem key={option.userId} value={option.userId}>
                                          {option.displayName}{option.email ? ` (${option.email})` : ""}
                                        </MenuItem>
                                      ))}
                                  </Select>
                                </FormControl>
                              ) : (
                                <Stack spacing={0.35}>
                                  <Typography variant="body2">{membership.userDisplayName ?? membership.userEmail ?? "Not Linked"}</Typography>
                                  {membership.userEmail && membership.userDisplayName !== membership.userEmail && (
                                    <Typography variant="caption" color="text.secondary">{membership.userEmail}</Typography>
                                  )}
                                </Stack>
                              )}
                            </TableCell>
                            <TableCell>
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
                                        option.linkedMemberId === null
                                        || option.linkedMemberId === membership.memberId
                                      )
                                      .map((option) => (
                                        <MenuItem key={option.playerId} value={option.playerId}>
                                          {option.displayName}{option.isGuest ? " (Guest)" : ""}
                                        </MenuItem>
                                      ))}
                                  </Select>
                                </FormControl>
                              ) : (
                                <Typography variant="body2">
                                  {membership.playerName ? formatName(membership.playerName) : "Not Linked"}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ minWidth: 320 }}>
                              <Stack spacing={1.25}>
                                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                                  {visibleExternalNames.length > 0 ? visibleExternalNames.map((alias) => (
                                    <Chip
                                      key={alias.aliasId}
                                      label={alias.alias}
                                      size="small"
                                      color="default"
                                      variant="outlined"
                                      disabled={deletingAliasId === alias.aliasId}
                                    />
                                  )) : (
                                    <Chip
                                      label={effectiveCoveredName}
                                      size="small"
                                      color="default"
                                      variant="outlined"
                                    />
                                  )}

                                  {canEditExternalNames && !isEditingExternalName ? (
                                    <Button
                                      variant="text"
                                      size="small"
                                      onClick={() => openExternalNameEditor(membership.memberId, existingExternalName?.alias ?? "")}
                                    >
                                      Edit
                                    </Button>
                                  ) : null}
                                </Stack>

                                {canEditExternalNames && isEditingExternalName ? (
                                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      label="External Name"
                                      value={draftAliasInputs[membership.memberId] ?? ""}
                                      onChange={(event) => handleAliasInputChange(membership.memberId, event.target.value)}
                                      placeholder="Sharath"
                                      helperText={
                                        externalNameMatchesPrimaryName && existingExternalName
                                          ? "Saving this will reset the row to the member name."
                                          : undefined
                                      }
                                    />
                                    <Stack direction="row" spacing={1}>
                                      <Button
                                        variant="outlined"
                                        onClick={() => void handleSaveExternalName(membership, existingExternalName)}
                                        disabled={
                                          savingAliasMemberId === membership.memberId
                                          || !(draftAliasInputs[membership.memberId] ?? "").trim()
                                        }
                                      >
                                        {savingAliasMemberId === membership.memberId ? "Saving..." : "Save"}
                                      </Button>
                                      <Button
                                        variant="text"
                                        onClick={() => closeExternalNameEditor(membership.memberId)}
                                        disabled={savingAliasMemberId === membership.memberId}
                                      >
                                        Cancel
                                      </Button>
                                    </Stack>
                                  </Stack>
                                ) : null}
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="contained"
                                onClick={() => void handleSaveMembership(membership.memberId)}
                                disabled={
                                  savingMemberId === membership.memberId
                                  || (
                                    (draftStatuses[membership.memberId] ?? membership.status) === membership.status
                                    && (draftSeasonIds[membership.memberId] ?? membership.seasonId ?? "") === (membership.seasonId ?? "")
                                    && (draftUserIds[membership.memberId] ?? membership.userId ?? "") === (membership.userId ?? "")
                                    && (draftPlayerIds[membership.memberId] ?? membership.playerId ?? "") === (membership.playerId ?? "")
                                  )
                                }
                              >
                                {savingMemberId === membership.memberId ? "Saving..." : "Save"}
                              </Button>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </Stack>
    </Container>
  );
}
