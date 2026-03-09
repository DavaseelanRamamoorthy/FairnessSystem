"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from "react";

import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Paper,
  Button,
  Modal,
  Snackbar,
  CircularProgress
} from "@mui/material";

import MatchDetailPanel from "@/app/components/matches/MatchDetailPanel";

import { parseMatchFromBase64 } from "@/app/services/pdfParser";
import { supabase } from "@/app/services/supabaseClient";
import { saveMatchToDatabase } from "@/app/services/matchInsertService";

import { currentTeamName } from "@/app/config/teamConfig";

type Match = Record<string, any>;

export default function MatchesPage() {

  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewMatch, setPreviewMatch] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ============================
  // Load Matches
  // ============================

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

  // ============================
  // File Upload
  // ============================

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {

      if (typeof reader.result !== "string") return;

      const base64 = reader.result.split(",")[1];
      if (!base64) return;

      setIsProcessing(true);

      const parsed = await parseMatchFromBase64(
        base64,
        currentTeamName
      );

      if (parsed) {
        setPreviewMatch(parsed);
      }

      setIsProcessing(false);
    };

    reader.readAsDataURL(file);

  };

  // ============================
  // Save Match
  // ============================

  const handleSaveMatch = async () => {

    if (!previewMatch) return;

    try {

      setIsProcessing(true);

      await saveMatchToDatabase(previewMatch);

      setToastMessage("Match saved successfully.");

      setPreviewMatch(null);

      await loadMatchesFromDB();

    } catch (error: any) {

      setToastMessage(error.message);

    } finally {

      setIsProcessing(false);

    }

  };

  return (

    <Box>

      {/* PAGE TITLE */}

      <Typography variant="h4" sx={{ mb: 4 }}>
        Matches
      </Typography>

      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>

        {/* ============================ */}
        {/* LEFT COLUMN — MATCH LIST */}
        {/* ============================ */}

        <Box sx={{ flex: { xs: "1 1 100%", md: "1 1 30%" } }}>

          <Stack spacing={2}>

            {matches.map((match) => (

              <Card
                key={match.id}
                onClick={() => setSelectedMatch(match)}
                sx={{
                  cursor: "pointer",
                  border:
                    selectedMatch?.id === match.id
                      ? "2px solid"
                      : "1px solid transparent",
                  borderColor:
                    selectedMatch?.id === match.id
                      ? "primary.main"
                      : "transparent"
                }}
              >

                <CardContent>

                  <Typography variant="body2" color="text.secondary">
                    {match.match_date}
                  </Typography>

                  <Typography variant="h6">
                    vs {match.opponent_name}
                  </Typography>

                  <Typography
                    color={
                      match.result === "Won"
                        ? "success.main"
                        : "error.main"
                    }
                  >
                    {match.result}
                  </Typography>

                </CardContent>

              </Card>

            ))}

          </Stack>

        </Box>

        {/* ============================ */}
        {/* RIGHT COLUMN — SCORECARD */}
        {/* ============================ */}

        <Box sx={{ flex: { xs: "1 1 100%", md: "1 1 65%" } }}>

          <Paper sx={{ p: 4, minHeight: 500 }}>

            {!selectedMatch ? (

              <Typography variant="h5" color="text.secondary">
                Click a match to view full scorecard
              </Typography>

            ) : (

              <MatchDetailPanel match={selectedMatch} />

            )}

          </Paper>

        </Box>

      </Box>

      {/* ============================ */}
      {/* FILE UPLOAD BUTTON */}
      {/* ============================ */}

      <Box sx={{ position: "fixed", bottom: 30, right: 30 }}>

        <Button
          variant="contained"
          size="large"
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

      {/* ============================ */}
      {/* PREVIEW MODAL */}
      {/* ============================ */}

      <Modal
        open={!!previewMatch}
        onClose={() => setPreviewMatch(null)}
      >

        <Box
          sx={{
            bgcolor: "background.paper",
            p: 4,
            borderRadius: 3,
            width: "90%",
            maxWidth: 700,
            mx: "auto",
            mt: "10vh"
          }}
        >

          <Typography variant="h4" gutterBottom>
            Match Preview
          </Typography>

          <Stack
            direction="row"
            spacing={2}
            justifyContent="flex-end"
          >

            <Button
              variant="outlined"
              onClick={() => setPreviewMatch(null)}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              onClick={handleSaveMatch}
            >
              Save Match
            </Button>

          </Stack>

        </Box>

      </Modal>

      {/* ============================ */}
      {/* LOADER */}
      {/* ============================ */}

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

      {/* ============================ */}
      {/* TOAST */}
      {/* ============================ */}

      <Snackbar
        open={!!toastMessage}
        autoHideDuration={3000}
        onClose={() => setToastMessage(null)}
        message={toastMessage}
      />

    </Box>

  );

}