import { supabase } from "./supabaseClient";
import { ParsedMatch } from "../types/match.types";

export async function saveMatchToDatabase(
  parsed: ParsedMatch,
  teamId: string
) {

  // 1️⃣ Insert match
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      team_id: teamId,
      match_date: parsed.matchDate,
      opponent_name:
        parsed.teamA === "Moonwalkers"
          ? parsed.teamB
          : parsed.teamA,
      team_a: parsed.teamA,
      team_b: parsed.teamB,
      winner: parsed.winner,
      result: parsed.matchResult
    })
    .select()
    .single();

  if (matchError) throw matchError;

  // 2️⃣ Insert innings
  for (const inn of parsed.innings) {
    const { data: inningsRow, error: inningsError } =
      await supabase
        .from("innings")
        .insert({
          match_id: match.id,
          team_name: inn.teamName,
          runs: inn.runs,
          wickets: inn.wickets,
          overs: inn.overs
        })
        .select()
        .single();

    if (inningsError) throw inningsError;

    // 3️⃣ Batting stats
    if (inn.batsmen) {
      for (const bat of inn.batsmen) {
        await supabase.from("batting_stats").insert({
          innings_id: inningsRow.id,
          player_name: bat.name,
          runs: bat.runs,
          balls: bat.balls,
          fours: bat.fours,
          sixes: bat.sixes,
          strike_rate: bat.strikeRate
        });
      }
    }

    // 4️⃣ Bowling stats
    if (inn.bowlers) {
      for (const bowl of inn.bowlers) {
        await supabase.from("bowling_stats").insert({
          innings_id: inningsRow.id,
          player_name: bowl.name,
          overs: bowl.overs,
          maidens: bowl.maidens,
          runs: bowl.runs,
          wickets: bowl.wickets,
          economy: bowl.economy
        });
      }
    }
  }

  return match;
}