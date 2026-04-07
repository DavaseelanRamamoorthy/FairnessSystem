import { squadAdminEnabled } from "@/app/config/teamConfig";
import {
  getCurrentUserAccess,
  requireIdentityManagementAccess,
  requireOrganiserAccess,
  requireValidationManagementAccess
} from "@/app/services/accessControlService";
import { cleanName } from "@/app/services/cleanName";
import { normalizeTeamName } from "@/app/services/teamValidationService";
import { getActiveTeamName } from "@/app/services/teamContextService";
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

export type CreateSquadPlayerInput = {
  name: string;
  seasonId: string;
  status: "active" | "inactive";
  battingStyle: string | null;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  roleTags: string[];
};

export type UpdateSquadPlayerInput = {
  memberId: string;
  playerId: string | null;
  name: string;
  seasonId: string;
  status: "active" | "inactive" | "invited" | "archived";
  battingStyle: string | null;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  roleTags: string[];
};

export type CreateLinkedPlayerForMemberInput = {
  memberId: string;
  name: string;
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
  player_id?: string | null;
};

type BattingLinkRow = {
  innings_id: string;
  player_name: string | null;
  player_id?: string | null;
};

type BowlingLinkRow = {
  innings_id: string;
  player_name: string | null;
  player_id?: string | null;
};

type MemberLinkPlayerRow = {
  member_id?: unknown;
  player_id?: unknown;
};

