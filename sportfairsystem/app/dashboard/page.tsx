"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from "react";

import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import Chip from "@mui/material/Chip";

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


      <Container maxWidth="xl">

        <Stack spacing={4}>

          {/* HEADER */}

          <Stack spacing={1}>

            <Typography variant="h4">
              Team Dashboard
            </Typography>

            <Typography variant="body2" color="text.secondary">
              Overview of team performance, match statistics and player contributions.
            </Typography>

          </Stack>


          {/* KPI CARDS */}

          <Grid container spacing={3}>

            <Grid size={{ xs: 12, md: 3 }}>
              <DashboardCard
                title="Matches Played"
                value={matchesPlayed}
                icon={<SportsCricketIcon color="primary" />}
                color="primary"
                trend={[2,3,4,3,5,6,4]}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <DashboardCard
                title="Win Ratio"
                value={`${winRate}%`}
                icon={<TrendingUpIcon color="success" />}
                color="success"
                trend={[40,45,50,55,60,65,70]}
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
                color="warning"
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
                color="secondary"
              />
            </Grid>

          </Grid>


          {/* LEADERBOARDS */}

          <Grid container spacing={3}>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card>

                <CardContent>

                  <SectionHeader title="Top Run Leaders" />

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

                </CardContent>

              </Card>

            </Grid>


            <Grid size={{ xs: 12, md: 6 }}>

              <Card>

                <CardContent>

                  <SectionHeader title="Top Wicket Leaders" />

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

                </CardContent>

              </Card>

            </Grid>

          </Grid>


          {/* CHARTS */}

          <Grid container spacing={3}>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <SectionHeader title="Runs Trend" />
                  <RunsTrendChart data={runsTrend} />
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <SectionHeader title="Wickets Trend" />
                  <WicketsTrendChart data={wicketsTrend} />
                </CardContent>
              </Card>
            </Grid>

          </Grid>


          {/* RECENT MATCHES */}

          <Card>

            <CardContent>

              <SectionHeader title="Recent Matches" />

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
                        {formatDate(match.match_date)}
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

            </CardContent>

          </Card>

        </Stack>

      </Container>


  );
}