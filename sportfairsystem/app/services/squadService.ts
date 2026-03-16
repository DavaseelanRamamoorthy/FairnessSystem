import { squadAdminEnabled } from "@/app/config/teamConfig";
import { getCurrentUserAccess, requireAdminAccess } from "@/app/services/accessControlService";
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
      "Squad metadata columns are not installed yet. Run database/phase4_squad_metadata.sql first."
    );
  }

  const teamId = await getCurrentTeamId();
  const normalizedValues = {
    batting_style: normalizeBattingStyle(values.battingStyle),
    is_captain: values.isCaptain,
    is_wicket_keeper: values.isWicketKeeper,
    role_tags: normalizeRoleTags(values.roleTags)
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
