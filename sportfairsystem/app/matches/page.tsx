"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState, useCallback } from "react";

import {
  Box,
  Typography,
  Paper,
  Button,
  Snackbar,
  CircularProgress
} from "@mui/material";

import MatchesTable from "@/app/components/matches/MatchesTable";
import MatchDetailPanel from "@/app/components/matches/MatchDetailPanel";
import MatchPreviewModal from "@/app/components/matches/MatchPreviewModal";

import { parseMatchFromBase64 } from "@/app/services/pdfParser";
import { supabase } from "@/app/services/supabaseClient";
import { saveMatchToDatabase } from "@/app/services/matchInsertService";
import { currentTeamName, currentTeamPrefix } from "@/app/config/teamConfig";
import { cleanName } from "@/app/services/cleanName";
import { buildMatchId } from "@/app/services/matchIdService";
import { isMatchForCurrentTeam } from "@/app/services/teamValidationService";

type Match = {
  id: string;
  match_date: string | null;
  opponent_name: string | null;
  result: string | null;
  match_code?: string | null;
  [key: string]: any;
};

type PreviewPlayer = {
  name: string;
  exists: boolean;
};

export default function MatchesPage() {

  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const [previewMatch, setPreviewMatch] = useState<any | null>(null);
  const [previewPlayers, setPreviewPlayers] = useState<PreviewPlayer[]>([]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /* --------------------------------
     LOAD MATCHES
  -------------------------------- */

  const loadMatchesFromDB = async () => {

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
      .order("match_date", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setMatches(data || []);

  };

  useEffect(() => {
    loadMatchesFromDB();
  }, []);

  /* --------------------------------
     PLAYER DETECTION
  -------------------------------- */

  const detectPlayers = useCallback(async (parsedMatch: any) => {

    const playerSet = new Set<string>();

    const ourInnings = parsedMatch.innings?.find(
      (inn: any) => inn.teamName === currentTeamName
    );

    const opponentInnings = parsedMatch.innings?.find(
      (inn: any) => inn.teamName !== currentTeamName
    );

    if (ourInnings) {

      ourInnings.battingStats?.forEach((b: any) => {
        if (b.player_name) {
          playerSet.add(cleanName(b.player_name));
        }
      });

    }

    if (opponentInnings) {

      opponentInnings.bowlingStats?.forEach((b: any) => {
        if (b.player_name) {
          playerSet.add(cleanName(b.player_name));
        }
      });

    }

    const players = Array.from(playerSet);

    const { data: dbPlayers } = await supabase
      .from("players")
      .select("name");

    const dbSet = new Set(
      (dbPlayers || []).map((p: any) => cleanName(p.name))
    );

    const result: PreviewPlayer[] = players.map((name) => ({
      name,
      exists: dbSet.has(name)
    }));

    setPreviewPlayers(result);

  }, []);

  /* --------------------------------
     FILE UPLOAD
  -------------------------------- */

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {

      if (typeof reader.result !== "string") return;

      const base64 = reader.result.split(",")[1];

      setIsProcessing(true);

      const parsed = await parseMatchFromBase64(
        base64,
        currentTeamName
      );

      if (parsed) {
        if (!isMatchForCurrentTeam(parsed, currentTeamName)) {
          setToastMessage(`This scorecard does not include ${currentTeamName}.`);
          setIsProcessing(false);
          return;
        }

        setPreviewMatch(parsed);

        await detectPlayers(parsed);

      }

      setIsProcessing(false);

    };

    reader.readAsDataURL(file);

  };

  /* --------------------------------
     SAVE MATCH
  -------------------------------- */

  const handleSaveMatch = async () => {

    if (!previewMatch) return;

    try {

      setIsProcessing(true);

      await saveMatchToDatabase(previewMatch);

      setToastMessage("Match saved successfully");

      setPreviewMatch(null);

      await loadMatchesFromDB();

    } catch (error: any) {

      setToastMessage(error.message);

    } finally {

      setIsProcessing(false);

    }

  };

  /* --------------------------------
     YET TO BAT
  -------------------------------- */

  const getYetToBat = (innings: any) => {

    if (!innings) return [];
    if (innings.teamName !== currentTeamName) return [];

    const battingNames =
      innings?.battingStats?.map((p: any) =>
        cleanName(p.player_name)
      ) || [];

    return previewPlayers
      .map((p) => p.name)
      .filter((name) => !battingNames.includes(name));

  };

  const getPreviewMatchId = () => {

    if (!previewMatch) {
      return buildMatchId(currentTeamPrefix, null);
    }

    const sameDayMatches = matches.filter(
      (match) => match.match_date === previewMatch.matchDate
    ).length;

    return buildMatchId(
      currentTeamPrefix,
      previewMatch?.matchDate ?? null,
      sameDayMatches
    );

  };

  /* --------------------------------
     PAGE UI
  -------------------------------- */

  return (

    <Box
      sx={{
        height: { md: "calc(100vh - 128px)" },
        display: "flex",
        flexDirection: "column",
        overflow: { md: "hidden" }
      }}
    >

      <Typography variant="h4" sx={{ mb: 3 }}>
        Matches
      </Typography>

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
              p: 4,
              minHeight: { xs: 500, md: 0 },
              height: { md: "100%" },
              overflowY: { md: "auto" }
            }}
          >

            {!selectedMatch ? (

              <Typography color="text.secondary">
                Click a match to view full scorecard
              </Typography>

            ) : (

              <MatchDetailPanel match={selectedMatch} />

            )}

          </Paper>

        </Box>

      </Box>

      {/* UPLOAD BUTTON */}

      <Box sx={{ position: "fixed", bottom: 30, right: 30 }}>

        <Button
          variant="contained"
          component="label"
        >

          Upload Scorecard

          <input
            hidden
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
          />

        </Button>

      </Box>

      {/* MATCH PREVIEW MODAL */}

      <MatchPreviewModal
        open={!!previewMatch}
        previewMatch={previewMatch}
        previewMatchId={previewMatch ? getPreviewMatchId() : currentTeamPrefix}
        previewPlayers={previewPlayers}
        onClose={() => setPreviewMatch(null)}
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

    </Box>

  );

}
