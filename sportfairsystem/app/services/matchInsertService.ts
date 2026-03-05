import { supabase } from "./supabaseClient";
import { ParsedMatch } from "../types/match.types";

const CURRENT_TEAM = "Moonwalkers";

const normalizeName = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export async function saveMatchToDatabase(
  parsed: ParsedMatch
) {
  // =========================
  // 1️⃣ Fetch Team ID
  // =========================
  const { data: teamData, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("name", CURRENT_TEAM)
    .single();

  if (teamError || !teamData) {
    throw new Error("Team not found.");
  }

  // =========================
  // 2️⃣ Duplicate Check
  // =========================
  const { data: existingMatch } = await supabase
    .from("matches")
    .select("id")
    .eq("match_date", parsed.matchDate)
    .eq("team_a", parsed.teamA)
    .eq("team_b", parsed.teamB)
    .maybeSingle();

  if (existingMatch) {
    throw new Error("Match already exists.");
  }

  // =========================
  // 3️⃣ Insert Match
  // =========================
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      team_id: teamData.id,
      match_date: parsed.matchDate,
      opponent_name:
        parsed.teamA === CURRENT_TEAM
          ? parsed.teamB
          : parsed.teamA,
      team_a: parsed.teamA,
      team_b: parsed.teamB,
      winner: parsed.winner,
      result: parsed.matchResult
    })
    .select()
    .single();

  if (matchError || !match) throw matchError;

  // =========================
  // 4️⃣ Insert Innings
  // =========================
  for (const inn of parsed.innings) {
    const { data: inningsRow, error: inningsError } =
      await supabase
        .from("innings")
        .insert({
          match_id: match.id,
          team_name: inn.teamName,
          runs: inn.runs,
          wickets: inn.wickets,
          overs: inn.overs,
          extras: inn.extras ?? 0
        })
        .select()
        .single();

    if (inningsError || !inningsRow) throw inningsError;

    // =========================
    // 5️⃣ Batting Stats
    // =========================

    const battingNames: string[] = [];

    if (inn.battingStats) {
      for (const bat of inn.battingStats) {
        const normalized = normalizeName(bat.player_name);
        battingNames.push(normalized);
        await supabase.from("batting_stats").insert({
          innings_id: inningsRow.id,
          player_name: normalized,
          dismissal: bat.dismissal ?? null,
          runs: bat.runs,
          balls: bat.balls,
          fours: bat.fours,
          sixes: bat.sixes,
          strike_rate: bat.strike_rate
        });
      }
    }

    // =========================
    // 6️⃣ Bowling Stats
    // =========================
    const opponentInnings = parsed.innings.find(
      (other) => other.teamName !== inn.teamName
    );

    const bowlingNames: string[] = [];

    if (opponentInnings?.bowlingStats) {
      for (const bowl of opponentInnings.bowlingStats) {
        const normalized = normalizeName(bowl.player_name);
        bowlingNames.push(normalized);
      }
    }

    if (inn.bowlingStats) {
      for (const bowl of inn.bowlingStats) {
        await supabase.from("bowling_stats").insert({
          innings_id: inningsRow.id,
          player_name: normalizeName(bowl.player_name),
          overs: bowl.overs,
          maidens: bowl.maidens,
          runs: bowl.runs,
          wickets: bowl.wickets,
          economy: bowl.economy
        });
      }
    }

    // =========================
    // 7️⃣ Fall of Wickets
    // =========================
    if (inn.fallOfWickets) {
      for (const f of inn.fallOfWickets) {
        await supabase.from("fall_of_wickets").insert({
          innings_id: inningsRow.id,
          score: f.score,
          wicket_number: f.wicket_number,
          batsman: normalizeName(f.batsman),
          over: f.over
        });
      }
    }

    // =========================
    // 8️⃣ Insert match_players
    // =========================
    if (inn.playing11) {
      const playerRows = inn.playing11.map((player: string) => {
        const normalized = normalizeName(player);

        return {
          match_id: match.id,
          team_name: inn.teamName,
          player_name: normalized,
          did_bat: battingNames.includes(normalized),
          did_bowl: bowlingNames.includes(normalized)
        };
      });

      await supabase.from("match_players").insert(playerRows);
    }
  }

  return match;
}