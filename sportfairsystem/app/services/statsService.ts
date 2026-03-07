/* eslint-disable @typescript-eslint/no-explicit-any */

import { supabase } from "./supabaseClient";

// ============================
// Matches Played
// ============================

export async function getMatchesPlayed() {

  const { count, error } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error(error);
    return 0;
  }

  return count ?? 0;
}

// ============================
// Win Rate
// ============================

export async function getWinRate() {

  const { data, error } = await supabase
    .from("matches")
    .select("result");

  if (error) {
    console.error(error);
    return 0;
  }

  const total = data.length;

  if (total === 0) return 0;

  const wins = data.filter((m) => m.result === "Won").length;

  return Math.round((wins / total) * 100);
}

// ============================
// Top Run Scorer
// ============================

export async function getTopRunScorer() {

  const { data, error } = await supabase
    .from("batting_stats")
    .select("player_name,runs");

  if (error) {
    console.error(error);
    return null;
  }

  const totals: Record<string, number> = {};

  data.forEach((row) => {

    if (!totals[row.player_name]) {
      totals[row.player_name] = 0;
    }

    totals[row.player_name] += row.runs;
  });

  const sorted = Object.entries(totals)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return null;

  return {
    player: sorted[0][0],
    runs: sorted[0][1],
  };
}

// ============================
// Top Wicket Taker
// ============================

export async function getTopWicketTaker() {

  const { data, error } = await supabase
    .from("bowling_stats")
    .select("player_name,wickets");

  if (error) {
    console.error(error);
    return null;
  }

  const totals: Record<string, number> = {};

  data.forEach((row) => {

    if (!totals[row.player_name]) {
      totals[row.player_name] = 0;
    }

    totals[row.player_name] += row.wickets;
  });

  const sorted = Object.entries(totals)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return null;

  return {
    player: sorted[0][0],
    wickets: sorted[0][1],
  };
}

// ============================
// Top Run Leaders
// ============================

export async function getTopRunLeaders(limit = 5) {

  const { data, error } = await supabase
    .from("batting_stats")
    .select("player_name,runs");

  if (error) {
    console.error(error);
    return [];
  }

  if (!data) return [];

  const totals: Record<string, number> = {};

  data.forEach((row) => {

    if (!totals[row.player_name]) {
      totals[row.player_name] = 0;
    }

    totals[row.player_name] += row.runs;
  });

  const sorted = Object.entries(totals)
    .map(([player, runs]) => ({ player, runs }))
    .sort((a, b) => b.runs - a.runs)
    .slice(0, limit);

  return sorted;
}

// ============================
// Top Wicket Leaders
// ============================

export async function getTopWicketLeaders(limit = 5) {

  const { data, error } = await supabase
    .from("bowling_stats")
    .select("player_name,wickets");

  if (error) {
    console.error(error);
    return [];
  }

  if (!data) return [];

  const totals: Record<string, number> = {};

  data.forEach((row) => {

    if (!totals[row.player_name]) {
      totals[row.player_name] = 0;
    }

    totals[row.player_name] += row.wickets;

  });

  const sorted = Object.entries(totals)
    .map(([player, wickets]) => ({
      player,
      wickets,
    }))
    .sort((a, b) => b.wickets - a.wickets)
    .slice(0, limit);

  return sorted;
}

// ============================
// Runs Per Match
// ============================

export async function getRunsPerMatch(teamName: string) {

  const { data, error } = await supabase
    .from("innings")
    .select(`
      runs,
      team_name,
      match_id,
      matches (
        opponent_name,
        match_date
      )
    `)
    .eq("team_name", teamName)
    .order("match_id", { ascending: false })
    .limit(5);

  if (error) {
    console.error(error);
    return [];
  }

  if (!data) return [];

  return data
    .reverse() // oldest → newest
    .map((item: any) => ({
      match: item.matches?.opponent_name || "Unknown",
      runs: item.runs,
    }));
}

// ============================
// Wickets Per Match (Last 5)
// ============================

export async function getWicketsPerMatch(teamName: string) {

  const { data, error } = await supabase
    .from("innings")
    .select(`
      wickets,
      team_name,
      match_id,
      matches (
        opponent_name,
        match_date
      )
    `)
    .eq("team_name", teamName)
    .order("match_id", { ascending: false })
    .limit(5);

  if (error) {
    console.error(error);
    return [];
  }

  if (!data) return [];

  return data
    .reverse()
    .map((item: any) => ({
      match: item.matches?.opponent_name || "Unknown",
      wickets: item.wickets,
    }));
}