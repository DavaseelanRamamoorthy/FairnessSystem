import { requireAdminAccess } from "@/app/services/accessControlService";
import { formatName } from "@/app/services/formatname";
import { supabase } from "@/app/services/supabaseClient";

export type TeamUserMappingPlayer = {
  id: string;
  name: string;
};

export type TeamUserMappingRecord = {
  id: string;
  email: string;
  role: "admin" | "member";
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  playerId: string | null;
  playerName: string | null;
  displayName: string;
};

type RawUserMappingRow = {
  id?: unknown;
  email?: unknown;
  role?: unknown;
  username?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  phone_country_code?: unknown;
  phone_number?: unknown;
  player_id?: unknown;
};

type RawPlayerRow = {
  id?: unknown;
  name?: unknown;
  is_guest?: unknown;
};

let playerUserMappingSupportPromise: Promise<boolean> | null = null;

function normalizeNullableText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildUserDisplayName(row: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string;
}) {
  const fullName = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return formatName(fullName);
  }

  if (row.username) {
    return `@${row.username}`;
  }

  return row.email;
}

function mapUserMappingRow(
  row: RawUserMappingRow,
  playerNameById: Map<string, string>
): TeamUserMappingRecord {
  const playerId = typeof row.player_id === "string" ? row.player_id : null;
  const firstName = normalizeNullableText(row.first_name);
  const lastName = normalizeNullableText(row.last_name);
  const username = normalizeNullableText(row.username);
  const email = normalizeNullableText(row.email) ?? "";

  return {
    id: typeof row.id === "string" ? row.id : "",
    email,
    role: row.role === "admin" ? "admin" : "member",
    username,
    firstName,
    lastName,
    phoneCountryCode: normalizeNullableText(row.phone_country_code),
    phoneNumber: normalizeNullableText(row.phone_number),
    playerId,
    playerName: playerId ? (playerNameById.get(playerId) ?? null) : null,
    displayName: buildUserDisplayName({
      firstName,
      lastName,
      username,
      email
    })
  };
}

function mapPlayerRow(row: RawPlayerRow): TeamUserMappingPlayer {
  return {
    id: typeof row.id === "string" ? row.id : "",
    name: typeof row.name === "string" ? row.name : ""
  };
}

export async function hasPlayerUserMappingSupport() {
  if (!playerUserMappingSupportPromise) {
    playerUserMappingSupportPromise = (async () => {
      const { error } = await supabase
        .from("users")
        .select("id, player_id")
        .limit(1);

      return !error;
    })();
  }

  return playerUserMappingSupportPromise;
}

export async function getTeamUserMappings() {
  const access = await requireAdminAccess();

  if (!(await hasPlayerUserMappingSupport())) {
    throw new Error(
      "Player-user mapping is not available in this environment yet."
    );
  }

  const [
    { data: userData, error: userError },
    { data: playerData, error: playerError }
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, role, username, first_name, last_name, phone_country_code, phone_number, player_id")
      .eq("team_id", access.teamId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("players")
      .select("id, name, is_guest")
      .eq("team_id", access.teamId)
      .eq("is_guest", false)
      .order("name", { ascending: true })
  ]);

  if (userError) {
    throw new Error("Could not load team users for player mapping.");
  }

  if (playerError) {
    throw new Error("Could not load team players for player mapping.");
  }

  const players = (playerData ?? []).map((row) => mapPlayerRow(row as RawPlayerRow));
  const playerNameById = new Map(players.map((player) => [player.id, player.name]));
  const users = (userData ?? [])
    .map((row) => mapUserMappingRow(row as RawUserMappingRow, playerNameById))
    .sort((left, right) => {
      if (Boolean(left.playerId) !== Boolean(right.playerId)) {
        return left.playerId ? 1 : -1;
      }

      return left.displayName.localeCompare(right.displayName);
    });

  return {
    users,
    players
  };
}

export async function updateTeamUserPlayerMapping(userId: string, playerId: string | null) {
  const access = await requireAdminAccess();

  if (!(await hasPlayerUserMappingSupport())) {
    throw new Error(
      "Player-user mapping is not available in this environment yet."
    );
  }

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("team_id", access.teamId)
    .maybeSingle();

  if (userError || !userRow) {
    throw new Error("Could not find the selected team user.");
  }

  if (playerId) {
    const { data: playerRow, error: playerError } = await supabase
      .from("players")
      .select("id, is_guest")
      .eq("id", playerId)
      .eq("team_id", access.teamId)
      .eq("is_guest", false)
      .maybeSingle();

    if (playerError || !playerRow) {
      throw new Error("Could not find the selected squad player.");
    }
  }

  const { error } = await supabase
    .from("users")
    .update({ player_id: playerId })
    .eq("id", userId)
    .eq("team_id", access.teamId);

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "That player is already mapped to another user."
        : "Could not update the player-user mapping."
    );
  }
}
