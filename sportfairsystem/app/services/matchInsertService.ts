import {
  currentTeamName,
  currentTeamPrefix
} from "../config/teamConfig";
import { ParsedMatch, SquadPlayer } from "../types/match.types";
import { buildMatchId } from "./matchIdService";
import {
  hasSquadMetadataColumns,
  mapSquadPlayerRecord
} from "./squadService";
import { supabase } from "./supabaseClient";
import { isMatchForCurrentTeam } from "./teamValidationService";

const normalizeName = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const uniqueNames = (names: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      names
        .map((name) => normalizeName(name ?? ""))
        .filter(Boolean)
    )
  );

type TeamPlayerRecord = {
  id: string;
  name: string;
  isGuest: boolean;
  battingStyle: string | null;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  roleTags: string[];
};

function getDerivedPlaying11(
  parsed: ParsedMatch,
  teamName: string | null
) {
  if (!teamName) {
    return [];
  }

  const teamInnings = parsed.innings.find((innings) => innings.teamName === teamName);
  const opponentInnings = parsed.innings.find((innings) => innings.teamName !== teamName);

  const battingNames = uniqueNames(
    teamInnings?.battingStats?.map((player) => player.player_name) ?? []
  );

  const bowlingNames = uniqueNames(
    opponentInnings?.bowlingStats?.map((player) => player.player_name) ?? []
  );

  return Array.from(new Set([...battingNames, ...bowlingNames]));
}

function getCurrentTeamParsedPlayers(parsed: ParsedMatch) {
  const currentTeamSquad = parsed.squads?.find((squad) => squad.teamName === currentTeamName);

  if (currentTeamSquad?.players?.length) {
    return currentTeamSquad.players.map((player) => ({
      name: cleanNameForStorage(player.name),
      battingStyle: player.battingStyle ?? null,
      isCaptain: player.isCaptain ?? false,
      isWicketKeeper: player.isWicketKeeper ?? false
    }));
  }

  const currentTeamInnings = parsed.innings.find((innings) => innings.teamName === currentTeamName);
  const opponentInnings = parsed.innings.find((innings) => innings.teamName !== currentTeamName);

  const playerMap = new Map<
    string,
    { name: string; battingStyle: string | null; isCaptain: boolean; isWicketKeeper: boolean }
  >();

  currentTeamInnings?.battingStats?.forEach((player) => {
    const normalized = cleanNameForStorage(player.player_name);

    if (!normalized) {
      return;
    }

    playerMap.set(normalized, {
      name: normalized,
      battingStyle: player.batting_style ?? null,
      isCaptain: player.isCaptain ?? false,
      isWicketKeeper: player.isWicketKeeper ?? false
    });
  });

  currentTeamInnings?.playing11?.forEach((playerName) => {
    const normalized = cleanNameForStorage(playerName);

    if (!normalized) {
      return;
    }

    if (!playerMap.has(normalized)) {
      playerMap.set(normalized, {
        name: normalized,
        battingStyle: null,
        isCaptain: false,
        isWicketKeeper: false
      });
    }
  });

  opponentInnings?.bowlingStats?.forEach((player) => {
    const normalized = cleanNameForStorage(player.player_name);

    if (!normalized) {
      return;
    }

    if (!playerMap.has(normalized)) {
      playerMap.set(normalized, {
        name: normalized,
        battingStyle: null,
        isCaptain: false,
        isWicketKeeper: false
      });
    }
  });

  parsed.officials?.forEach((official) => {
    if (official.role !== "Captain") {
      return;
    }

    const normalized = cleanNameForStorage(official.name);
    const existing = playerMap.get(normalized);

    if (existing) {
      existing.isCaptain = true;
      playerMap.set(normalized, existing);
    }
  });

  return Array.from(playerMap.values());
}

function cleanNameForStorage(name: string) {
  return normalizeName(name);
}

