"use client";

import { useMemo, useState } from "react";

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";

import {
  primarySquadRoleTagOptions,
  SquadMetadataValues,
  squadRoleTagOptions
} from "@/app/services/squadService";
import type { SeasonOption } from "@/app/services/playerProfileService";

export type CreateRosterPlayerValues = SquadMetadataValues & {
  name: string;
  seasonId: string;
  status: "active" | "inactive" | "invited" | "archived";
};

type Props = {
  open: boolean;
  seasons: SeasonOption[];
  defaultSeasonId: string;
  title?: string;
  saveLabel?: string;
  helperText?: string;
  initialValues?: Partial<CreateRosterPlayerValues> | null;
  statusOptions?: Array<CreateRosterPlayerValues["status"]>;
  showSeasonStatusFields?: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: CreateRosterPlayerValues) => Promise<void>;
};

function buildInitialValues(
  defaultSeasonId: string,
  initialValues?: Partial<CreateRosterPlayerValues> | null
): CreateRosterPlayerValues {
  return {
    name: initialValues?.name ?? "",
    seasonId: initialValues?.seasonId ?? defaultSeasonId,
    status: initialValues?.status ?? "active",
    battingStyle: initialValues?.battingStyle ?? "",
    isCaptain: initialValues?.isCaptain ?? false,
    isWicketKeeper: initialValues?.isWicketKeeper ?? false,
    roleTags: initialValues?.roleTags?.length ? initialValues.roleTags : ["Batter"]
  };
}

export default function PlayerRosterDialog({
  open,
  seasons,
  defaultSeasonId,
  title = "Add Player",
  saveLabel = "Create Player",
  helperText = "Add a roster member and linked player profile together so the squad is ready before scorecards arrive.",
  initialValues,
  statusOptions = ["active", "inactive"],
  showSeasonStatusFields = true,
  isSaving,
  onClose,
  onSave
}: Props) {
  const [formValues, setFormValues] = useState<CreateRosterPlayerValues>(buildInitialValues(defaultSeasonId, initialValues));

  const primaryRoleCount = useMemo(
    () => formValues.roleTags.filter((roleTag) =>
      primarySquadRoleTagOptions.includes(roleTag as (typeof primarySquadRoleTagOptions)[number])
    ).length,
    [formValues.roleTags]
  );

  const primaryRoleError = primaryRoleCount === 0
    ? "Choose one primary role: Batter, Bowler, or All-Rounder."
    : primaryRoleCount > 1
      ? "Only one primary role can be selected for a player."
      : null;

  const handleRoleTagToggle = (roleTag: string) => {
    setFormValues((current) => {
      const hasRoleTag = current.roleTags.includes(roleTag);
      const isPrimaryRole = primarySquadRoleTagOptions.includes(
        roleTag as (typeof primarySquadRoleTagOptions)[number]
      );

      if (hasRoleTag) {
        return {
          ...current,
          roleTags: current.roleTags.filter((tag) => tag !== roleTag)
        };
      }

      if (isPrimaryRole) {
        const secondaryTags = current.roleTags.filter((tag) => !primarySquadRoleTagOptions.includes(
          tag as (typeof primarySquadRoleTagOptions)[number]
        ));

        return {
          ...current,
          roleTags: [...secondaryTags, roleTag]
        };
      }

      return {
        ...current,
        roleTags: [...current.roleTags, roleTag]
      };
    });
  };

  const handleSave = async () => {
    await onSave({
      ...formValues,
      battingStyle: formValues.battingStyle ?? ""
    });
  };

  return (
    <Dialog open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {helperText}
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Player Name"
                value={formValues.name}
                onChange={(event) => {
                  setFormValues((current) => ({
                    ...current,
                    name: event.target.value
                  }));
                }}
                placeholder="John Doe"
                fullWidth
                autoFocus
              />
            </Grid>

            {showSeasonStatusFields && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel id="player-roster-season-label">Season</InputLabel>
                    <Select
                      labelId="player-roster-season-label"
                      value={formValues.seasonId}
                      label="Season"
                      onChange={(event) => {
                        setFormValues((current) => ({
                          ...current,
                          seasonId: event.target.value
                        }));
                      }}
                    >
                      {seasons.map((season) => (
                        <MenuItem key={season.value} value={season.value}>
                          {season.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel id="player-roster-status-label">Status</InputLabel>
                    <Select
                      labelId="player-roster-status-label"
                      value={formValues.status}
                      label="Status"
                      onChange={(event) => {
                        setFormValues((current) => ({
                          ...current,
                          status: event.target.value as "active" | "inactive" | "invited" | "archived"
                        }));
                      }}
                    >
                      {statusOptions.includes("active") && <MenuItem value="active">Active</MenuItem>}
                      {statusOptions.includes("inactive") && <MenuItem value="inactive">Inactive</MenuItem>}
                      {statusOptions.includes("invited") && <MenuItem value="invited">Invited</MenuItem>}
                      {statusOptions.includes("archived") && <MenuItem value="archived">Archived</MenuItem>}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Batting Style"
                value={formValues.battingStyle ?? ""}
                onChange={(event) => {
                  setFormValues((current) => ({
                    ...current,
                    battingStyle: event.target.value
                  }));
                }}
                placeholder="RHB / LHB"
                fullWidth
              />
            </Grid>
          </Grid>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
          >
            <FormControlLabel
              control={(
                <Switch
                  checked={formValues.isCaptain}
                  onChange={(event) => {
                    setFormValues((current) => ({
                      ...current,
                      isCaptain: event.target.checked
                    }));
                  }}
                />
              )}
              label="Captain"
            />

            <FormControlLabel
              control={(
                <Switch
                  checked={formValues.isWicketKeeper}
                  onChange={(event) => {
                    setFormValues((current) => ({
                      ...current,
                      isWicketKeeper: event.target.checked
                    }));
                  }}
                />
              )}
              label="Wicket Keeper"
            />
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2">Role Tags</Typography>

            <FormGroup row>
              {squadRoleTagOptions.map((roleTag) => (
                <FormControlLabel
                  key={roleTag}
                  control={(
                    <Checkbox
                      checked={formValues.roleTags.includes(roleTag)}
                      onChange={() => handleRoleTagToggle(roleTag)}
                    />
                  )}
                  label={roleTag}
                />
              ))}
            </FormGroup>

            {primaryRoleError && (
              <Typography variant="caption" color="error">
                {primaryRoleError}
              </Typography>
            )}
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} variant="outlined" disabled={isSaving}>
          Cancel
        </Button>

        <Button
          onClick={() => void handleSave()}
          variant="contained"
          disabled={
            isSaving
            || !formValues.name.trim()
            || !formValues.seasonId
            || primaryRoleError !== null
          }
        >
          {isSaving ? "Saving..." : saveLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
