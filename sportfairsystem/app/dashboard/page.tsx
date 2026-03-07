"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip
} from "@mui/material";

import SportsCricketIcon from "@mui/icons-material/SportsCricket";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { currentTeamName } from "@/app/config/teamConfig";
import DashboardCard from "@/app/components/dashboard/dashboardCard";
import SectionHeader from "@/app/components/dashboard/SectionHeader";
import RunsTrendChart from "@/app/components/dashboard/RunsTrendChart";
import WicketsTrendChart from "@/app/components/dashboard/WicketsTrendChart";
import { formatName } from "@/app/services/formatname";
import { formatDate } from "@/app/utils/formatDate";


import {
  getMatchesPlayed,
  getWinRate,
  getTopRunScorer,
  getTopWicketTaker,
  getTopRunLeaders,
  getTopWicketLeaders,
  getRunsPerMatch,
  getWicketsPerMatch
} from "@/app/services/statsService";

import { supabase } from "@/app/services/supabaseClient";

type Match = Record<string, any>;

export default function DashboardPage() {

  const [matchesPlayed, setMatchesPlayed] = useState(0);
  const [winRate, setWinRate] = useState(0);

  const [topRunScorer, setTopRunScorer] = useState<any>(null);
  const [topWicketTaker, setTopWicketTaker] = useState<any>(null);

  const [matches, setMatches] = useState<Match[]>([]);
  const [runLeaders, setRunLeaders] = useState<any[]>([]);
  const [wicketLeaders, setWicketLeaders] = useState<any[]>([]);
  const [runsTrend, setRunsTrend] = useState<any[]>([]);
  const [wicketsTrend, setWicketsTrend] = useState<any[]>([]);

  // ============================
  // Load Dashboard Stats
  // ============================

  const loadDashboardStats = async () => {

  const matchesPlayedValue = await getMatchesPlayed();
  const winRateValue = await getWinRate();
  const runScorer = await getTopRunScorer();
  const wicketTaker = await getTopWicketTaker();
  const leaders = await getTopRunLeaders(5);
  const wickets = await getTopWicketLeaders(5);
  const runs = await getRunsPerMatch(currentTeamName); 
  const wicketsTrendData = await getWicketsPerMatch(currentTeamName);

  setMatchesPlayed(matchesPlayedValue);
  setWinRate(winRateValue);
  setTopRunScorer(runScorer);
  setTopWicketTaker(wicketTaker);
  setRunLeaders(leaders);
  setWicketLeaders(wickets);
  setRunsTrend(runs);
  setWicketsTrend(wicketsTrendData);
};

  // ============================
  // Load Recent Matches
  // ============================

  const loadMatches = async () => {

    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("match_date", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setMatches(data || []);
  };

  useEffect(() => {
    loadDashboardStats();
    loadMatches();
  }, []);

  const recentMatches = matches.slice(0, 5);

  return (

    <Box>
      {/* ============================ */}
      {/* KPI CARDS */}
      {/* ============================ */}

      <Grid container spacing={3} sx={{ mb: 4 }}>

        <Grid size={{ xs: 12, md: 3 }}>
          <DashboardCard
            title="Matches Played"
            value={matchesPlayed}
            icon={<SportsCricketIcon color="primary" />}
            color="primary.light"
          />
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <DashboardCard
            title="Win Ratio"
            value={`${winRate}%`}
            icon={<TrendingUpIcon color="success" />}
            color="success.light"
          />
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <DashboardCard
            title="Top Run Scorer"
            value={
              topRunScorer
                ? `${formatName(topRunScorer.player)} — ${topRunScorer.runs}`
                : "-"
            }
            icon={<EmojiEventsIcon color="warning" />}
            color="warning.light"
          />
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <DashboardCard
            title="Top Wicket Taker"
            value={
              topWicketTaker
                ? `${formatName(topWicketTaker.player)} — ${topWicketTaker.wickets}`
                : "-"
            }
            icon={<EmojiEventsIcon color="secondary" />}
            color="secondary.light"
          />
        </Grid>

      </Grid>

    <Grid container spacing={3} sx={{ mb: 4 }}>

  {/* ============================ */}
  {/* RUN LEADERS */}
  {/* ============================ */}

  <Grid size={{ xs: 12, md: 6 }}>

    <Paper sx={{ p: 3 }}>

      <SectionHeader
        title="Top Run Leaders"
      />

      <Table>

        <TableHead>
          <TableRow>
            <TableCell>Rank</TableCell>
            <TableCell>Player</TableCell>
            <TableCell>Runs</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>

          {runLeaders.map((player, index) => (

            <TableRow key={player.player}>

              <TableCell>

                {index === 0 && <EmojiEventsIcon sx={{ color: "#FFD700" }} />}
                {index === 1 && <EmojiEventsIcon sx={{ color: "#C0C0C0" }} />}
                {index === 2 && <EmojiEventsIcon sx={{ color: "#CD7F32" }} />}
                {index > 2 && index + 1}

              </TableCell>

              <TableCell>
                <Typography fontWeight={600}>
                  {formatName(player.player)}
                </Typography>
              </TableCell>

              <TableCell>
                <Typography fontWeight={600}>
                  {player.runs}
                </Typography>
              </TableCell>

            </TableRow>

          ))}

        </TableBody>

      </Table>

    </Paper>

  </Grid>

  {/* ============================ */}
  {/* WICKET LEADERS */}
  {/* ============================ */}

  <Grid size={{ xs: 12, md: 6 }}>

    <Paper sx={{ p: 3 }}>

      <SectionHeader
        title="Top Wicket Leaders"
      />

      <Table>

        <TableHead>
          <TableRow>
            <TableCell>Rank</TableCell>
            <TableCell>Player</TableCell>
            <TableCell>Wickets</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>

          {wicketLeaders.map((player, index) => (

            <TableRow key={player.player}>

              <TableCell>

                {index === 0 && <EmojiEventsIcon sx={{ color: "#FFD700" }} />}
                {index === 1 && <EmojiEventsIcon sx={{ color: "#C0C0C0" }} />}
                {index === 2 && <EmojiEventsIcon sx={{ color: "#CD7F32" }} />}
                {index > 2 && index + 1}

              </TableCell>

              <TableCell>
                <Typography fontWeight={600}>
                  {formatName(player.player)}
                </Typography>
              </TableCell>

              <TableCell>
                <Typography fontWeight={600}>
                  {player.wickets}
                </Typography>
              </TableCell>

            </TableRow>

          ))}

        </TableBody>

      </Table>

    </Paper>

  </Grid>

</Grid>

      {/* ============================ */}
      {/* Runs and Wicket Charts */}
      {/* ============================ */}
      <Grid container spacing={3} sx={{ mb: 4 }}>

        {/* Runs Chart */}

        <Grid size={{ xs: 12, md: 6 }}>

          <Paper sx={{ p: 3 }}>

            <SectionHeader title="Runs Trend" />

            <RunsTrendChart data={runsTrend} />

          </Paper>

        </Grid>

        {/* Wickets Chart */}

        <Grid size={{ xs: 12, md: 6 }}>

          <Paper sx={{ p: 3 }}>

            <SectionHeader title="Wickets Trend" />

            <WicketsTrendChart data={wicketsTrend} />

          </Paper>

        </Grid>

      </Grid>

      {/* ============================ */}
      {/* RECENT MATCHES TABLE */}
      {/* ============================ */}

      <Paper sx={{ p: 3 }}>

        <SectionHeader
          title="Recent Matches"
        />

        <Table>

          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Opponent</TableCell>
              <TableCell>Result</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>

            {recentMatches.map((match) => (

              <TableRow key={match.id}>

                <TableCell>
                  {formatDate(match.match_date) }
                </TableCell>

                <TableCell>
                  {match.opponent_name}
                </TableCell>

                <TableCell>

                  {match.result === "Won" && (
                    <Chip label="Won" color="success" size="small" />
                  )}

                  {match.result === "Lost" && (
                    <Chip label="Lost" color="error" size="small" />
                  )}

                  {match.result === "Draw" && (
                    <Chip label="Draw" color="warning" size="small" />
                  )}

                </TableCell>

              </TableRow>

            ))}

          </TableBody>

        </Table>

      </Paper>

    </Box>

  );

}