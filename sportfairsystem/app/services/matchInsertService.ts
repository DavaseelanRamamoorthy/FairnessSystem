import {
  currentTeamName,
  currentTeamPrefix
} from "../config/teamConfig";
import { ParsedMatch, SquadPlayer } from "../types/match.types";
import { buildMatchId } from "./matchIdService";
import {
  normalizeNameKey,
  uniqueNameKeys
} from "./matchTextNormalization";
import { requireAdminAccess } from "./accessControlService";
import {
  bridgeCurrentTeamPlayerIdentities,
  hasSquadMetadataColumns,
  mapSquadPlayerRecord
} from "./squadService";
import { supabase } from "./supabaseClient";
import { isMatchForCurrentTeam } from "./teamValidationService";
import { deleteMatchFromDatabase } from "./deleteMatchService";

type TeamPlayerRecord = {
  id: string;
  name: string;
  isGuest: boolean;
  battingStyle: string | null;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  roleTags: string[];
};

type DuplicateCheckMatchRow = {
  id: string;
  match_code: string | null;
  raw_text: string | null;
  parsed_payload: ParsedMatch | null;
};

function normalizeComparableText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildParsedMatchSignature(parsed: ParsedMatch | null | undefined) {
  if (!parsed) {
    return "";
  }

  return JSON.stringify({
    matchDate: parsed.matchDate ?? null,
    teamA: normalizeComparableText(parsed.teamA),
    teamB: normalizeComparableText(parsed.teamB),
    tossWinner: normalizeComparableText(parsed.tossWinner),
    tossDecision: normalizeComparableText(parsed.tossDecision),
    winner: normalizeComparableText(parsed.winner),
    matchResult: normalizeComparableText(parsed.matchResult),
    resultSummary: normalizeComparableText(parsed.resultSummary),
    innings: (parsed.innings ?? []).map((innings) => ({
      inningsNumber: innings.innings_number ?? null,
      teamName: normalizeComparableText(innings.teamName),
      runs: innings.runs ?? null,
      wickets: innings.wickets ?? null,
      overs: innings.overs ?? null,
      extras: innings.extras ?? null,
      batting: (innings.battingStats ?? []).map((batting) => ({
        player: normalizeComparableText(batting.player_name),
        runs: batting.runs ?? null,
        balls: batting.balls ?? null,
        dismissal: normalizeComparableText(batting.dismissal)
      })),
      bowling: (innings.bowlingStats ?? []).map((bowling) => ({
        player: normalizeComparableText(bowling.player_name),
        wickets: bowling.wickets ?? null,
        overs: bowling.overs ?? null,
        runs: bowling.runs ?? null
      }))
    }))
  });
}

function findDuplicateStoredMatch(
  storedMatches: DuplicateCheckMatchRow[],
  parsed: ParsedMatch
) {
  const incomingRawText = normalizeComparableText(parsed.rawText);
  const incomingSignature = buildParsedMatchSignature(parsed);

  return storedMatches.find((storedMatch) => {
    const storedRawText = normalizeComparableText(storedMatch.raw_text);

    if (incomingRawText && storedRawText && incomingRawText === storedRawText) {
      return true;
    }

    const storedSignature = buildParsedMatchSignature(storedMatch.parsed_payload);

    return incomingSignature !== "" && storedSignature !== "" && incomingSignature === storedSignature;
  });
}

function getDerivedPlaying11(
  parsed: ParsedMatch,
  teamName: string | null
) {
  if (!teamName) {
    return [];
  }

  const teamInnings = parsed.innings.find((innings) => innings.teamName === teamName);
  const opponentInnings = parsed.innings.find((innings) => innings.teamName !== teamName);

  const battingNames = uniqueNameKeys(
    teamInnings?.battingStats?.map((player) => player.player_name) ?? []
  );

  const bowlingNames = uniqueNameKeys(
    opponentInnings?.bowlingStats?.map((player) => player.player_name) ?? []
  );

  return Array.from(new Set([...battingNames, ...bowlingNames]));
}

