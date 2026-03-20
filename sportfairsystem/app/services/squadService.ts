import { currentTeamName, squadAdminEnabled } from "@/app/config/teamConfig";
import { getCurrentUserAccess, requireAdminAccess } from "@/app/services/accessControlService";
import { cleanName } from "@/app/services/cleanName";
import { normalizeTeamName } from "@/app/services/teamValidationService";
import { supabase } from "@/app/services/supabaseClient";

export const squadRoleTagOptions = [
  "Batter",
  "Bowler",
  "All-Rounder",
  "Opener",
  "Finisher",
  "Vice Captain"
] as const;

export type SquadRoleTag = (typeof squadRoleTagOptions)[number];
export const primarySquadRoleTagOptions = [
  "Batter",
  "Bowler",
  "All-Rounder"
] as const;
export type PrimarySquadRoleTag = (typeof primarySquadRoleTagOptions)[number];

export type SquadMetadataValues = {
  battingStyle: string | null;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  roleTags: string[];
};

export type SquadPlayerRecord = {
  id: string;
  name: string;
  isGuest: boolean;
  battingStyle: string | null;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  roleTags: string[];
};

type RawPlayerRecord = {
  id?: unknown;
  name?: unknown;
  is_guest?: unknown;
  batting_style?: unknown;
  is_captain?: unknown;
  is_wicket_keeper?: unknown;
  role_tags?: unknown;
};

let squadMetadataColumnsSupportPromise: Promise<boolean> | null = null;

type TeamMatchRow = {
  id: string;
};

type TeamInningsRow = {
  id: string;
  team_name: string | null;
};

type MatchPlayerLinkRow = {
  match_id: string;
  team_name: string | null;
  player_name: string | null;
};

type BattingLinkRow = {
  innings_id: string;
  player_name: string | null;
};

type BowlingLinkRow = {
  innings_id: string;
  player_name: string | null;
};

export type SquadIdentityBridgeResult = {
  linkedMatchPlayers: number;
  linkedBattingRows: number;
  linkedBowlingRows: number;
  totalLinkedRows: number;
  skippedAmbiguousNames: string[];
};

export function normalizeRoleTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  const uniqueTags = Array.from(
    new Set(
      tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter((tag): tag is SquadRoleTag => {
          return squadRoleTagOptions.includes(tag as SquadRoleTag);
        })
    )
  );

  return uniqueTags.sort((left, right) => {
    return squadRoleTagOptions.indexOf(left as SquadRoleTag)
      - squadRoleTagOptions.indexOf(right as SquadRoleTag);
  });
}

export function getPrimarySquadRoleTag(roleTags: string[]): PrimarySquadRoleTag | null {
  const normalizedTags = normalizeRoleTags(roleTags);

  if (normalizedTags.includes("All-Rounder")) {
    return "All-Rounder";
  }

  if (normalizedTags.includes("Batter")) {
    return "Batter";
  }

  if (normalizedTags.includes("Bowler")) {
    return "Bowler";
  }

  return null;
}

export function validateSquadRoleTags(roleTags: string[]) {
  const normalizedTags = normalizeRoleTags(roleTags);
  const primaryRoleTags = normalizedTags.filter((tag): tag is PrimarySquadRoleTag =>
    primarySquadRoleTagOptions.includes(tag as PrimarySquadRoleTag)
  );

  if (primaryRoleTags.length === 0) {
    throw new Error("Assign exactly one primary role: Batter, Bowler, or All-Rounder.");
  }

  if (primaryRoleTags.length > 1) {
    throw new Error("A player can only have one primary role: Batter, Bowler, or All-Rounder.");
  }

  return normalizedTags;
}