export async function saveMatchToDatabase(
  parsed: ParsedMatch,
  options?: {
    playersToAddToSquad?: string[];
    sourceFileName?: string;
  }
) {
  if (!isMatchForCurrentTeam(parsed, currentTeamName)) {
    throw new Error(`This scorecard does not include ${currentTeamName}.`);
  }

  // 1. Fetch team ID
  const { data: teamData, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("name", currentTeamName)
    .single();

  if (teamError || !teamData) {
    throw new Error("Team not found.");
  }

  // 2. Ensure current-team players exist in players
  const playersToAddToSquad = Array.from(
    new Set((options?.playersToAddToSquad ?? []).map(normalizeName).filter(Boolean))
  );

  const parsedCurrentTeamPlayers = getCurrentTeamParsedPlayers(parsed);
  const metadataColumnsSupported = await hasSquadMetadataColumns();

  const { data: existingPlayers, error: existingPlayersError } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", teamData.id);

  if (existingPlayersError) throw existingPlayersError;

  const existingPlayerMap = new Map(
    (existingPlayers ?? []).map((player) => [
      normalizeName(mapSquadPlayerRecord(player as Record<string, unknown>).name),
      mapSquadPlayerRecord(player as Record<string, unknown>)
    ])
  );

  const missingParsedPlayers = parsedCurrentTeamPlayers.filter(
    (player) => !existingPlayerMap.has(player.name)
  );

  if (missingParsedPlayers.length > 0) {
    const insertRows = missingParsedPlayers.map((player) => {
      const nextRow: Record<string, unknown> = {
        team_id: teamData.id,
        name: player.name,
        is_guest: !playersToAddToSquad.includes(player.name),
        batting_style: player.battingStyle
      };

      if (metadataColumnsSupported) {
        nextRow.is_captain = player.isCaptain;
        nextRow.is_wicket_keeper = player.isWicketKeeper;
        nextRow.role_tags = [];
      }

      return nextRow;
    });

    const { data: insertedPlayers, error: insertPlayersError } = await supabase
      .from("players")
      .insert(insertRows)
      .select("*");

    if (insertPlayersError) throw insertPlayersError;

    (insertedPlayers ?? []).forEach((player) => {
      const mappedPlayer = mapSquadPlayerRecord(player as Record<string, unknown>);
      existingPlayerMap.set(normalizeName(mappedPlayer.name), mappedPlayer);
    });
  }

  const playersToPromote = playersToAddToSquad
    .map((playerName) => existingPlayerMap.get(playerName))
    .filter((player): player is TeamPlayerRecord => Boolean(player?.id))
    .filter((player) => player.isGuest);

  if (playersToPromote.length > 0) {
    const { error: promotePlayersError } = await supabase
      .from("players")
      .update({ is_guest: false })
      .in("id", playersToPromote.map((player) => player.id));

    if (promotePlayersError) throw promotePlayersError;

    playersToPromote.forEach((player) => {
      existingPlayerMap.set(normalizeName(player.name), {
        ...player,
        isGuest: false
      });
    });
  }

  if (metadataColumnsSupported) {
    for (const parsedPlayer of parsedCurrentTeamPlayers) {
      const existingPlayer = existingPlayerMap.get(parsedPlayer.name);

      if (!existingPlayer) {
        continue;
      }

      const metadataPatch: Record<string, unknown> = {};

      if (parsedPlayer.battingStyle && !existingPlayer.battingStyle) {
        metadataPatch.batting_style = parsedPlayer.battingStyle;
      }

      if (parsedPlayer.isCaptain && !existingPlayer.isCaptain) {
        metadataPatch.is_captain = true;
      }

      if (parsedPlayer.isWicketKeeper && !existingPlayer.isWicketKeeper) {
        metadataPatch.is_wicket_keeper = true;
      }

      if (Object.keys(metadataPatch).length === 0) {
        continue;
      }

      const { data: updatedPlayer, error: updatePlayerError } = await supabase
        .from("players")
        .update(metadataPatch)
        .eq("id", existingPlayer.id)
        .select("*")
        .single();

      if (updatePlayerError || !updatedPlayer) {
        throw updatePlayerError;
      }

      const mappedPlayer = mapSquadPlayerRecord(updatedPlayer as Record<string, unknown>);
      existingPlayerMap.set(normalizeName(mappedPlayer.name), mappedPlayer);
    }
  }

  const currentTeamPlayerIds = new Map(
    Array.from(existingPlayerMap.entries()).map(([name, player]) => [name, player.id])
  );

  // 3. Generate match code
  const { count: sameDayMatchCount, error: countError } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("match_date", parsed.matchDate)
    .eq("team_id", teamData.id);

  if (countError) throw countError;

  const generatedMatchId = buildMatchId(
    currentTeamPrefix,
    parsed.matchDate,
    sameDayMatchCount ?? 0
  );

  // 4. Insert match
  const baseMatchPayload = {
    team_id: teamData.id,
    source_file_name: options?.sourceFileName ?? null,
    match_title: parsed.matchTitle ?? null,
    competition_name: parsed.competitionName ?? null,
    ground: parsed.ground ?? null,
    match_date: parsed.matchDate,
    team_a: parsed.teamA,
    team_b: parsed.teamB,
    toss_winner: parsed.tossWinner ?? null,
    toss_decision: parsed.tossDecision ?? null,
    winner: parsed.winner,
    result: parsed.matchResult,
    result_summary: parsed.resultSummary ?? null,
    raw_text: parsed.rawText ?? null,
    parsed_payload: parsed
  };

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      ...baseMatchPayload,
      match_code: generatedMatchId
    })
    .select()
    .single();

  if (matchError || !match) throw matchError;

  // 5. Insert innings
  for (const inn of parsed.innings) {
    const { data: inningsRow, error: inningsError } =
      await supabase
        .from("innings")
        .insert({
          match_id: match.id,
          innings_number: inn.innings_number ?? null,
          team_name: inn.teamName,
          runs: inn.runs,
          wickets: inn.wickets,
          overs: inn.overs,
          extras: inn.extras ?? 0,
          extras_byes: inn.extrasBreakdown?.byes ?? 0,
          extras_leg_byes: inn.extrasBreakdown?.legByes ?? 0,
          extras_wides: inn.extrasBreakdown?.wides ?? 0,
          extras_no_balls: inn.extrasBreakdown?.noBalls ?? 0,
          crr: inn.crr ?? null
        })
        .select()
        .single();

    if (inningsError || !inningsRow) throw inningsError;

    // 6. Insert batting stats
    const battingNames: string[] = [];

    if (inn.battingStats) {
      for (const bat of inn.battingStats) {
        const normalized = normalizeName(bat.player_name);
        battingNames.push(normalized);

        await supabase.from("batting_stats").insert({
          innings_id: inningsRow.id,
          player_name: normalized,
          player_id: inn.teamName === currentTeamName
            ? (currentTeamPlayerIds.get(normalized) ?? null)
            : null,
          batting_position: bat.batting_position ?? null,
          batting_style: bat.batting_style ?? null,
          dismissal: bat.dismissal ?? null,
          runs: bat.runs,
          balls: bat.balls,
          minutes: bat.minutes ?? null,
          fours: bat.fours,
          sixes: bat.sixes,
          strike_rate: bat.strike_rate
        });
      }
    }

    // 7. Insert bowling stats
    const opponentInnings = parsed.innings.find(
      (other) => other.teamName !== inn.teamName
    );

    const bowlingNames: string[] = [];

    if (opponentInnings?.bowlingStats) {
      for (const bowl of opponentInnings.bowlingStats) {
        bowlingNames.push(normalizeName(bowl.player_name));
      }
    }

    if (inn.bowlingStats) {
      for (const bowl of inn.bowlingStats) {
        await supabase.from("bowling_stats").insert({
          innings_id: inningsRow.id,
          player_name: normalizeName(bowl.player_name),
          player_id: inn.teamName !== currentTeamName
            ? (currentTeamPlayerIds.get(normalizeName(bowl.player_name)) ?? null)
            : null,
          overs: bowl.overs,
          maidens: bowl.maidens,
          runs: bowl.runs,
          wickets: bowl.wickets,
          dot_balls: bowl.dot_balls ?? 0,
          fours_conceded: bowl.fours_conceded ?? 0,
          sixes_conceded: bowl.sixes_conceded ?? 0,
          wides: bowl.wides ?? 0,
          no_balls: bowl.no_balls ?? 0,
          economy: bowl.economy
        });
      }
    }

    // 8. Insert fall of wickets
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

    // 9. Insert match players
    const squadForTeam = parsed.squads?.find((squad) => squad.teamName === inn.teamName);
    const squadPlayers = squadForTeam?.players ?? [];
    const playing11 = squadPlayers.length > 0
      ? squadPlayers
      : (inn.playing11 && inn.playing11.length > 0
          ? uniqueNames(inn.playing11).map((player, index) => ({
              name: player,
              playerOrder: index + 1,
              isCaptain: false,
              isWicketKeeper: false,
              battingStyle: null
            }))
          : getDerivedPlaying11(parsed, inn.teamName).map((player, index) => ({
              name: player,
              playerOrder: index + 1,
              isCaptain: false,
              isWicketKeeper: false,
              battingStyle: null
            })));

    if (playing11.length > 0) {
      const playerRows = playing11.map((player: SquadPlayer) => {
        const normalized = normalizeName(player.name);
        const battingRolePlayer = inn.battingStats?.find(
          (bat) => normalizeName(bat.player_name) === normalized
        );

        return {
          match_id: match.id,
          team_name: inn.teamName,
          player_name: normalized,
          player_order: player.playerOrder ?? null,
          is_captain: player.isCaptain || battingRolePlayer?.isCaptain || false,
          is_wicket_keeper: player.isWicketKeeper || battingRolePlayer?.isWicketKeeper || false,
          batting_style: player.battingStyle ?? null,
          did_bat: battingNames.includes(normalized),
          did_bowl: bowlingNames.includes(normalized),
          player_id: inn.teamName === currentTeamName
            ? (currentTeamPlayerIds.get(normalized) ?? null)
            : null
        };
      });

      await supabase.from("match_players").insert(playerRows);
    }
  }

  if (parsed.officials && parsed.officials.length > 0) {
    await supabase.from("match_officials").insert(
      parsed.officials.map((official) => ({
        match_id: match.id,
        name: official.name,
        role: official.role
      }))
    );
  }

  return {
    ...match,
    match_code: match.match_code ?? generatedMatchId
  };
}