function upsertParsedPlayer(
  playerMap: Map<
    string,
    { name: string; battingStyle: string | null; isCaptain: boolean; isWicketKeeper: boolean }
  >,
  rawName: string | null | undefined,
  values?: Partial<{ battingStyle: string | null; isCaptain: boolean; isWicketKeeper: boolean }>
) {
  const normalized = cleanNameForStorage(rawName ?? "");

  if (!normalized) {
    return;
  }

  const existing = playerMap.get(normalized);

  playerMap.set(normalized, {
    name: normalized,
    battingStyle: existing?.battingStyle ?? values?.battingStyle ?? null,
    isCaptain: existing?.isCaptain || values?.isCaptain || false,
    isWicketKeeper: existing?.isWicketKeeper || values?.isWicketKeeper || false
  });
}

function getCurrentTeamParsedPlayers(parsed: ParsedMatch) {
  const currentTeamSquad = parsed.squads?.find((squad) => squad.teamName === currentTeamName);
  const currentTeamInnings = parsed.innings.find((innings) => innings.teamName === currentTeamName);
  const opponentInnings = parsed.innings.find((innings) => innings.teamName !== currentTeamName);
  const playerMap = new Map<
    string,
    { name: string; battingStyle: string | null; isCaptain: boolean; isWicketKeeper: boolean }
  >();

  currentTeamSquad?.players.forEach((player) => {
    upsertParsedPlayer(playerMap, player.name, {
      battingStyle: player.battingStyle ?? null,
      isCaptain: player.isCaptain ?? false,
      isWicketKeeper: player.isWicketKeeper ?? false
    });
  });

  currentTeamInnings?.battingStats?.forEach((player) => {
    upsertParsedPlayer(playerMap, player.player_name, {
      battingStyle: player.batting_style ?? null,
      isCaptain: player.isCaptain ?? false,
      isWicketKeeper: player.isWicketKeeper ?? false
    });
  });

  currentTeamInnings?.playing11?.forEach((playerName) => {
    upsertParsedPlayer(playerMap, playerName);
  });

  opponentInnings?.bowlingStats?.forEach((player) => {
    upsertParsedPlayer(playerMap, player.player_name);
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

function buildMatchPlayersForInnings(
  parsed: ParsedMatch,
  inningsSummary: ParsedMatch["innings"][number],
  squadPlayers: SquadPlayer[]
) {
  const playerMap = new Map<string, SquadPlayer>();

  const appendPlayer = (player: SquadPlayer) => {
    const normalized = normalizeNameKey(player.name);

    if (!normalized || playerMap.has(normalized)) {
      return;
    }

    playerMap.set(normalized, player);
  };

  squadPlayers.forEach(appendPlayer);

  (inningsSummary.playing11 ?? []).forEach((playerName) => {
    appendPlayer({
      name: playerName,
      playerOrder: playerMap.size + 1,
      isCaptain: false,
      isWicketKeeper: false,
      battingStyle: null
    });
  });

  if (playerMap.size === 0) {
    getDerivedPlaying11(parsed, inningsSummary.teamName).forEach((playerName) => {
      appendPlayer({
        name: playerName,
        playerOrder: playerMap.size + 1,
        isCaptain: false,
        isWicketKeeper: false,
        battingStyle: null
      });
    });
  }

  return Array.from(playerMap.values()).map((player, index) => ({
    ...player,
    playerOrder: player.playerOrder ?? index + 1
  }));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

function cleanNameForStorage(name: string) {
  return normalizeNameKey(name);
}

export async function saveMatchToDatabase(
  parsed: ParsedMatch,
  options?: {
    playersToAddToSquad?: string[];
    sourceFileName?: string;
  }
) {
  await requireAdminAccess();

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

  const { data: potentialDuplicateMatches, error: duplicateLookupError } = await supabase
    .from("matches")
    .select("id, match_code, raw_text, parsed_payload")
    .eq("team_id", teamData.id)
    .eq("match_date", parsed.matchDate);

  if (duplicateLookupError) {
    throw duplicateLookupError;
  }

  const duplicateMatch = findDuplicateStoredMatch(
    (potentialDuplicateMatches ?? []) as DuplicateCheckMatchRow[],
    parsed
  );

  if (duplicateMatch) {
    throw new Error(
      duplicateMatch.match_code
        ? `This scorecard is already saved as ${duplicateMatch.match_code}.`
        : "This scorecard is already saved."
    );
  }

  // 2. Ensure current-team players exist in players
  const playersToAddToSquad = Array.from(
    new Set((options?.playersToAddToSquad ?? []).map(normalizeNameKey).filter(Boolean))
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
      normalizeNameKey(mapSquadPlayerRecord(player as Record<string, unknown>).name),
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
        // Persistent squad metadata is admin-managed and should not be rewritten
        // from historical scorecards. Match-level roles are still stored in match_players.
        nextRow.is_captain = false;
        nextRow.is_wicket_keeper = false;
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
      existingPlayerMap.set(normalizeNameKey(mappedPlayer.name), mappedPlayer);
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
      existingPlayerMap.set(normalizeNameKey(player.name), {
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
      existingPlayerMap.set(normalizeNameKey(mappedPlayer.name), mappedPlayer);
    }
  }

  const touchedPlayerIds = parsedCurrentTeamPlayers
    .map((player) => existingPlayerMap.get(player.name)?.id ?? null)
    .filter((playerId): playerId is string => Boolean(playerId));

  if (touchedPlayerIds.length > 0) {
    try {
      await bridgeCurrentTeamPlayerIdentities({ playerIds: touchedPlayerIds });
    } catch (error) {
      console.warn("Could not repair historical player identity links.", error);
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

  try {
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
          const normalized = normalizeNameKey(bat.player_name);
          battingNames.push(normalized);

          const { error: battingInsertError } = await supabase.from("batting_stats").insert({
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

          if (battingInsertError) {
            throw battingInsertError;
          }
        }
      }

      // 7. Insert bowling stats
      const opponentInnings = parsed.innings.find(
        (other) => other.teamName !== inn.teamName
      );

      const bowlingNames: string[] = [];

      if (opponentInnings?.bowlingStats) {
        for (const bowl of opponentInnings.bowlingStats) {
          bowlingNames.push(normalizeNameKey(bowl.player_name));
        }
      }

      if (inn.bowlingStats) {
        for (const bowl of inn.bowlingStats) {
          const normalized = normalizeNameKey(bowl.player_name);
          const { error: bowlingInsertError } = await supabase.from("bowling_stats").insert({
            innings_id: inningsRow.id,
            player_name: normalized,
            player_id: inn.teamName !== currentTeamName
              ? (currentTeamPlayerIds.get(normalized) ?? null)
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

          if (bowlingInsertError) {
            throw bowlingInsertError;
          }
        }
      }

      // 8. Insert fall of wickets
      if (inn.fallOfWickets) {
        for (const f of inn.fallOfWickets) {
          const { error: fallOfWicketsInsertError } = await supabase.from("fall_of_wickets").insert({
            innings_id: inningsRow.id,
            score: f.score,
            wicket_number: f.wicket_number,
            batsman: normalizeNameKey(f.batsman),
            over: f.over
          });

          if (fallOfWicketsInsertError) {
            throw fallOfWicketsInsertError;
          }
        }
      }

      // 9. Insert match players
      const squadForTeam = parsed.squads?.find((squad) => squad.teamName === inn.teamName);
      const squadPlayers = squadForTeam?.players ?? [];
      const playing11 = buildMatchPlayersForInnings(parsed, inn, squadPlayers);

      if (playing11.length > 0) {
        const playerRows = playing11.map((player: SquadPlayer) => {
          const normalized = normalizeNameKey(player.name);
          const battingRolePlayer = inn.battingStats?.find(
            (bat) => normalizeNameKey(bat.player_name) === normalized
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

        const { error: matchPlayersInsertError } = await supabase.from("match_players").insert(playerRows);

        if (matchPlayersInsertError) {
          throw matchPlayersInsertError;
        }
      }
    }

    if (parsed.officials && parsed.officials.length > 0) {
      const { error: matchOfficialsInsertError } = await supabase.from("match_officials").insert(
        parsed.officials.map((official) => ({
          match_id: match.id,
          name: official.name,
          role: official.role
        }))
      );

      if (matchOfficialsInsertError) {
        throw matchOfficialsInsertError;
      }
    }
  } catch (error) {
    try {
      await deleteMatchFromDatabase(match.id);
    } catch (cleanupError) {
      throw new Error(
        `Could not save the full match payload and automatic cleanup also failed. Save error: ${getErrorMessage(error)} Cleanup error: ${getErrorMessage(cleanupError)}`
      );
    }

    throw error;
  }

  return {
    ...match,
    match_code: match.match_code ?? generatedMatchId
  };
}
