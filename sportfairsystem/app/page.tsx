'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Modal,
  Stack,
  Divider,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Snackbar,
  CircularProgress,
} from "@mui/material";

import {
  BarChart3,
  Plus,
  ClipboardList,
} from "lucide-react";

import Header from "./components/layout/Header";
import { parseMatchFromBase64 } from "./services/pdfParser";
import { supabase } from "@/app/services/supabaseClient";
import { saveMatchToDatabase } from "./services/matchInsertService";

const currentTeamName = "Moonwalkers";
type Match = Record<string, any>;

export default function App() {
  const [view, setView] = useState("dashboard");
  const [matches, setMatches] = useState<Match[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [previewMatch, setPreviewMatch] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load Matches
  const loadMatchesFromDB = async () => {
    const { data } = await supabase
      .from("matches")
      .select("*")
      .order("match_date", { ascending: false });

    setMatches(data || []);
  };

  useEffect(() => {
    loadMatchesFromDB();
  }, []);

  // File Upload
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

  // Save Match
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

  // Win Rate
  const winRate = useMemo(() => {
    if (matches.length === 0) return 0;
    const wins = matches.filter((m) => m.result === "Won").length;
    return ((wins / matches.length) * 100).toFixed(0);
  }, [matches]);

  return (
    <Box sx={{ minHeight: "100vh", pb: 10 }}>
      <Header
        teamName="Moonwalkers"
        isDarkMode={false}
        onToggleDarkMode={() => {}}
      />

      <Container maxWidth="lg" sx={{ py: 4 }}>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <Card>
            <CardContent sx={{ textAlign: "center" }}>
              <Typography variant="overline">
                Win Ratio
              </Typography>
              <Typography variant="h1">
                {winRate}%
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* MATCHES */}
        {view === "matches" && (
          <Box
            sx={{
              display: "flex",
              gap: 3,
              flexWrap: "wrap",
            }}
          >
            {/* LEFT COLUMN */}
            <Box sx={{ flex: { xs: "1 1 100%", md: "1 1 30%" } }}>
              <Stack spacing={2}>
                <Typography variant="h4">
                  Match Summary
                </Typography>

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
                          : "transparent",
                    }}
                  >
                    <CardContent>
                      <Typography variant="body2">
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

            {/* RIGHT COLUMN */}
            <Box sx={{ flex: { xs: "1 1 100%", md: "1 1 65%" } }}>
              <Paper sx={{ p: 4, minHeight: 400 }}>
                {!selectedMatch ? (
                  <Typography variant="h5" color="text.secondary">
                    Click Matches to display in Detail
                  </Typography>
                ) : (
                  <>
                    <Typography variant="h4" gutterBottom>
                      {selectedMatch.team_a} vs {selectedMatch.team_b}
                    </Typography>

                    <Typography gutterBottom>
                      Date: {selectedMatch.match_date}
                    </Typography>

                    <Typography
                      variant="h6"
                      color={
                        selectedMatch.result === "Won"
                          ? "success.main"
                          : "error.main"
                      }
                    >
                      Result: {selectedMatch.result}
                    </Typography>

                    <Divider sx={{ my: 3 }} />

                    <Typography>
                      Winner: {selectedMatch.winner}
                    </Typography>
                  </>
                )}
              </Paper>
            </Box>
          </Box>
        )}
      </Container>

      {/* BOTTOM NAV */}
      <Paper
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
        }}
        elevation={3}
      >
        <BottomNavigation
          value={view}
          onChange={(e, newValue) => setView(newValue)}
        >
          <BottomNavigationAction
            label="Dashboard"
            value="dashboard"
            icon={<BarChart3 />}
          />
          <BottomNavigationAction
            label="Matches"
            value="matches"
            icon={<ClipboardList />}
          />
          <BottomNavigationAction
            label="Upload"
            value="upload"
            icon={
              <label>
                <input
                  type="file"
                  hidden
                  accept="application/pdf"
                  onChange={handleFileUpload}
                />
                <Plus />
              </label>
            }
          />
        </BottomNavigation>
      </Paper>

      {/* PREVIEW MODAL */}
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
            maxWidth: 600,
            mx: "auto",
            mt: "10vh",
          }}
        >
          <Typography variant="h4" gutterBottom>
            Match Preview
          </Typography>

          <Stack direction="row" spacing={2} justifyContent="flex-end">
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

      {/* Loader */}
      {isProcessing && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {/* Toast */}
      <Snackbar
        open={!!toastMessage}
        autoHideDuration={3000}
        onClose={() => setToastMessage(null)}
        message={toastMessage}
      />
    </Box>
  );
}