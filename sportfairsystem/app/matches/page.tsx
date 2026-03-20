"use client";

import { useEffect, useState, useCallback } from "react";

import {
  Alert,
  Box,
  Typography,
  Paper,
  Fab,
  Snackbar,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";

import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import MatchesTable from "@/app/components/matches/MatchesTable";
import MatchDetailPanel from "@/app/components/matches/MatchDetailPanel";
import MatchPreviewModal from "@/app/components/matches/MatchPreviewModal";
import { useAuth } from "@/app/context/AuthContext";

import { parseMatchFromBase64 } from "@/app/services/pdfParser";
import { getCurrentTeamId } from "@/app/services/squadService";
import { supabase } from "@/app/services/supabaseClient";
import { saveMatchToDatabase } from "@/app/services/matchInsertService";
import { currentTeamName, currentTeamPrefix } from "@/app/config/teamConfig";
import { cleanName } from "@/app/services/cleanName";
import { buildMatchId } from "@/app/services/matchIdService";
import { isMatchForCurrentTeam } from "@/app/services/teamValidationService";
import { ParsedMatch, Innings } from "@/app/types/match.types";
import { getOpponentName } from "@/app/utils/matchOpponent";
import { deleteMatchFromDatabase } from "@/app/services/deleteMatchService";

type MatchPlayerRow = {
  id?: string;
  team_name: string | null;
  player_name: string;
};

type MatchInningsRow = {
  id?: string;
  team_name: string | null;
  runs: number | null;
  wickets: number | null;
  overs: number | null;
  extras?: number | null;
  batting_stats?: NonNullable<Innings["battingStats"]>;
  bowling_stats?: NonNullable<Innings["bowlingStats"]>;
  fall_of_wickets?: NonNullable<Innings["fallOfWickets"]>;
};

type Match = {
  id: string;
  team_a: string | null;
  team_b: string | null;
  match_date: string | null;
  opponent_name: string | null;
  result: string | null;
  winner?: string | null;
  match_code?: string | null;
  innings?: MatchInningsRow[];
  match_players?: MatchPlayerRow[];
};

type PreviewPlayer = {
  name: string;
  exists: boolean;
  isGuest: boolean;
  addToSquad: boolean;
};

type PreviewItem = {
  fileName: string;
  match: ParsedMatch;
  players: PreviewPlayer[];
};

type TeamPlayerRow = {
  name: string;
  is_guest: boolean | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function MatchesPage() {
  const { isAdmin } = useAuth();

  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

  const [previewQueue, setPreviewQueue] = useState<PreviewItem[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /* --------------------------------
     LOAD MATCHES
  -------------------------------- */

  const loadMatchesFromDB = async () => {
    try {
      setIsLoadingMatches(true);
      setLoadErrorMessage(null);

      const teamId = await getCurrentTeamId();
      const { data, error } = await supabase
        .from("matches")
        .select(`
          *,
          innings (
            *,
            batting_stats (*),
            bowling_stats (*),
            fall_of_wickets (*)
          ),
          match_players (*)
        `)
        .eq("team_id", teamId)
        .order("match_date", { ascending: false });

      if (error) {
        throw new Error("Could not load matches.");
      }

      const nextMatches = ((data ?? []) as Match[]).map((match) => ({
        ...match,
        opponent_name: getOpponentName(match.team_a, match.team_b, currentTeamName)
      }));

      setMatches(nextMatches);
      setSelectedMatch((currentMatch) =>
        currentMatch
          ? nextMatches.find((match) => match.id === currentMatch.id) ?? null
          : null
      );
    } catch (error) {
      const message = getErrorMessage(error, "Could not load matches.");

      setMatches([]);
      setSelectedMatch(null);
      setLoadErrorMessage(message);
    } finally {
      setIsLoadingMatches(false);
    }

  };

  useEffect(() => {
    void loadMatchesFromDB();
  }, []);

  /* --------------------------------
     PLAYER DETECTION
  -------------------------------- */

  const detectPlayers = useCallback(async (parsedMatch: ParsedMatch) => {

    const playerSet = new Set<string>();

    const currentTeamSquad = parsedMatch.squads?.find(
      (squad) => squad.teamName === currentTeamName
    );

    currentTeamSquad?.players.forEach((player) => {
      if (player.name) {
        playerSet.add(cleanName(player.name));
      }
    });

    const ourInnings = parsedMatch.innings?.find(
      (inn) => inn.teamName === currentTeamName
    );

    const opponentInnings = parsedMatch.innings?.find(
      (inn) => inn.teamName !== currentTeamName
    );

    if (ourInnings) {

      ourInnings.battingStats?.forEach((batter) => {
        if (batter.player_name) {
          playerSet.add(cleanName(batter.player_name));
        }
      });

      ourInnings.playing11?.forEach((playerName) => {
        playerSet.add(cleanName(playerName));
      });

    }

    if (opponentInnings) {

      opponentInnings.bowlingStats?.forEach((bowler) => {
        if (bowler.player_name) {
          playerSet.add(cleanName(bowler.player_name));
        }
      });

    }

    const players = Array.from(playerSet);
    const teamId = await getCurrentTeamId();

    const { data: dbPlayers } = await supabase
      .from("players")
      .select("name, is_guest")
      .eq("team_id", teamId);

    const dbPlayerMap = new Map(
      ((dbPlayers ?? []) as TeamPlayerRow[]).map((player) => [cleanName(player.name), player.is_guest === true])
    );

    const result: PreviewPlayer[] = players.map((name) => ({
      name,
      exists: dbPlayerMap.has(name) && dbPlayerMap.get(name) === false,
      isGuest: dbPlayerMap.get(name) === true,
      addToSquad: false
    }));

    return result;

  }, []);

  const currentPreview = previewQueue[0] ?? null;

  const closeCurrentPreview = () => {
    setPreviewQueue((currentQueue) => currentQueue.slice(1));
  };

  const clearPreviewQueue = () => {
    setPreviewQueue([]);
  };

  useEffect(() => {
    if (!isAdmin) {
      clearPreviewQueue();
      setIsDeleteDialogOpen(false);
    }
  }, [isAdmin]);

  const updateCurrentPreviewPlayers = (
    updater: (players: PreviewPlayer[]) => PreviewPlayer[]
  ) => {
    setPreviewQueue((currentQueue) => {
      if (currentQueue.length === 0) {
        return currentQueue;
      }

      const [currentPreviewItem, ...rest] = currentQueue;

      return [
        {
          ...currentPreviewItem,
          players: updater(currentPreviewItem.players)
        },
        ...rest
      ];
    });
  };

  const toggleAddToSquad = (playerName: string) => {
    updateCurrentPreviewPlayers((players) =>
      players.map((player) =>
        player.name === playerName
          ? { ...player, addToSquad: !player.addToSquad }
          : player
      )
    );
  };

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("Could not read the selected file."));
          return;
        }

        const [, base64] = reader.result.split(",");

        if (!base64) {
          reject(new Error("Could not extract scorecard data."));
          return;
        }

        resolve(base64);
      };

      reader.onerror = () => {
        reject(new Error(`Could not read ${file.name}.`));
      };

      reader.readAsDataURL(file);
    });

  /* --------------------------------
     FILE UPLOAD
  -------------------------------- */

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {

    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    e.target.value = "";

    setIsProcessing(true);

    try {
      const validPreviewItems: PreviewItem[] = [];
      const rejectedFiles: string[] = [];

      for (const file of files) {
        const base64 = await readFileAsBase64(file);
        const parsed = await parseMatchFromBase64(
          base64,
          currentTeamName
        );

        if (!parsed || !isMatchForCurrentTeam(parsed, currentTeamName)) {
          rejectedFiles.push(file.name);
          continue;
        }

        const players = await detectPlayers(parsed);

        validPreviewItems.push({
          fileName: file.name,
          match: parsed,
          players
        });
      }

      if (validPreviewItems.length > 0) {
        setPreviewQueue((currentQueue) => [
          ...currentQueue,
          ...validPreviewItems
        ]);
      }

      if (rejectedFiles.length > 0) {
        const rejectionMessage =
          rejectedFiles.length === 1
            ? `${rejectedFiles[0]} does not include ${currentTeamName}.`
            : `${rejectedFiles.length} files were skipped because they do not include ${currentTeamName}.`;

        setToastMessage(rejectionMessage);
      }
    } catch (error) {
      setToastMessage(getErrorMessage(error, "Could not process the selected scorecards."));
    } finally {
      setIsProcessing(false);
    }

  };

  /* --------------------------------
     SAVE MATCH
  -------------------------------- */

  const handleSaveMatch = async () => {

    if (!currentPreview) return;

    try {

      setIsProcessing(true);

      await saveMatchToDatabase(currentPreview.match, {
        sourceFileName: currentPreview.fileName,
        playersToAddToSquad: currentPreview.players
          .filter((player) => player.addToSquad)
          .map((player) => player.name)
      });

      setToastMessage(
        previewQueue.length > 1
          ? `${currentPreview.fileName} saved. Opening next preview.`
          : "Match saved successfully"
      );

      await loadMatchesFromDB();
      closeCurrentPreview();

    } catch (error) {
      setToastMessage(getErrorMessage(error, "Could not save the selected match."));

    } finally {

      setIsProcessing(false);

    }

  };

  /* --------------------------------
     YET TO BAT
  -------------------------------- */

  const getYetToBat = (innings: Innings | undefined) => {

    if (!innings) return [];
    if (innings.teamName !== currentTeamName) return [];

    const battingNames =
      innings?.battingStats?.map((player) =>
        cleanName(player.player_name)
      ) || [];

    return (currentPreview?.players ?? [])
      .map((p) => p.name)
      .filter((name) => !battingNames.includes(name));

  };

  const openDeleteDialog = () => {
    if (!selectedMatch?.id) {
      return;
    }

    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
  };

  const handleDeleteMatch = async () => {
    if (!selectedMatch?.id) {
      return;
    }

    try {
      setIsProcessing(true);
      await deleteMatchFromDatabase(selectedMatch.id);
      setToastMessage("Match deleted successfully");
      setSelectedMatch(null);
      closeDeleteDialog();
      await loadMatchesFromDB();
    } catch (error) {
      setToastMessage(getErrorMessage(error, "Could not delete the selected match."));
    } finally {
      setIsProcessing(false);
    }
  };

  const getPreviewMatchId = () => {

    if (!currentPreview) {
      return buildMatchId(currentTeamPrefix, null);
    }

    const sameDayMatches = matches.filter(
      (match) => match.match_date === currentPreview.match.matchDate
    ).length;

    return buildMatchId(
      currentTeamPrefix,
      currentPreview.match.matchDate,
      sameDayMatches
    );

  };

  /* --------------------------------
     PAGE UI
  -------------------------------- */

  return (

    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0
      }}
    >
      <Box sx={{ display: { xs: "block", md: "none" }, mb: 3 }}>
        <TeamPageHeader
          eyebrow="Scorecards"
          description="Review match scorecards, compare innings, and keep recent fixtures within easy reach."
        />
      </Box>

      {loadErrorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {loadErrorMessage}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(320px, 30%) minmax(0, 1fr)" },
          gap: 3,
          alignItems: "start",
          flex: 1,
          minHeight: 0
        }}
      >

        {/* MATCH LIST */}

        <Box
          sx={{
            minWidth: 0,
            position: { md: "sticky" },
            top: { md: 24 },
            height: { md: "100%" },
            minHeight: 0
          }}
        >

          <MatchesTable
            rows={matches}
            selectedMatchId={selectedMatch?.id}
            onSelectMatch={(match) => setSelectedMatch(match)}
          />

        </Box>

        {/* SCORECARD VIEW */}

        <Box
          sx={{
            minWidth: 0,
            minHeight: 0,
            height: { md: "100%" }
          }}
        >

          <Paper
            sx={{
              p: 0,
              minHeight: { xs: 500, md: 0 },
              height: { md: "100%" },
              overflowY: { md: "auto" },
              backgroundColor: "transparent",
              boxShadow: "none",
              border: "none"
            }}
          >

            {isLoadingMatches ? (

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

            ) : !selectedMatch ? (

              loadErrorMessage ? (
                <Typography color="text.secondary" sx={{ p: 4 }}>
                  Match list is unavailable right now.
                </Typography>
              ) : matches.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 4 }}>
                  No matches found yet. Upload scorecards to get started.
                </Typography>
              ) : (
                <Typography color="text.secondary" sx={{ p: 4 }}>
                  Click a match to view full scorecard.
                </Typography>
              )

            ) : (

              <MatchDetailPanel
                match={selectedMatch}
                onDelete={isAdmin ? openDeleteDialog : undefined}
              />

            )}

          </Paper>

        </Box>

      </Box>

      {/* UPLOAD BUTTON */}

      {isAdmin && (
        <Box sx={{ position: "fixed", bottom: { xs: 92, md: 30 }, right: { xs: 16, md: 30 } }}>

          <Box
            sx={{
              position: "relative",
              display: "inline-flex",
              "&::after": {
                content: '""',
                position: "absolute",
                left: "50%",
                bottom: -8,
                transform: "translateX(-50%)",
                width: 28,
                height: 4,
                borderRadius: 999,
                background: "linear-gradient(180deg, var(--app-danger-main) 0%, var(--app-warning-main) 100%)"
              }
            }}
          >

            <Tooltip title="Upload Scorecard" placement="left">
              <Fab
                size="medium"
                component="label"
                aria-label="Upload scorecards"
                sx={{
                  width: 48,
                  height: 48,
                  color: "#FFFFFF",
                  background: "linear-gradient(135deg, var(--app-header-start) 0%, var(--app-header-mid) 62%, var(--app-header-end) 100%)",
                  boxShadow: (theme) => `0 12px 28px ${alpha(theme.palette.primary.dark, 0.22)}`,
                  "&:hover": {
                    background: "linear-gradient(135deg, var(--app-header-start) 0%, var(--app-header-mid) 62%, var(--app-header-end) 100%)"
                  }
                }}
              >
                <AddIcon />

                <input
                  hidden
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={handleFileUpload}
                />

              </Fab>
            </Tooltip>

          </Box>

        </Box>
      )}

      {/* MATCH PREVIEW MODAL */}

      <MatchPreviewModal
        open={!!currentPreview}
        previewMatch={currentPreview?.match ?? null}
        previewMatchId={currentPreview ? getPreviewMatchId() : currentTeamPrefix}
        previewPlayers={currentPreview?.players ?? []}
        previewTitle={currentPreview?.fileName}
        previewQueueLabel={
          previewQueue.length > 1
            ? `1 of ${previewQueue.length}`
            : undefined
        }
        onToggleAddToSquad={toggleAddToSquad}
        onClose={clearPreviewQueue}
        onSave={handleSaveMatch}
        getYetToBat={getYetToBat}
      />

      {/* LOADER */}

      {isProcessing && (

        <Box
          sx={{
            position: "fixed",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}
        >

          <CircularProgress />

        </Box>

      )}

      {/* TOAST */}

      <Snackbar
        open={!!toastMessage}
        autoHideDuration={3000}
        onClose={() => setToastMessage(null)}
        message={toastMessage}
      />

      {isAdmin && (
        <Dialog
          open={isDeleteDialogOpen}
          onClose={closeDeleteDialog}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Delete Match</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will permanently remove the selected match and all related scorecard data.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={closeDeleteDialog} variant="outlined">
              Cancel
            </Button>
            <Button onClick={handleDeleteMatch} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}

    </Box>

  );

}