export function normalizeBattingStyle(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function mapSquadPlayerRecord(row: RawPlayerRecord): SquadPlayerRecord {
  return {
    id: typeof row.id === "string" ? row.id : "",
    name: typeof row.name === "string" ? row.name : "",
    isGuest: row.is_guest === true,
    battingStyle: normalizeBattingStyle(row.batting_style),
    isCaptain: row.is_captain === true,
    isWicketKeeper: row.is_wicket_keeper === true,
    roleTags: normalizeRoleTags(row.role_tags)
  };
}

function buildUniquePlayerIdMap(players: SquadPlayerRecord[]) {
  const playerIdsByName = new Map<string, string[]>();

  players.forEach((player) => {
    const normalizedName = cleanName(player.name);

    if (!normalizedName) {
      return;
    }

    const existingIds = playerIdsByName.get(normalizedName) ?? [];
    existingIds.push(player.id);
    playerIdsByName.set(normalizedName, existingIds);
  });

  const uniquePlayerIdByName = new Map<string, string>();
  const ambiguousNames: string[] = [];

  playerIdsByName.forEach((playerIds, normalizedName) => {
    if (playerIds.length === 1) {
      uniquePlayerIdByName.set(normalizedName, playerIds[0]);
      return;
    }

    ambiguousNames.push(normalizedName);
  });

  return {
    uniquePlayerIdByName,
    ambiguousNames: ambiguousNames.sort()
  };
}

export function buildSquadIdentityBridge(players: SquadPlayerRecord[]) {
  return buildUniquePlayerIdMap(players);
}

export async function getCurrentTeamId() {
  const access = await getCurrentUserAccess();

  if (!access.teamId) {
    throw new Error("Could not load the current team.");
  }

  return access.teamId;
}

export async function hasSquadMetadataColumns() {
  if (!squadMetadataColumnsSupportPromise) {
    squadMetadataColumnsSupportPromise = (async () => {
      const { error } = await supabase
        .from("players")
        .select("id, is_captain, is_wicket_keeper, role_tags")
        .limit(1);

      return !error;
    })();
  }

  return squadMetadataColumnsSupportPromise;
}

export async function updateSquadPlayerMetadata(
  playerId: string,
  values: SquadMetadataValues
) {
  await requireAdminAccess();

  if (!squadAdminEnabled) {
    throw new Error("Squad admin controls are disabled.");
  }

  if (!(await hasSquadMetadataColumns())) {
    throw new Error(
      "Squad metadata editing is not available in this environment yet."
    );
  }

  const teamId = await getCurrentTeamId();
  const normalizedValues = {
    batting_style: normalizeBattingStyle(values.battingStyle),
    is_captain: values.isCaptain,
    is_wicket_keeper: values.isWicketKeeper,
    role_tags: validateSquadRoleTags(values.roleTags)
  };

  if (values.isCaptain) {
    const { error: clearCaptainError } = await supabase
      .from("players")
      .update({ is_captain: false })
      .eq("team_id", teamId)
      .neq("id", playerId);

    if (clearCaptainError) {
      throw new Error("Could not update squad metadata.");
    }
  }

  if (values.isWicketKeeper) {
    const { error: clearKeeperError } = await supabase
      .from("players")
      .update({ is_wicket_keeper: false })
      .eq("team_id", teamId)
      .neq("id", playerId);

    if (clearKeeperError) {
      throw new Error("Could not update squad metadata.");
    }
  }

  const { data, error } = await supabase
    .from("players")
    .update(normalizedValues)
    .eq("team_id", teamId)
    .eq("id", playerId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Could not update squad metadata.");
  }

  return mapSquadPlayerRecord(data as RawPlayerRecord);
}

export async function bridgeCurrentTeamPlayerIdentities(
  options?: {
    playerIds?: string[];
  }
): Promise<SquadIdentityBridgeResult> {
  await requireAdminAccess();

  const teamId = await getCurrentTeamId();
  const requestedPlayerIds = Array.from(
    new Set((options?.playerIds ?? []).filter(Boolean))
  );
  const { data: playerData, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", teamId);

  if (playerError) {
    throw new Error("Could not load squad identities for repair.");
  }

  const allTeamPlayers = (playerData ?? []).map((row) => mapSquadPlayerRecord(row as RawPlayerRecord));
  const { uniquePlayerIdByName, ambiguousNames } = buildUniquePlayerIdMap(allTeamPlayers);
  const allowedPlayerIds = requestedPlayerIds.length > 0
    ? new Set(requestedPlayerIds)
    : null;
  const bridgeablePlayerIdByName = allowedPlayerIds
    ? new Map(
        Array.from(uniquePlayerIdByName.entries()).filter(([, playerId]) => allowedPlayerIds.has(playerId))
      )
    : uniquePlayerIdByName;

  if (bridgeablePlayerIdByName.size === 0) {
    return {
      linkedMatchPlayers: 0,
      linkedBattingRows: 0,
      linkedBowlingRows: 0,
      totalLinkedRows: 0,
      skippedAmbiguousNames: ambiguousNames
    };
  }

  const { data: teamMatchData, error: teamMatchError } = await supabase
    .from("matches")
    .select("id")
    .eq("team_id", teamId);

  if (teamMatchError) {
    throw new Error("Could not load team matches for identity repair.");
  }

  const matchIds = ((teamMatchData ?? []) as TeamMatchRow[]).map((match) => match.id);

  if (matchIds.length === 0) {
    return {
      linkedMatchPlayers: 0,
      linkedBattingRows: 0,
      linkedBowlingRows: 0,
      totalLinkedRows: 0,
      skippedAmbiguousNames: ambiguousNames
    };
  }

  const [
    { data: missingMatchPlayerData, error: missingMatchPlayerError },
    { data: inningsData, error: inningsError }
  ] = await Promise.all([
    supabase
      .from("match_players")
      .select("match_id, team_name, player_name")
      .in("match_id", matchIds)
      .is("player_id", null),
    supabase
      .from("innings")
      .select("id, team_name")
      .in("match_id", matchIds)
  ]);

  if (missingMatchPlayerError) {
    throw new Error("Could not load match-player repair rows.");
  }

  if (inningsError) {
    throw new Error("Could not load innings repair rows.");
  }

  const inningsRows = (inningsData ?? []) as TeamInningsRow[];
  const currentTeamInningsIds = inningsRows
    .filter((innings) => normalizeTeamName(innings.team_name) === normalizeTeamName(currentTeamName))
    .map((innings) => innings.id);
  const opponentInningsIds = inningsRows
    .filter((innings) =>
      Boolean(innings.team_name)
      && normalizeTeamName(innings.team_name) !== normalizeTeamName(currentTeamName)
    )
    .map((innings) => innings.id);

  const [
    { data: missingBattingData, error: missingBattingError },
    { data: missingBowlingData, error: missingBowlingError }
  ] = await Promise.all([
    currentTeamInningsIds.length > 0
      ? supabase
          .from("batting_stats")
          .select("innings_id, player_name")
          .in("innings_id", currentTeamInningsIds)
          .is("player_id", null)
      : Promise.resolve({ data: [], error: null }),
    opponentInningsIds.length > 0
      ? supabase
          .from("bowling_stats")
          .select("innings_id, player_name")
          .in("innings_id", opponentInningsIds)
          .is("player_id", null)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (missingBattingError) {
    throw new Error("Could not load batting repair rows.");
  }

  if (missingBowlingError) {
    throw new Error("Could not load bowling repair rows.");
  }

  const missingMatchPlayers = ((missingMatchPlayerData ?? []) as MatchPlayerLinkRow[])
    .filter((row) => normalizeTeamName(row.team_name) === normalizeTeamName(currentTeamName));
  const missingBattingRows = (missingBattingData ?? []) as BattingLinkRow[];
  const missingBowlingRows = (missingBowlingData ?? []) as BowlingLinkRow[];

  let linkedMatchPlayers = 0;
  let linkedBattingRows = 0;
  let linkedBowlingRows = 0;

  for (const row of missingMatchPlayers) {
    const playerId = bridgeablePlayerIdByName.get(cleanName(row.player_name ?? ""));

    if (!playerId || !row.player_name || !row.team_name) {
      continue;
    }

    const { error } = await supabase
      .from("match_players")
      .update({ player_id: playerId })
      .eq("match_id", row.match_id)
      .eq("team_name", row.team_name)
      .eq("player_name", row.player_name)
      .is("player_id", null);

    if (error) {
      throw new Error("Could not repair match-player identity links.");
    }

    linkedMatchPlayers += 1;
  }

  for (const row of missingBattingRows) {
    const playerId = bridgeablePlayerIdByName.get(cleanName(row.player_name ?? ""));

    if (!playerId || !row.player_name) {
      continue;
    }

    const { error } = await supabase
      .from("batting_stats")
      .update({ player_id: playerId })
      .eq("innings_id", row.innings_id)
      .eq("player_name", row.player_name)
      .is("player_id", null);

    if (error) {
      throw new Error("Could not repair batting identity links.");
    }

    linkedBattingRows += 1;
  }

  for (const row of missingBowlingRows) {
    const playerId = bridgeablePlayerIdByName.get(cleanName(row.player_name ?? ""));

    if (!playerId || !row.player_name) {
      continue;
    }

    const { error } = await supabase
      .from("bowling_stats")
      .update({ player_id: playerId })
      .eq("innings_id", row.innings_id)
      .eq("player_name", row.player_name)
      .is("player_id", null);

    if (error) {
      throw new Error("Could not repair bowling identity links.");
    }

    linkedBowlingRows += 1;
  }

  return {
    linkedMatchPlayers,
    linkedBattingRows,
    linkedBowlingRows,
    totalLinkedRows: linkedMatchPlayers + linkedBattingRows + linkedBowlingRows,
    skippedAmbiguousNames: ambiguousNames
  };
}
