"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
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
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import PersonOffRoundedIcon from "@mui/icons-material/PersonOffRounded";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import { useAuth } from "@/app/context/AuthContext";
import { formatName } from "@/app/services/formatname";
import {
  getTeamUserMappings,
  hasPlayerUserMappingSupport,
  TeamUserMappingPlayer,
  TeamUserMappingRecord,
  updateTeamUserPlayerMapping
} from "@/app/services/userMappingService";

function MetricCard({
  label,
  value,
  helper
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <Card variant="outlined" sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={0.75}>
          <Typography variant="subtitle2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1 }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {helper}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function ConfigurePage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<TeamUserMappingRecord[]>([]);
  const [players, setPlayers] = useState<TeamUserMappingPlayer[]>([]);
  const [draftMappings, setDraftMappings] = useState<Record<string, string>>({});
  const [mappingColumnsReady, setMappingColumnsReady] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }

    let isActive = true;

    const loadMappings = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const mappingReady = await hasPlayerUserMappingSupport();

        if (!isActive) {
          return;
        }

        setMappingColumnsReady(mappingReady);

        if (!mappingReady) {
          setUsers([]);
          setPlayers([]);
          setDraftMappings({});
          return;
        }

        const nextData = await getTeamUserMappings();

        if (!isActive) {
          return;
        }

        setUsers(nextData.users);
        setPlayers(nextData.players);
        setDraftMappings(
          nextData.users.reduce<Record<string, string>>((result, user) => {
            result[user.id] = user.playerId ?? "";
            return result;
          }, {})
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        setUsers([]);
        setPlayers([]);
        setDraftMappings({});
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load player-user mappings."
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadMappings();

    return () => {
      isActive = false;
    };
  }, [isAdmin]);

  const assignedPlayerIds = useMemo(() => {
    return new Set(
      users
        .map((user) => draftMappings[user.id] ?? user.playerId ?? "")
        .filter(Boolean)
    );
  }, [draftMappings, users]);

  const mappedCount = users.filter((user) => Boolean(user.playerId)).length;
  const pendingCount = users.length - mappedCount;

  const handleDraftChange = (userId: string, value: string) => {
    setDraftMappings((current) => ({
      ...current,
      [userId]: value
    }));
    setSuccessMessage(null);
  };

  const handleSaveMapping = async (userId: string) => {
    const nextPlayerId = draftMappings[userId] || null;

    try {
      setSavingUserId(userId);
      setErrorMessage(null);
      setSuccessMessage(null);

      await updateTeamUserPlayerMapping(userId, nextPlayerId);

      const mappedPlayer = players.find((player) => player.id === nextPlayerId) ?? null;

      setUsers((currentUsers) => currentUsers.map((user) =>
        user.id === userId
          ? {
            ...user,
            playerId: nextPlayerId,
            playerName: mappedPlayer?.name ?? null
          }
          : user
      ));

      setSuccessMessage(
        mappedPlayer
          ? `Mapped ${users.find((user) => user.id === userId)?.displayName ?? "user"} to ${formatName(mappedPlayer.name)}.`
          : `Cleared the player mapping for ${users.find((user) => user.id === userId)?.displayName ?? "user"}.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not update the player-user mapping."
      );
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <Container maxWidth="xl">
      <Stack spacing={4}>
        <TeamPageHeader
          eyebrow="Admin Workspace"
          title="Player Mapping"
          description="Map authenticated team users to squad players so identity-sensitive workflows can rely on a stable player link."
        />

        {!isAdmin && (
          <AutoHideAlert severity="info" variant="outlined">
            Player mapping is available to admin users only.
          </AutoHideAlert>
        )}

        {mappingColumnsReady === false && (
          <AutoHideAlert severity="warning" variant="outlined">
            Player-user mapping is not available in this environment yet.
          </AutoHideAlert>
        )}

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {successMessage && (
          <AutoHideAlert severity="success" resetKey={successMessage}>
            {successMessage}
          </AutoHideAlert>
        )}

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
        ) : isAdmin && mappingColumnsReady ? (
          <>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard
                  label="Team Users"
                  value={users.length}
                  helper="Users already assigned to this team workspace"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard
                  label="Mapped"
                  value={mappedCount}
                  helper="Users currently linked to a squad player"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard
                  label="Pending"
                  value={pendingCount}
                  helper="Users still waiting for a player mapping"
                />
              </Grid>
            </Grid>

            <AutoHideAlert severity="info" variant="outlined">
              Admin-only workspace. This page shows team-assigned users whose `team_id` already matches the current team.
            </AutoHideAlert>

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <ManageAccountsRoundedIcon color="primary" />
                    <Stack spacing={0.25}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        Team User Mappings
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Assign each authenticated team user to the matching squad player. Each squad player can only be linked once.
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>

                {users.length === 0 ? (
                  <Box sx={{ px: 3, pb: 3 }}>
                    <Typography color="text.secondary">
                      No team-assigned users were found yet for this workspace.
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ display: { xs: "block", md: "none" }, px: 2, pb: 2 }}>
                      <Stack spacing={2}>
                        {users.map((user) => {
                          const draftPlayerId = draftMappings[user.id] ?? "";
                          const currentPlayerId = user.playerId ?? "";
                          const hasChanges = draftPlayerId !== currentPlayerId;

                          return (
                            <Card key={user.id} variant="outlined" sx={{ borderRadius: 2.5 }}>
                              <CardContent sx={{ p: 2 }}>
                                <Stack spacing={1.5}>
                                  <Stack spacing={0.35}>
                                    <Typography fontWeight={700}>
                                      {user.displayName}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {user.email}
                                    </Typography>
                                    {user.username && (
                                      <Typography variant="caption" color="text.secondary">
                                        @{user.username}
                                      </Typography>
                                    )}
                                  </Stack>

                                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                    <Chip
                                      label={user.role === "admin" ? "Admin" : "Member"}
                                      color={user.role === "admin" ? "primary" : "default"}
                                      size="small"
                                      variant={user.role === "admin" ? "filled" : "outlined"}
                                    />
                                    {user.playerId ? (
                                      <Chip
                                        icon={<LinkRoundedIcon />}
                                        label="Mapped"
                                        color="success"
                                        size="small"
                                        variant="outlined"
                                      />
                                    ) : (
                                      <Chip
                                        icon={<PersonOffRoundedIcon />}
                                        label="Pending"
                                        color="warning"
                                        size="small"
                                        variant="outlined"
                                      />
                                    )}
                                  </Stack>

                                  <FormControl size="small" fullWidth>
                                    <InputLabel id={`player-mapping-mobile-${user.id}`}>Player</InputLabel>
                                    <Select
                                      labelId={`player-mapping-mobile-${user.id}`}
                                      value={draftPlayerId}
                                      label="Player"
                                      onChange={(event) => handleDraftChange(user.id, event.target.value)}
                                    >
                                      <MenuItem value="">Not Assigned</MenuItem>
                                      {players.map((player) => {
                                        const isTakenElsewhere = assignedPlayerIds.has(player.id)
                                          && player.id !== draftPlayerId;

                                        return (
                                          <MenuItem
                                            key={player.id}
                                            value={player.id}
                                            disabled={isTakenElsewhere}
                                          >
                                            {formatName(player.name)}
                                          </MenuItem>
                                        );
                                      })}
                                    </Select>
                                  </FormControl>

                                  <Button
                                    fullWidth
                                    variant="contained"
                                    onClick={() => void handleSaveMapping(user.id)}
                                    disabled={!hasChanges || savingUserId === user.id}
                                  >
                                    {savingUserId === user.id ? "Saving..." : "Save Mapping"}
                                  </Button>
                                </Stack>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </Stack>
                    </Box>

                    <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: "24%" }}>User</TableCell>
                            <TableCell sx={{ width: "12%" }}>Access</TableCell>
                            <TableCell sx={{ width: "20%" }}>Current Status</TableCell>
                            <TableCell sx={{ width: "28%" }}>Mapped Player</TableCell>
                            <TableCell>Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {users.map((user) => {
                            const draftPlayerId = draftMappings[user.id] ?? "";
                            const currentPlayerId = user.playerId ?? "";
                            const hasChanges = draftPlayerId !== currentPlayerId;

                            return (
                              <TableRow key={user.id}>
                                <TableCell>
                                  <Stack spacing={0.35}>
                                    <Typography fontWeight={700}>
                                      {user.displayName}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {user.email}
                                    </Typography>
                                    {user.username && (
                                      <Typography variant="caption" color="text.secondary">
                                        @{user.username}
                                      </Typography>
                                    )}
                                  </Stack>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={user.role === "admin" ? "Admin" : "Member"}
                                    color={user.role === "admin" ? "primary" : "default"}
                                    size="small"
                                    variant={user.role === "admin" ? "filled" : "outlined"}
                                  />
                                </TableCell>
                                <TableCell>
                                  {user.playerId ? (
                                    <Chip
                                      icon={<LinkRoundedIcon />}
                                      label="Mapped"
                                      color="success"
                                      size="small"
                                      variant="outlined"
                                    />
                                  ) : (
                                    <Chip
                                      icon={<PersonOffRoundedIcon />}
                                      label="Pending"
                                      color="warning"
                                      size="small"
                                      variant="outlined"
                                    />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <FormControl size="small" fullWidth>
                                    <InputLabel id={`player-mapping-${user.id}`}>Player</InputLabel>
                                    <Select
                                      labelId={`player-mapping-${user.id}`}
                                      value={draftPlayerId}
                                      label="Player"
                                      onChange={(event) => handleDraftChange(user.id, event.target.value)}
                                    >
                                      <MenuItem value="">Not Assigned</MenuItem>
                                      {players.map((player) => {
                                        const isTakenElsewhere = assignedPlayerIds.has(player.id)
                                          && player.id !== draftPlayerId;

                                        return (
                                          <MenuItem
                                            key={player.id}
                                            value={player.id}
                                            disabled={isTakenElsewhere}
                                          >
                                            {formatName(player.name)}
                                          </MenuItem>
                                        );
                                      })}
                                    </Select>
                                  </FormControl>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="contained"
                                    onClick={() => void handleSaveMapping(user.id)}
                                    disabled={!hasChanges || savingUserId === user.id}
                                  >
                                    {savingUserId === user.id ? "Saving..." : "Save"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </Stack>
    </Container>
  );
}