type TeamMemberAliasBridgeRow = {
  member_id?: unknown;
  player_id?: unknown;
  alias?: unknown;
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

function buildAliasIdentityBridge(
  players: SquadPlayerRecord[],
  memberLinks: MemberLinkPlayerRow[],
  aliasRows: TeamMemberAliasBridgeRow[]
) {
  const playerById = new Map(players.map((player) => [player.id, player] as const));
  const playerIdByMemberId = new Map<string, string>();

  memberLinks.forEach((row) => {
    const memberId = typeof row.member_id === "string" ? row.member_id : null;
    const playerId = typeof row.player_id === "string" ? row.player_id : null;

    if (!memberId || !playerId || !playerById.has(playerId)) {
      return;
    }

    playerIdByMemberId.set(memberId, playerId);
  });

  const aliasCandidates = new Map<string, Set<string>>();

  aliasRows.forEach((row) => {
    const memberId = typeof row.member_id === "string" ? row.member_id : null;
    const alias = cleanName(typeof row.alias === "string" ? row.alias : "");
    const directPlayerId = typeof row.player_id === "string" ? row.player_id : null;
    const playerId = directPlayerId && playerById.has(directPlayerId)
      ? directPlayerId
      : memberId
        ? (playerIdByMemberId.get(memberId) ?? null)
        : null;

    if (!alias || !playerId) {
      return;
    }

    const currentCandidates = aliasCandidates.get(alias) ?? new Set<string>();
    currentCandidates.add(playerId);
    aliasCandidates.set(alias, currentCandidates);
  });

  const aliasPlayerIdByName = new Map<string, string>();
  const ambiguousAliases: string[] = [];

  aliasCandidates.forEach((playerIds, alias) => {
    if (playerIds.size === 1) {
      const [playerId] = Array.from(playerIds);

      if (playerId) {
        aliasPlayerIdByName.set(alias, playerId);
      }

      return;
    }

    ambiguousAliases.push(alias);
  });

  return {
    aliasPlayerIdByName,
    ambiguousAliases: ambiguousAliases.sort()
  };
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
  const access = await requireIdentityManagementAccess();

  if (!squadAdminEnabled) {
    throw new Error("Squad admin controls are disabled.");
  }

  if (!(await hasSquadMetadataColumns())) {
    throw new Error(
      "Squad metadata editing is not available in this environment yet."
    );
  }

  const teamId = access.teamId;
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

export async function createSquadPlayer(input: CreateSquadPlayerInput) {
  const access = await requireOrganiserAccess();

  if (!squadAdminEnabled) {
    throw new Error("Squad admin controls are disabled.");
  }

  if (!(await hasSquadMetadataColumns())) {
    throw new Error("Squad metadata editing is not available in this environment yet.");
  }

  const normalizedName = input.name.trim().replace(/\s+/g, " ");

  if (!normalizedName) {
    throw new Error("Player name is required.");
  }

  if (!input.seasonId.trim()) {
    throw new Error("Season is required.");
  }

  const normalizedStatus = input.status === "inactive" ? "inactive" : "active";
  const normalizedRoleTags = validateSquadRoleTags(input.roleTags);
  const normalizedBattingStyle = normalizeBattingStyle(input.battingStyle);
  const normalizedPlayerName = cleanName(normalizedName);

  const { data: seasonRow, error: seasonError } = await supabase
    .from("membership_seasons")
    .select("id")
    .eq("id", input.seasonId)
    .eq("team_id", access.teamId)
    .maybeSingle();

  if (seasonError || !seasonRow) {
    throw new Error("Could not find the selected season.");
  }

  const { data: existingMembers, error: existingMembersError } = await supabase
    .from("team_members")
    .select("id, name")
    .eq("team_id", access.teamId);

  if (existingMembersError) {
    throw new Error("Could not validate existing roster members.");
  }

  const hasDuplicateMemberName = (existingMembers ?? []).some((row) =>
    cleanName(typeof row.name === "string" ? row.name : "") === normalizedPlayerName
  );

  if (hasDuplicateMemberName) {
    throw new Error("A roster member with that name already exists.");
  }

  const { data: existingPlayers, error: existingPlayersError } = await supabase
    .from("players")
    .select("id, name")
    .eq("team_id", access.teamId)
    .eq("is_guest", false);

  if (existingPlayersError) {
    throw new Error("Could not validate existing players.");
  }

  const hasDuplicatePlayerName = (existingPlayers ?? []).some((row) =>
    cleanName(typeof row.name === "string" ? row.name : "") === normalizedPlayerName
  );

  if (hasDuplicatePlayerName) {
    throw new Error("A player profile with that name already exists.");
  }

  if (input.isCaptain) {
    const { error: clearCaptainError } = await supabase
      .from("players")
      .update({ is_captain: false })
      .eq("team_id", access.teamId);

    if (clearCaptainError) {
      throw new Error("Could not prepare the captain flag for the new player.");
    }
  }

  if (input.isWicketKeeper) {
    const { error: clearKeeperError } = await supabase
      .from("players")
      .update({ is_wicket_keeper: false })
      .eq("team_id", access.teamId);

    if (clearKeeperError) {
      throw new Error("Could not prepare the wicket keeper flag for the new player.");
    }
  }

  const { data: memberRow, error: memberError } = await supabase
    .from("team_members")
    .insert({
      team_id: access.teamId,
      season_id: input.seasonId,
      name: normalizedName,
      role: "player",
      status: normalizedStatus
    })
    .select("id")
    .single();

  if (memberError || !memberRow || typeof memberRow.id !== "string") {
    throw new Error("Could not create the roster member.");
  }

  const memberId = memberRow.id;

  const { data: playerRow, error: playerError } = await supabase
    .from("players")
    .insert({
      team_id: access.teamId,
      member_id: memberId,
      name: normalizedName,
      is_guest: false,
      batting_style: normalizedBattingStyle,
      is_captain: input.isCaptain,
      is_wicket_keeper: input.isWicketKeeper,
      role_tags: normalizedRoleTags
    })
    .select("*")
    .single();

  if (playerError || !playerRow || typeof playerRow.id !== "string") {
    await supabase
      .from("team_members")
      .delete()
      .eq("id", memberId)
      .eq("team_id", access.teamId);

    throw new Error("Could not create the linked player profile.");
  }

  const playerId = playerRow.id;

  const { error: linkError } = await supabase
    .from("member_links")
    .insert({
      member_id: memberId,
      player_id: playerId
    });

  if (linkError) {
    await supabase
      .from("players")
      .delete()
      .eq("id", playerId)
      .eq("team_id", access.teamId);

    await supabase
      .from("team_members")
      .delete()
      .eq("id", memberId)
      .eq("team_id", access.teamId);

    throw new Error("Could not link the new roster member to the player profile.");
  }

  return {
    memberId,
    player: mapSquadPlayerRecord(playerRow as RawPlayerRecord)
  } as const;
}

export async function updateSquadPlayer(input: UpdateSquadPlayerInput) {
  const access = await requireOrganiserAccess();

  if (!squadAdminEnabled) {
    throw new Error("Squad admin controls are disabled.");
  }

  if (!(await hasSquadMetadataColumns())) {
    throw new Error("Squad metadata editing is not available in this environment yet.");
  }

  const normalizedName = input.name.trim().replace(/\s+/g, " ");

  if (!normalizedName) {
    throw new Error("Player name is required.");
  }

  if (!input.seasonId.trim()) {
    throw new Error("Season is required.");
  }

  if (!["active", "inactive", "invited", "archived"].includes(input.status)) {
    throw new Error("Invalid player roster status.");
  }

  const normalizedRoleTags = validateSquadRoleTags(input.roleTags);
  const normalizedBattingStyle = normalizeBattingStyle(input.battingStyle);
  const normalizedPlayerName = cleanName(normalizedName);

  const { data: memberRow, error: memberError } = await supabase
    .from("team_members")
    .select("id")
    .eq("id", input.memberId)
    .eq("team_id", access.teamId)
    .maybeSingle();

  if (memberError || !memberRow) {
    throw new Error("Could not find the selected roster member.");
  }

  const { data: seasonRow, error: seasonError } = await supabase
    .from("membership_seasons")
    .select("id")
    .eq("id", input.seasonId)
    .eq("team_id", access.teamId)
    .maybeSingle();

  if (seasonError || !seasonRow) {
    throw new Error("Could not find the selected season.");
  }

  const { data: existingMembers, error: existingMembersError } = await supabase
    .from("team_members")
    .select("id, name")
    .eq("team_id", access.teamId)
    .neq("id", input.memberId);

  if (existingMembersError) {
    throw new Error("Could not validate existing roster members.");
  }

  const hasDuplicateMemberName = (existingMembers ?? []).some((row) =>
    cleanName(typeof row.name === "string" ? row.name : "") === normalizedPlayerName
  );

  if (hasDuplicateMemberName) {
    throw new Error("Another roster member already uses that name.");
  }

  if (input.playerId) {
    const { data: existingPlayers, error: existingPlayersError } = await supabase
      .from("players")
      .select("id, name")
      .eq("team_id", access.teamId)
      .eq("is_guest", false)
      .neq("id", input.playerId);

    if (existingPlayersError) {
      throw new Error("Could not validate existing players.");
    }

    const hasDuplicatePlayerName = (existingPlayers ?? []).some((row) =>
      cleanName(typeof row.name === "string" ? row.name : "") === normalizedPlayerName
    );

    if (hasDuplicatePlayerName) {
      throw new Error("Another player profile already uses that name.");
    }
  }

  if (input.isCaptain) {
    const captainQuery = supabase
      .from("players")
      .update({ is_captain: false })
      .eq("team_id", access.teamId);

    if (input.playerId) {
      captainQuery.neq("id", input.playerId);
    }

    const { error: clearCaptainError } = await captainQuery;

    if (clearCaptainError) {
      throw new Error("Could not update the captain flag for the roster.");
    }
  }

  if (input.isWicketKeeper) {
    const keeperQuery = supabase
      .from("players")
      .update({ is_wicket_keeper: false })
      .eq("team_id", access.teamId);

    if (input.playerId) {
      keeperQuery.neq("id", input.playerId);
    }

    const { error: clearKeeperError } = await keeperQuery;

    if (clearKeeperError) {
      throw new Error("Could not update the wicket keeper flag for the roster.");
    }
  }

  const timestamp = new Date().toISOString();

  const { error: updateMemberError } = await supabase
    .from("team_members")
    .update({
      name: normalizedName,
      season_id: input.seasonId,
      status: input.status,
      updated_at: timestamp
    })
    .eq("id", input.memberId)
    .eq("team_id", access.teamId);

  if (updateMemberError) {
    throw new Error("Could not update the roster member.");
  }

  if (!input.playerId) {
    return;
  }

  const { error: updatePlayerError } = await supabase
    .from("players")
    .update({
      name: normalizedName,
      batting_style: normalizedBattingStyle,
      is_captain: input.isCaptain,
      is_wicket_keeper: input.isWicketKeeper,
      role_tags: normalizedRoleTags
    })
    .eq("id", input.playerId)
    .eq("team_id", access.teamId);

  if (updatePlayerError) {
    throw new Error("Could not update the linked player profile.");
  }
}

export async function createLinkedPlayerForMember(input: CreateLinkedPlayerForMemberInput) {
  const access = await requireOrganiserAccess();

  if (!squadAdminEnabled) {
    throw new Error("Squad admin controls are disabled.");
  }

  if (!(await hasSquadMetadataColumns())) {
    throw new Error("Squad metadata editing is not available in this environment yet.");
  }

  const normalizedName = input.name.trim().replace(/\s+/g, " ");

  if (!normalizedName) {
    throw new Error("Player name is required.");
  }

  const normalizedRoleTags = validateSquadRoleTags(input.roleTags);
  const normalizedBattingStyle = normalizeBattingStyle(input.battingStyle);
  const normalizedPlayerName = cleanName(normalizedName);

  const { data: memberRow, error: memberError } = await supabase
    .from("team_members")
    .select("id, name, user_id")
    .eq("id", input.memberId)
    .eq("team_id", access.teamId)
    .maybeSingle();

  if (memberError || !memberRow) {
    throw new Error("Could not find the selected roster member.");
  }

  const { data: existingLink, error: existingLinkError } = await supabase
    .from("member_links")
    .select("id, player_id")
    .eq("member_id", input.memberId)
    .maybeSingle();

  if (existingLinkError) {
    throw new Error("Could not load the current member link.");
  }

  if (typeof existingLink?.player_id === "string") {
    throw new Error("This member already has a linked player.");
  }

  const { data: existingPlayers, error: existingPlayersError } = await supabase
    .from("players")
    .select("id, name")
    .eq("team_id", access.teamId)
    .eq("is_guest", false);

  if (existingPlayersError) {
    throw new Error("Could not validate existing players.");
  }

  const hasDuplicatePlayerName = (existingPlayers ?? []).some((row) =>
    cleanName(typeof row.name === "string" ? row.name : "") === normalizedPlayerName
  );

  if (hasDuplicatePlayerName) {
    throw new Error("A player profile with that name already exists.");
  }

  if (input.isCaptain) {
    const { error: clearCaptainError } = await supabase
      .from("players")
      .update({ is_captain: false })
      .eq("team_id", access.teamId);

    if (clearCaptainError) {
      throw new Error("Could not prepare the captain flag for the new player.");
    }
  }

  if (input.isWicketKeeper) {
    const { error: clearKeeperError } = await supabase
      .from("players")
      .update({ is_wicket_keeper: false })
      .eq("team_id", access.teamId);

    if (clearKeeperError) {
      throw new Error("Could not prepare the wicket keeper flag for the new player.");
    }
  }

  const { data: playerRow, error: playerError } = await supabase
    .from("players")
    .insert({
      team_id: access.teamId,
      member_id: input.memberId,
      name: normalizedName,
      is_guest: false,
      batting_style: normalizedBattingStyle,
      is_captain: input.isCaptain,
      is_wicket_keeper: input.isWicketKeeper,
      role_tags: normalizedRoleTags
    })
    .select("*")
    .single();

  if (playerError || !playerRow || typeof playerRow.id !== "string") {
    throw new Error("Could not create the linked player profile.");
  }

  const playerId = playerRow.id;

  if (existingLink?.id) {
    const { error: linkUpdateError } = await supabase
      .from("member_links")
      .update({ player_id: playerId })
      .eq("id", existingLink.id);

    if (linkUpdateError) {
      await supabase
        .from("players")
        .delete()
        .eq("id", playerId)
        .eq("team_id", access.teamId);

      throw new Error("Could not update the member link with the new player.");
    }
  } else {
    const { error: linkInsertError } = await supabase
      .from("member_links")
      .insert({
        member_id: input.memberId,
        player_id: playerId
      });

    if (linkInsertError) {
      await supabase
        .from("players")
        .delete()
        .eq("id", playerId)
        .eq("team_id", access.teamId);

      throw new Error("Could not create the linked player record.");
    }
  }

  if (typeof memberRow.user_id === "string") {
    const { error: userUpdateError } = await supabase
      .from("users")
      .update({ player_id: playerId, updated_at: new Date().toISOString() })
      .eq("id", memberRow.user_id)
      .eq("team_id", access.teamId);

    if (userUpdateError) {
      throw new Error("Could not update the linked user's player profile.");
    }
  }

  return {
    memberId: input.memberId,
    player: mapSquadPlayerRecord(playerRow as RawPlayerRecord),
    memberName: typeof memberRow.name === "string" ? memberRow.name : normalizedName
  } as const;
}

export async function bridgeCurrentTeamPlayerIdentities(
  options?: {
    playerIds?: string[];
  }
): Promise<SquadIdentityBridgeResult> {
  await requireValidationManagementAccess();

  const [teamId, activeTeamName] = await Promise.all([
    getCurrentTeamId(),
    getActiveTeamName()
  ]);
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
  const [
    { data: memberLinkData, error: memberLinkError },
    { data: aliasData, error: aliasError }
  ] = await Promise.all([
    supabase
      .from("member_links")
      .select("member_id, player_id")
      .not("player_id", "is", null),
    supabase
      .from("team_member_aliases")
      .select("member_id, player_id, alias")
      .eq("team_id", teamId)
  ]);

  if (memberLinkError) {
    throw new Error("Could not load member links for identity repair.");
  }

  if (aliasError) {
    throw new Error("Could not load team aliases for identity repair.");
  }

  const { aliasPlayerIdByName, ambiguousAliases } = buildAliasIdentityBridge(
    allTeamPlayers,
    (memberLinkData ?? []) as MemberLinkPlayerRow[],
    (aliasData ?? []) as TeamMemberAliasBridgeRow[]
  );
  const allowedPlayerIds = requestedPlayerIds.length > 0
    ? new Set(requestedPlayerIds)
    : null;
  const bridgeablePlayerIdByName = allowedPlayerIds
    ? new Map(
        Array.from(uniquePlayerIdByName.entries()).filter(([, playerId]) => allowedPlayerIds.has(playerId))
      )
    : uniquePlayerIdByName;
  const bridgeableAliasPlayerIdByName = new Map<string, string>();

  aliasPlayerIdByName.forEach((playerId, alias) => {
    if (!allowedPlayerIds || allowedPlayerIds.has(playerId)) {
      bridgeableAliasPlayerIdByName.set(alias, playerId);
    }
  });
  const resolvedBridgeablePlayerIdByName = new Map<string, string>();
  const crossSourceAmbiguousNames = new Set<string>();

  Array.from(
    new Set([
      ...bridgeablePlayerIdByName.keys(),
      ...bridgeableAliasPlayerIdByName.keys()
    ])
  ).forEach((normalizedName) => {
    const canonicalPlayerId = bridgeablePlayerIdByName.get(normalizedName) ?? null;
    const aliasPlayerId = bridgeableAliasPlayerIdByName.get(normalizedName) ?? null;

    if (canonicalPlayerId && aliasPlayerId && canonicalPlayerId !== aliasPlayerId) {
      crossSourceAmbiguousNames.add(normalizedName);
      return;
    }

    const resolvedPlayerId = canonicalPlayerId ?? aliasPlayerId;

    if (resolvedPlayerId) {
      resolvedBridgeablePlayerIdByName.set(normalizedName, resolvedPlayerId);
    }
  });

  const skippedAmbiguousNames = Array.from(
    new Set([...ambiguousNames, ...ambiguousAliases, ...crossSourceAmbiguousNames])
  ).sort();

  if (resolvedBridgeablePlayerIdByName.size === 0) {
    return {
      linkedMatchPlayers: 0,
      linkedBattingRows: 0,
      linkedBowlingRows: 0,
      totalLinkedRows: 0,
      skippedAmbiguousNames
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
      skippedAmbiguousNames
    };
  }

  const [
    { data: missingMatchPlayerData, error: missingMatchPlayerError },
    { data: inningsData, error: inningsError }
  ] = await Promise.all([
    supabase
      .from("match_players")
      .select("match_id, team_name, player_name, player_id")
      .in("match_id", matchIds),
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
    .filter((innings) => normalizeTeamName(innings.team_name) === normalizeTeamName(activeTeamName))
    .map((innings) => innings.id);
  const opponentInningsIds = inningsRows
    .filter((innings) =>
      Boolean(innings.team_name)
      && normalizeTeamName(innings.team_name) !== normalizeTeamName(activeTeamName)
    )
    .map((innings) => innings.id);

  const [
    { data: missingBattingData, error: missingBattingError },
    { data: missingBowlingData, error: missingBowlingError }
  ] = await Promise.all([
    currentTeamInningsIds.length > 0
      ? supabase
          .from("batting_stats")
          .select("innings_id, player_name, player_id")
          .in("innings_id", currentTeamInningsIds)
      : Promise.resolve({ data: [], error: null }),
    opponentInningsIds.length > 0
      ? supabase
          .from("bowling_stats")
          .select("innings_id, player_name, player_id")
          .in("innings_id", opponentInningsIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (missingBattingError) {
    throw new Error("Could not load batting repair rows.");
  }

  if (missingBowlingError) {
    throw new Error("Could not load bowling repair rows.");
  }

  const repairableMatchPlayers = ((missingMatchPlayerData ?? []) as MatchPlayerLinkRow[])
    .filter((row) => normalizeTeamName(row.team_name) === normalizeTeamName(activeTeamName));
  const repairableBattingRows = (missingBattingData ?? []) as BattingLinkRow[];
  const repairableBowlingRows = (missingBowlingData ?? []) as BowlingLinkRow[];

  let linkedMatchPlayers = 0;
  let linkedBattingRows = 0;
  let linkedBowlingRows = 0;

  for (const row of repairableMatchPlayers) {
    const normalizedName = cleanName(row.player_name ?? "");
    const playerId = resolvedBridgeablePlayerIdByName.get(normalizedName);

    if (!playerId || !row.player_name || !row.team_name || row.player_id === playerId) {
      continue;
    }

    const { error } = await supabase
      .from("match_players")
      .update({ player_id: playerId })
      .eq("match_id", row.match_id)
      .eq("team_name", row.team_name)
      .eq("player_name", row.player_name);

    if (error) {
      throw new Error("Could not repair match-player identity links.");
    }

    linkedMatchPlayers += 1;
  }

  for (const row of repairableBattingRows) {
    const normalizedName = cleanName(row.player_name ?? "");
    const playerId = resolvedBridgeablePlayerIdByName.get(normalizedName);

    if (!playerId || !row.player_name || row.player_id === playerId) {
      continue;
    }

    const { error } = await supabase
      .from("batting_stats")
      .update({ player_id: playerId })
      .eq("innings_id", row.innings_id)
      .eq("player_name", row.player_name);

    if (error) {
      throw new Error("Could not repair batting identity links.");
    }

    linkedBattingRows += 1;
  }

  for (const row of repairableBowlingRows) {
    const normalizedName = cleanName(row.player_name ?? "");
    const playerId = resolvedBridgeablePlayerIdByName.get(normalizedName);

    if (!playerId || !row.player_name || row.player_id === playerId) {
      continue;
    }

    const { error } = await supabase
      .from("bowling_stats")
      .update({ player_id: playerId })
      .eq("innings_id", row.innings_id)
      .eq("player_name", row.player_name);

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
    skippedAmbiguousNames
  };
}
