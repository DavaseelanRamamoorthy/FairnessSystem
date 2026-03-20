"use client";

import { useEffect, useState } from "react";

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";

import { formatName } from "@/app/services/formatname";
import {
  primarySquadRoleTagOptions,
  SquadMetadataValues,
  squadRoleTagOptions
} from "@/app/services/squadService";

type EditableSquadPlayer = {
  id: string;
  name: string;
  battingStyle: string | null;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  roleTags: string[];
};

type Props = {
  open: boolean;
  player: EditableSquadPlayer | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (playerId: string, values: SquadMetadataValues) => Promise<void>;
};

function createInitialValues(player: EditableSquadPlayer | null): SquadMetadataValues {
  return {
    battingStyle: player?.battingStyle ?? "",
    isCaptain: player?.isCaptain ?? false,
    isWicketKeeper: player?.isWicketKeeper ?? false,
    roleTags: player?.roleTags ?? []
  };
}

export default function SquadMetadataDialog({
  open,
  player,
  isSaving,
  onClose,
  onSave
}: Props) {
  const [formValues, setFormValues] = useState<SquadMetadataValues>(createInitialValues(player));

  useEffect(() => {
    setFormValues(createInitialValues(player));
  }, [player]);

  const primaryRoleCount = formValues.roleTags.filter((roleTag) =>
    primarySquadRoleTagOptions.includes(roleTag as (typeof primarySquadRoleTagOptions)[number])
  ).length;
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
    if (!player) {
      return;
    }

    await onSave(player.id, {
      battingStyle: formValues.battingStyle,
      isCaptain: formValues.isCaptain,
      isWicketKeeper: formValues.isWicketKeeper,
      roleTags: formValues.roleTags
    });
  };

  return (
    <Dialog open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {player ? `Edit Squad Metadata: ${formatName(player.name)}` : "Edit Squad Metadata"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            These controls are intended for team admins. They are UI-gated only until auth and
            RLS rules are added.
          </Typography>

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

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Role Tags
            </Typography>

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
              <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
                {primaryRoleError}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} variant="outlined" disabled={isSaving}>
          Cancel
        </Button>

        <Button
          onClick={() => void handleSave()}
          variant="contained"
          disabled={!player || isSaving || primaryRoleError !== null}
        >
          Save Metadata
        </Button>
      </DialogActions>
    </Dialog>
  );
}
