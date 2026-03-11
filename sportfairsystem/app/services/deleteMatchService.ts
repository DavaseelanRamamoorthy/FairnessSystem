import { supabase } from "./supabaseClient";

export async function deleteMatchFromDatabase(matchId: string) {
  const { data: inningsRows, error: inningsError } = await supabase
    .from("innings")
    .select("id")
    .eq("match_id", matchId);

  if (inningsError) {
    throw new Error("Could not load match innings for deletion.");
  }

  const inningsIds = (inningsRows ?? []).map((innings) => innings.id as string);

  if (inningsIds.length > 0) {
    const [
      { error: battingDeleteError },
      { error: bowlingDeleteError },
      { error: fallOfWicketsDeleteError }
    ] = await Promise.all([
      supabase
        .from("batting_stats")
        .delete()
        .in("innings_id", inningsIds),
      supabase
        .from("bowling_stats")
        .delete()
        .in("innings_id", inningsIds),
      supabase
        .from("fall_of_wickets")
        .delete()
        .in("innings_id", inningsIds)
    ]);

    if (battingDeleteError) {
      throw new Error("Could not delete batting stats.");
    }

    if (bowlingDeleteError) {
      throw new Error("Could not delete bowling stats.");
    }

    if (fallOfWicketsDeleteError) {
      throw new Error("Could not delete fall of wickets.");
    }
  }

  const [
    { error: matchPlayersDeleteError },
    { error: matchOfficialsDeleteError },
    { error: inningsDeleteError }
  ] = await Promise.all([
    supabase
      .from("match_players")
      .delete()
      .eq("match_id", matchId),
    supabase
      .from("match_officials")
      .delete()
      .eq("match_id", matchId),
    supabase
      .from("innings")
      .delete()
      .eq("match_id", matchId)
  ]);

  if (matchPlayersDeleteError) {
    throw new Error("Could not delete match players.");
  }

  if (matchOfficialsDeleteError) {
    throw new Error("Could not delete match officials.");
  }

  if (inningsDeleteError) {
    throw new Error("Could not delete innings.");
  }

  const { error: matchDeleteError } = await supabase
    .from("matches")
    .delete()
    .eq("id", matchId);

  if (matchDeleteError) {
    throw new Error("Could not delete the selected match.");
  }
}
