import {
  canManageIdentityWorkspace,
  requireMembershipManagementAccess,
  requireMembershipWorkspaceAccess,
  requireOrganiserAccess,
  requireIdentityManagementAccess
} from "@/app/services/accessControlService";
import { formatName } from "@/app/services/formatname";
import { supabase } from "@/app/services/supabaseClient";
import {
  getDefaultPermissionsForRole,
  mapBusinessRoleToAppAuthRole,
  mapBusinessRoleToLegacyMembershipRole,
  normalizeTeamBusinessRole,
  TeamBusinessRole,
  TeamPermission
} from "@/app/services/teamRoles";
import { normalizeRoleTags } from "@/app/services/squadService";

export type MembershipSeasonRecord = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export type TeamMemberAliasType = "primary" | "scorecard" | "short" | "legacy";

export type TeamMemberAliasRecord = {
  aliasId: string;
  playerId: string | null;
  alias: string;
  aliasType: TeamMemberAliasType;
  isPrimary: boolean;
};

export type TeamMembershipRecord = {
  memberId: string;
  name: string;
  role: TeamBusinessRole;
  status: "active" | "inactive" | "invited" | "archived";
  seasonId: string | null;
  seasonName: string | null;
  userId: string | null;
  userDisplayName: string | null;
  userEmail: string | null;
  primaryRole: string | null;
  bowlingStyle: string | null;
  batterPreference: string | null;
  bowlerPreference: string | null;
  cricHeroesName: string | null;
  playerId: string | null;
  playerName: string | null;
  battingStyle: string | null;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  roleTags: string[];
  aliases: TeamMemberAliasRecord[];
  permissions: TeamPermission[];
};

export type TeamMembershipRole = TeamMembershipRecord["role"];
export type TeamMembershipStatus = TeamMembershipRecord["status"];

export type MembershipSeasonInput = {
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export type TeamMembershipUserOption = {
  userId: string;
  displayName: string;
  email: string | null;
  linkedMemberId: string | null;
};

export type TeamMembershipPlayerOption = {
  playerId: string;
  displayName: string;
  isGuest: boolean;
  linkedMemberId: string | null;
};

type RawSeasonRow = {
  id?: unknown;
  name?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  is_active?: unknown;
};

type RawMemberRow = {
  id?: unknown;
  name?: unknown;
  role?: unknown;
  team_role?: unknown;
  status?: unknown;
  season_id?: unknown;
};

type RawMemberLinkRow = {
  member_id?: unknown;
  user_id?: unknown;
  player_id?: unknown;
};

type RawUserRow = {
  id?: unknown;
  email?: unknown;
  username?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  primary_role?: unknown;
  batting_style?: unknown;
  bowling_style?: unknown;
  batter_preference?: unknown;
  bowler_preference?: unknown;
  cricheroes_name?: unknown;
};

type RawPlayerRow = {
  id?: unknown;
  name?: unknown;
  is_guest?: unknown;
  member_id?: unknown;
  batting_style?: unknown;
  is_captain?: unknown;
  is_wicket_keeper?: unknown;
  role_tags?: unknown;
};

type RawAliasRow = {
  id?: unknown;
  member_id?: unknown;
  player_id?: unknown;
  alias?: unknown;
  alias_type?: unknown;
  is_primary?: unknown;
};

type RawPermissionRow = {
  member_id?: unknown;
  permission?: unknown;
};

let membershipFoundationSupportPromise: Promise<boolean> | null = null;

function normalizeNullableText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildUserDisplayName(row: {
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
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

function normalizeAlias(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeAliasKey(value: string) {
  return normalizeAlias(value).toLowerCase();
}

function mapAliasType(value: unknown): TeamMemberAliasType {
  if (value === "primary" || value === "short" || value === "legacy") {
    return value;
  }

  return "scorecard";
}

async function getResolvedLinkedPlayerId(teamId: string, memberId: string) {
  const { data: linkRow, error: linkError } = await supabase
    .from("member_links")
    .select("player_id")
    .eq("member_id", memberId)
    .maybeSingle();

  if (linkError) {
    throw new Error("Could not load the linked player for this member.");
  }

  const linkedPlayerId = typeof linkRow?.player_id === "string" ? linkRow.player_id : null;

  if (!linkedPlayerId) {
    return null;
  }

  const { data: playerRow, error: playerError } = await supabase
    .from("players")
    .select("id")
    .eq("id", linkedPlayerId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (playerError) {
    throw new Error("Could not validate the linked player for this member.");
  }

  return playerRow?.id && typeof playerRow.id === "string" ? playerRow.id : null;
}

function mapSeasonRow(row: RawSeasonRow): MembershipSeasonRecord {
  return {
    id: typeof row.id === "string" ? row.id : "",
    name: typeof row.name === "string" ? row.name : "",
    startDate: typeof row.start_date === "string" ? row.start_date : "",
    endDate: typeof row.end_date === "string" ? row.end_date : "",
    isActive: row.is_active === true
  };
}

function applyEffectiveActiveSeason(seasons: MembershipSeasonRecord[]) {
  if (seasons.length === 0) {
    return seasons;
  }

  if (seasons.some((season) => season.isActive)) {
    return seasons;
  }

  const sortedSeasons = [...seasons].sort((left, right) => {
    if (left.startDate !== right.startDate) {
      return right.startDate.localeCompare(left.startDate);
    }

    if (left.endDate !== right.endDate) {
      return right.endDate.localeCompare(left.endDate);
    }

    return right.name.localeCompare(left.name);
  });
  const fallbackSeasonId = sortedSeasons[0]?.id ?? null;

  return seasons.map((season) => ({
    ...season,
    isActive: season.id === fallbackSeasonId
  }));
}

export async function hasMembershipFoundationSupport() {
  if (!membershipFoundationSupportPromise) {
    membershipFoundationSupportPromise = (async () => {
      const { error } = await supabase
        .from("team_members")
        .select("id")
        .limit(1);

      return !error;
    })();
  }

  return membershipFoundationSupportPromise;
}

export async function canManageExternalNames() {
  if (!(await hasMembershipFoundationSupport())) {
    return false;
  }

  try {
    return await canManageIdentityWorkspace();
  } catch {
    return false;
  }
}

export async function getMembershipSeasons() {
  const access = await requireMembershipWorkspaceAccess();

  if (!(await hasMembershipFoundationSupport())) {
    throw new Error("Membership foundation is not available in this environment yet.");
  }

  const { data, error } = await supabase
    .from("membership_seasons")
    .select("id, name, start_date, end_date, is_active")
    .eq("team_id", access.teamId)
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error("Could not load membership seasons.");
  }

  return applyEffectiveActiveSeason(
    (data ?? []).map((row) => mapSeasonRow(row as RawSeasonRow))
  );
}

export async function getTeamMembershipRecords() {
  const access = await requireMembershipWorkspaceAccess();

  if (!(await hasMembershipFoundationSupport())) {
    throw new Error("Membership foundation is not available in this environment yet.");
  }

  const [
    { data: membersData, error: membersError },
    { data: linksData, error: linksError },
    { data: seasonsData, error: seasonsError },
    { data: usersData, error: usersError },
    { data: playersData, error: playersError },
    { data: aliasesData, error: aliasesError },
    { data: permissionsData, error: permissionsError }
  ] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, name, role, team_role, status, season_id")
      .eq("team_id", access.teamId)
      .order("name", { ascending: true }),
    supabase
      .from("member_links")
      .select("member_id, user_id, player_id"),
    supabase
      .from("membership_seasons")
      .select("id, name")
      .eq("team_id", access.teamId),
    supabase
      .from("users")
      .select(
        "id, email, username, first_name, last_name, primary_role, batting_style, bowling_style, batter_preference, bowler_preference, cricheroes_name"
      )
      .eq("team_id", access.teamId),
    supabase
      .from("players")
      .select("id, name, batting_style, is_captain, is_wicket_keeper, role_tags")
      .eq("team_id", access.teamId)
      .order("name", { ascending: true }),
    supabase
      .from("team_member_aliases")
      .select("id, member_id, player_id, alias, alias_type, is_primary")
      .eq("team_id", access.teamId)
      .order("created_at", { ascending: true }),
    supabase
      .from("team_member_permissions")
      .select("member_id, permission")
      .eq("team_id", access.teamId)
  ]);

  if (membersError) {
    throw new Error("Could not load team members.");
  }

  if (linksError) {
    throw new Error("Could not load member links.");
  }

  if (seasonsError) {
    throw new Error("Could not load membership seasons.");
  }

  if (usersError) {
    throw new Error("Could not load membership-linked users.");
  }

  if (playersError) {
    throw new Error("Could not load membership-linked players.");
  }

  if (aliasesError) {
    throw new Error("Could not load team member aliases.");
  }

  if (permissionsError) {
    throw new Error("Could not load team member permissions.");
  }

  const members = (membersData ?? []) as RawMemberRow[];
  const memberIds = new Set(
    members
      .map((row) => (typeof row.id === "string" ? row.id : null))
      .filter((value): value is string => Boolean(value))
  );

  const linksByMemberId = new Map<string, RawMemberLinkRow>();
  ((linksData ?? []) as RawMemberLinkRow[]).forEach((row) => {
    const memberId = typeof row.member_id === "string" ? row.member_id : null;

    if (!memberId || !memberIds.has(memberId)) {
      return;
    }

    linksByMemberId.set(memberId, row);
  });

  const seasonNameById = new Map<string, string>(
    ((seasonsData ?? []) as Array<{ id?: unknown; name?: unknown }>)
      .map((row) => {
        const seasonId = typeof row.id === "string" ? row.id : null;
        const seasonName = typeof row.name === "string" ? row.name : null;
        return seasonId && seasonName ? [seasonId, seasonName] as const : null;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry))
  );

  const userDisplayById = new Map<string, {
    displayName: string | null;
    email: string | null;
    primaryRole: string | null;
    battingStyle: string | null;
    bowlingStyle: string | null;
    batterPreference: string | null;
    bowlerPreference: string | null;
    cricHeroesName: string | null;
  }>(
    ((usersData ?? []) as RawUserRow[]).map((row) => {
      const userId = typeof row.id === "string" ? row.id : "";
      const email = normalizeNullableText(row.email);
      const username = normalizeNullableText(row.username);
      const firstName = normalizeNullableText(row.first_name);
      const lastName = normalizeNullableText(row.last_name);

      return [
        userId,
        {
          displayName: buildUserDisplayName({
            email,
            username,
            firstName,
            lastName
          }),
          email,
          primaryRole: normalizeNullableText(row.primary_role),
          battingStyle: normalizeNullableText(row.batting_style),
          bowlingStyle: normalizeNullableText(row.bowling_style),
          batterPreference: normalizeNullableText(row.batter_preference),
          bowlerPreference: normalizeNullableText(row.bowler_preference),
          cricHeroesName: normalizeNullableText(row.cricheroes_name)
        }
      ] as const;
    })
  );

  const playerDetailsById = new Map<string, {
    name: string;
    battingStyle: string | null;
    isCaptain: boolean;
    isWicketKeeper: boolean;
    roleTags: string[];
  }>(
    ((playersData ?? []) as RawPlayerRow[])
      .map((row) => {
        const playerId = typeof row.id === "string" ? row.id : null;
        const playerName = typeof row.name === "string" ? row.name : null;
        return playerId && playerName ? [
          playerId,
          {
            name: playerName,
            battingStyle: normalizeNullableText(row.batting_style),
            isCaptain: row.is_captain === true,
            isWicketKeeper: row.is_wicket_keeper === true,
            roleTags: normalizeRoleTags(row.role_tags)
          }
        ] as const : null;
      })
      .filter((entry): entry is readonly [string, {
        name: string;
        battingStyle: string | null;
        isCaptain: boolean;
        isWicketKeeper: boolean;
        roleTags: string[];
      }] => Boolean(entry))
  );

  const aliasesByMemberId = new Map<string, TeamMemberAliasRecord[]>();
  ((aliasesData ?? []) as RawAliasRow[]).forEach((row) => {
    const memberId = typeof row.member_id === "string" ? row.member_id : null;
    const aliasId = typeof row.id === "string" ? row.id : null;
    const alias = normalizeNullableText(row.alias);

    if (!memberId || !aliasId || !alias || !memberIds.has(memberId)) {
      return;
    }

    const nextAlias: TeamMemberAliasRecord = {
      aliasId,
      playerId: typeof row.player_id === "string" ? row.player_id : null,
      alias,
      aliasType: mapAliasType(row.alias_type),
      isPrimary: row.is_primary === true
    };
    const currentAliases = aliasesByMemberId.get(memberId) ?? [];
    currentAliases.push(nextAlias);
    aliasesByMemberId.set(memberId, currentAliases);
  });

  const permissionsByMemberId = new Map<string, TeamPermission[]>();
  ((permissionsData ?? []) as RawPermissionRow[]).forEach((row) => {
    const memberId = typeof row.member_id === "string" ? row.member_id : null;
    const permission = typeof row.permission === "string" ? row.permission : null;

    if (!memberId || !permission || !memberIds.has(memberId)) {
      return;
    }

    const currentPermissions = permissionsByMemberId.get(memberId) ?? [];
    currentPermissions.push(permission as TeamPermission);
    permissionsByMemberId.set(memberId, currentPermissions);
  });

  const membershipRecords = members.map((row) => {
    const memberId = typeof row.id === "string" ? row.id : "";
    const role = normalizeTeamBusinessRole(row.team_role, row.role);
    const status =
      row.status === "inactive" || row.status === "invited" || row.status === "archived"
        ? row.status
        : "active";
    const seasonId = typeof row.season_id === "string" ? row.season_id : null;
    const link = linksByMemberId.get(memberId);
    const userId = typeof link?.user_id === "string" ? link.user_id : null;
    const playerId = typeof link?.player_id === "string" ? link.player_id : null;
    const userDisplay = userId ? userDisplayById.get(userId) : null;
    const playerDetails = playerId ? playerDetailsById.get(playerId) : null;

    return {
      memberId,
      name: typeof row.name === "string" ? row.name : "",
      role,
      status,
      seasonId,
      seasonName: seasonId ? (seasonNameById.get(seasonId) ?? null) : null,
      userId,
      userDisplayName: userDisplay?.displayName ?? null,
      userEmail: userDisplay?.email ?? null,
      primaryRole: userDisplay?.primaryRole ?? null,
      bowlingStyle: userDisplay?.bowlingStyle ?? null,
      batterPreference: userDisplay?.batterPreference ?? null,
      bowlerPreference: userDisplay?.bowlerPreference ?? null,
      cricHeroesName: userDisplay?.cricHeroesName ?? null,
      playerId,
      playerName: playerDetails?.name ?? null,
      battingStyle: userDisplay?.battingStyle ?? playerDetails?.battingStyle ?? null,
      isCaptain: playerDetails?.isCaptain ?? false,
      isWicketKeeper: playerDetails?.isWicketKeeper ?? false,
      roleTags: playerDetails?.roleTags ?? [],
      permissions: permissionsByMemberId.get(memberId) ?? [],
      aliases: (aliasesByMemberId.get(memberId) ?? []).sort((left, right) => {
        if (left.isPrimary !== right.isPrimary) {
          return left.isPrimary ? -1 : 1;
        }

        if (left.aliasType !== right.aliasType) {
          return left.aliasType.localeCompare(right.aliasType);
        }

        return left.alias.localeCompare(right.alias);
      })
    } satisfies TeamMembershipRecord;
  });

  return membershipRecords.sort((left, right) => left.name.localeCompare(right.name));
}

export async function getTeamMembershipUserOptions() {
  const access = await requireIdentityManagementAccess();

  if (!(await hasMembershipFoundationSupport())) {
    throw new Error("Membership foundation is not available in this environment yet.");
  }

  const [
    { data: usersData, error: usersError },
    { data: linksData, error: linksError }
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, username, first_name, last_name")
      .eq("team_id", access.teamId)
      .order("created_at", { ascending: true }),
    supabase
      .from("member_links")
      .select("member_id, user_id")
  ]);

  if (usersError) {
    throw new Error("Could not load team users.");
  }

  if (linksError) {
    throw new Error("Could not load member links.");
  }

  const linkedMemberIdByUserId = new Map<string, string>();
  ((linksData ?? []) as RawMemberLinkRow[]).forEach((row) => {
    const userId = typeof row.user_id === "string" ? row.user_id : null;
    const memberId = typeof row.member_id === "string" ? row.member_id : null;

    if (userId && memberId) {
      linkedMemberIdByUserId.set(userId, memberId);
    }
  });

  return ((usersData ?? []) as RawUserRow[])
    .map((row) => {
      const userId = typeof row.id === "string" ? row.id : null;

      if (!userId) {
        return null;
      }

      const email = normalizeNullableText(row.email);
      const username = normalizeNullableText(row.username);
      const firstName = normalizeNullableText(row.first_name);
      const lastName = normalizeNullableText(row.last_name);

      return {
        userId,
        displayName: buildUserDisplayName({
          email,
          username,
          firstName,
          lastName
        }) ?? email ?? userId,
        email,
        linkedMemberId: linkedMemberIdByUserId.get(userId) ?? null
      } satisfies TeamMembershipUserOption;
    })
    .filter((value): value is TeamMembershipUserOption => Boolean(value))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export async function updateTeamMembershipStatus(
  memberId: string,
  status: TeamMembershipStatus
) {
  const access = await requireMembershipManagementAccess();

  if (!(await hasMembershipFoundationSupport())) {
    throw new Error("Membership foundation is not available in this environment yet.");
  }

  if (!["active", "inactive", "invited", "archived"].includes(status)) {
    throw new Error("Invalid membership status.");
  }

  const { data, error } = await supabase
    .from("team_members")
    .update({ status })
    .eq("id", memberId)
    .eq("team_id", access.teamId)
    .select("id, status")
    .single();

  if (error || !data) {
    throw new Error("Could not update the membership status.");
  }

  return {
    memberId: typeof data.id === "string" ? data.id : memberId,
    status:
      data.status === "inactive" || data.status === "invited" || data.status === "archived"
        ? data.status
        : "active"
  } as const;
}

async function syncTeamMemberPermissions(
  teamId: string,
  memberId: string,
  role: TeamBusinessRole,
  grantedByUserId: string
) {
  const nextPermissions = getDefaultPermissionsForRole(role);

  const { error: deleteError } = await supabase
    .from("team_member_permissions")
    .delete()
    .eq("team_id", teamId)
    .eq("member_id", memberId);

  if (deleteError) {
    throw new Error("Could not reset the team member permissions.");
  }

  if (nextPermissions.length === 0) {
    return nextPermissions;
  }

  const { error: insertError } = await supabase
    .from("team_member_permissions")
    .insert(
      nextPermissions.map((permission) => ({
        team_id: teamId,
        member_id: memberId,
        permission,
        granted_by_user_id: grantedByUserId
      }))
    );

  if (insertError) {
    throw new Error("Could not assign the default permissions for the selected team role.");
  }

  return nextPermissions;
}

export async function updateTeamMembershipRole(
  memberId: string,
  role: TeamMembershipRole
) {
  const access = await requireOrganiserAccess();

  if (!(await hasMembershipFoundationSupport())) {
    throw new Error("Membership foundation is not available in this environment yet.");
  }

  if (!["organiser", "captain", "finance", "coordinator", "inventory_manager", "player"].includes(role)) {
    throw new Error("Invalid team member role.");
  }

  const { data: memberRow, error: memberError } = await supabase
    .from("team_members")
    .select("id, user_id")
    .eq("id", memberId)
    .eq("team_id", access.teamId)
    .maybeSingle();

  if (memberError || !memberRow) {
    throw new Error("Could not find the selected team member.");
  }

  const nextLegacyRole = mapBusinessRoleToLegacyMembershipRole(role);
  const nextUserRole = mapBusinessRoleToAppAuthRole(role);

  const { data, error } = await supabase
    .from("team_members")
    .update({
      role: nextLegacyRole,
      team_role: role,
      updated_at: new Date().toISOString()
    })
    .eq("id", memberId)
    .eq("team_id", access.teamId)
    .select("id, role, team_role")
    .single();

  if (error || !data) {
    throw new Error("Could not update the team member role.");
  }

  const userId = typeof memberRow.user_id === "string" ? memberRow.user_id : null;

  if (userId) {
    const { error: userRoleError } = await supabase
      .from("users")
      .update({
        role: nextUserRole,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId)
      .eq("team_id", access.teamId);

    if (userRoleError) {
      throw new Error("Could not update the linked user's app role.");
    }
  }

  const permissions = await syncTeamMemberPermissions(access.teamId, memberId, role, access.user.id);

  return {
    memberId: typeof data.id === "string" ? data.id : memberId,
    role: normalizeTeamBusinessRole(data.team_role, data.role),
    permissions
  } as const;
}

export async function updateTeamMembershipSeason(
  memberId: string,
  seasonId: string | null
) {
  const access = await requireMembershipManagementAccess();

  if (!(await hasMembershipFoundationSupport())) {
    throw new Error("Membership foundation is not available in this environment yet.");
  }

  if (seasonId) {
    const { data: seasonRow, error: seasonError } = await supabase
      .from("membership_seasons")
      .select("id")
      .eq("id", seasonId)
      .eq("team_id", access.teamId)
      .maybeSingle();

    if (seasonError || !seasonRow) {
      throw new Error("Could not find the selected membership season.");
    }
  }

  const { data, error } = await supabase
    .from("team_members")
    .update({ season_id: seasonId })
    .eq("id", memberId)
    .eq("team_id", access.teamId)
    .select("id, season_id")
    .single();

  if (error || !data) {
    throw new Error("Could not update the membership season.");
  }

  return {
    memberId: typeof data.id === "string" ? data.id : memberId,
    seasonId: typeof data.season_id === "string" ? data.season_id : null
  } as const;
}

export async function updateTeamMembershipLinkedUser(
  memberId: string,
  userId: string | null
) {
  const access = await requireIdentityManagementAccess();

  if (!(await hasMembershipFoundationSupport())) {
    throw new Error("Membership foundation is not available in this environment yet.");
  }

  const { data: memberRow, error: memberError } = await supabase
    .from("team_members")
    .select("id, team_id")
    .eq("id", memberId)
    .eq("team_id", access.teamId)
    .maybeSingle();

  if (memberError || !memberRow) {
    throw new Error("Could not find the selected team member.");
  }

  if (userId) {
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .eq("team_id", access.teamId)
      .maybeSingle();

    if (userError || !userRow) {
      throw new Error("Could not find the selected user.");
    }

    const { data: conflictingLink, error: conflictingLinkError } = await supabase
      .from("member_links")
      .select("member_id")
      .eq("user_id", userId)
      .neq("member_id", memberId)
      .maybeSingle();

    if (conflictingLinkError) {
      throw new Error("Could not validate the selected user mapping.");
    }

    if (conflictingLink?.member_id) {
      throw new Error("That user is already linked to another member.");
    }
  }

  const { data: existingLink, error: existingLinkError } = await supabase
    .from("member_links")
    .select("id")
    .eq("member_id", memberId)
    .maybeSingle();

  if (existingLinkError) {
    throw new Error("Could not load the current member link.");
  }

  if (existingLink?.id) {
    const { error: linkUpdateError } = await supabase
      .from("member_links")
      .update({ user_id: userId })
      .eq("id", existingLink.id);

    if (linkUpdateError) {
      throw new Error("Could not update the linked user.");
    }
  } else {
    const { error: linkInsertError } = await supabase
      .from("member_links")
      .insert({
        member_id: memberId,
        user_id: userId
      });

    if (linkInsertError) {
      throw new Error("Could not create the linked user record.");
    }
  }

  const { error: teamMemberUpdateError } = await supabase
    .from("team_members")
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("team_id", access.teamId);

  if (teamMemberUpdateError) {
    throw new Error("Could not update the team member user mapping.");
  }

  const userDisplay =
    userId
      ? (await getTeamMembershipUserOptions()).find((option) => option.userId === userId) ?? null
      : null;

  return {
    memberId,
    userId,
    userDisplayName: userDisplay?.displayName ?? null,
    userEmail: userDisplay?.email ?? null
  } as const;
}

export async function getTeamMembershipPlayerOptions() {
  const access = await requireIdentityManagementAccess();

  if (!(await hasMembershipFoundationSupport())) {
    throw new Error("Membership foundation is not available in this environment yet.");
  }

  const { data, error } = await supabase
    .from("players")
    .select("id, name, is_guest, member_id")
    .eq("team_id", access.teamId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Could not load team players.");
  }

  return ((data ?? []) as RawPlayerRow[])
    .map((row) => {
      const playerId = typeof row.id === "string" ? row.id : null;
      const playerName = normalizeNullableText(row.name);

      if (!playerId || !playerName) {
        return null;
      }

      return {
        playerId,
        displayName: formatName(playerName),
        isGuest: row.is_guest === true,
        linkedMemberId: typeof row.member_id === "string" ? row.member_id : null
      } satisfies TeamMembershipPlayerOption;
    })
    .filter((value): value is TeamMembershipPlayerOption => Boolean(value))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export async function updateTeamMembershipLinkedPlayer(
  memberId: string,
  playerId: string | null
) {
  const access = await requireIdentityManagementAccess();

  if (!(await hasMembershipFoundationSupport())) {
    throw new Error("Membership foundation is not available in this environment yet.");
  }

  const { data: memberRow, error: memberError } = await supabase
    .from("team_members")
    .select("id, user_id")
    .eq("id", memberId)
    .eq("team_id", access.teamId)
    .maybeSingle();

  if (memberError || !memberRow) {
    throw new Error("Could not find the selected team member.");
  }

  const { data: existingLink, error: existingLinkError } = await supabase
    .from("member_links")
    .select("id, player_id")
    .eq("member_id", memberId)
    .maybeSingle();

  if (existingLinkError) {
    throw new Error("Could not load the current member link.");
  }

  const currentPlayerId = typeof existingLink?.player_id === "string" ? existingLink.player_id : null;

  if (playerId) {
    const { data: playerRow, error: playerError } = await supabase
      .from("players")
      .select("id, name, member_id")
      .eq("id", playerId)
      .eq("team_id", access.teamId)
      .maybeSingle();

    if (playerError || !playerRow) {
      throw new Error("Could not find the selected player.");
    }

    if (typeof playerRow.member_id === "string" && playerRow.member_id !== memberId) {
      throw new Error("That player is already linked to another member.");
    }

    const { data: conflictingLink, error: conflictingLinkError } = await supabase
      .from("member_links")
      .select("member_id")
      .eq("player_id", playerId)
      .neq("member_id", memberId)
      .maybeSingle();

    if (conflictingLinkError) {
      throw new Error("Could not validate the selected player mapping.");
    }

    if (conflictingLink?.member_id) {
      throw new Error("That player is already linked to another member.");
    }
  }

  if (currentPlayerId && currentPlayerId !== playerId) {
    const { error: clearPreviousPlayerError } = await supabase
      .from("players")
      .update({ member_id: null })
      .eq("id", currentPlayerId)
      .eq("member_id", memberId);

    if (clearPreviousPlayerError) {
      throw new Error("Could not clear the previous linked player.");
    }
  }

  if (existingLink?.id) {
    const { error: linkUpdateError } = await supabase
      .from("member_links")
      .update({ player_id: playerId })
      .eq("id", existingLink.id);

    if (linkUpdateError) {
      throw new Error("Could not update the linked player.");
    }
  } else {
    const { error: linkInsertError } = await supabase
      .from("member_links")
      .insert({
        member_id: memberId,
        player_id: playerId
      });

    if (linkInsertError) {
      throw new Error("Could not create the linked player record.");
    }
  }

  if (playerId) {
    const { error: playerUpdateError } = await supabase
      .from("players")
      .update({ member_id: memberId })
      .eq("id", playerId)
      .eq("team_id", access.teamId);

    if (playerUpdateError) {
      throw new Error("Could not update the player membership link.");
    }
  }

  const { error: aliasPlayerSyncError } = await supabase
    .from("team_member_aliases")
    .update({ player_id: playerId })
    .eq("team_id", access.teamId)
    .eq("member_id", memberId);

  if (aliasPlayerSyncError) {
    throw new Error("Could not sync the external names with the linked player.");
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

  const playerDisplay =
    playerId
      ? (await getTeamMembershipPlayerOptions()).find((option) => option.playerId === playerId) ?? null
      : null;

  return {
    memberId,
    playerId,
    playerName: playerDisplay?.displayName ?? null
  } as const;
}

export async function createMembershipSeason(input: MembershipSeasonInput) {
  const access = await requireOrganiserAccess();

  if (!(await hasMembershipFoundationSupport())) {
    throw new Error("Membership foundation is not available in this environment yet.");
  }

  const name = input.name.trim();
  const startDate = input.startDate.trim();
  const endDate = input.endDate.trim();

  if (!name) {
    throw new Error("Season name is required.");
  }

  if (!startDate || !endDate) {
    throw new Error("Season start and end dates are required.");
  }

  if (startDate > endDate) {
    throw new Error("Season start date must be before or equal to the end date.");
  }

  if (input.isActive) {
    const { error: clearActiveError } = await supabase
      .from("membership_seasons")
      .update({ is_active: false })
      .eq("team_id", access.teamId)
      .eq("is_active", true);

    if (clearActiveError) {
      throw new Error("Could not prepare the active season update.");
    }
  }

  const { data, error } = await supabase
    .from("membership_seasons")
    .insert({
      team_id: access.teamId,
      name,
      start_date: startDate,
      end_date: endDate,
      is_active: input.isActive
    })
    .select("id, name, start_date, end_date, is_active")
    .single();

  if (error || !data) {
    throw new Error(
      error?.code === "23505"
        ? "That season already exists for this team."
        : "Could not create the membership season."
    );
  }

  return mapSeasonRow(data as RawSeasonRow);
}

export async function createTeamMemberAlias(
  memberId: string,
  alias: string,
  aliasType: TeamMemberAliasType = "scorecard"
) {
  const access = await requireIdentityManagementAccess();

  if (!(await hasMembershipFoundationSupport())) {
    throw new Error("Membership foundation is not available in this environment yet.");
  }

  const normalizedAlias = normalizeAlias(alias);

  if (!normalizedAlias) {
    throw new Error("Alias name is required.");
  }

  const { data: memberRow, error: memberError } = await supabase
    .from("team_members")
    .select("id, name")
    .eq("id", memberId)
    .eq("team_id", access.teamId)
    .maybeSingle();

  if (memberError || !memberRow) {
    throw new Error("Could not find the selected team member.");
  }

  const primaryMemberName = normalizeNullableText(memberRow.name);
  const resolvedPlayerId = await getResolvedLinkedPlayerId(access.teamId, memberId);

  if (primaryMemberName && normalizeAliasKey(primaryMemberName) === normalizeAliasKey(normalizedAlias)) {
    throw new Error("That name is already the member's primary name. Add only a different external name.");
  }

  if (!resolvedPlayerId) {
    throw new Error("Link a player before setting an external name.");
  }

  const { count: existingExternalNameCount, error: existingAliasError } = await supabase
    .from("team_member_aliases")
    .select("id", { count: "exact", head: true })
    .eq("team_id", access.teamId)
    .eq("player_id", resolvedPlayerId)
    .eq("is_primary", false);

  if (existingAliasError) {
    throw new Error("Could not validate the external name limit.");
  }

  if ((existingExternalNameCount ?? 0) >= 1) {
    throw new Error("Only one external name can be added for each member.");
  }

  const { data, error } = await supabase
    .from("team_member_aliases")
    .insert({
      team_id: access.teamId,
      member_id: memberId,
      player_id: resolvedPlayerId,
      alias: normalizedAlias,
      normalized_alias: normalizeAliasKey(normalizedAlias),
      alias_type: aliasType,
      is_primary: false
    })
    .select("id, member_id, player_id, alias, alias_type, is_primary")
    .single();

  if (error || !data) {
    throw new Error(
      error?.code === "23505"
        ? "That external name already exists for this team."
        : "Could not create the alias."
    );
  }

  return {
    memberId: typeof data.member_id === "string" ? data.member_id : memberId,
    alias: {
      aliasId: typeof data.id === "string" ? data.id : "",
      playerId: typeof data.player_id === "string" ? data.player_id : resolvedPlayerId,
      alias: typeof data.alias === "string" ? data.alias : normalizedAlias,
      aliasType: mapAliasType(data.alias_type),
      isPrimary: data.is_primary === true
    } satisfies TeamMemberAliasRecord
  } as const;
}

export async function updateTeamMemberAlias(
  aliasId: string,
  alias: string
) {
  const access = await requireIdentityManagementAccess();

  if (!(await hasMembershipFoundationSupport())) {
    throw new Error("Membership foundation is not available in this environment yet.");
  }

  const normalizedAlias = normalizeAlias(alias);

  if (!normalizedAlias) {
    throw new Error("Alias name is required.");
  }

  const { data: aliasRow, error: aliasError } = await supabase
    .from("team_member_aliases")
    .select("id, member_id, player_id, alias_type, is_primary")
    .eq("id", aliasId)
    .eq("team_id", access.teamId)
    .maybeSingle();

  if (aliasError || !aliasRow || typeof aliasRow.member_id !== "string") {
    throw new Error("Could not find the selected alias.");
  }

  if (aliasRow.is_primary === true) {
    throw new Error("Primary aliases cannot be updated here.");
  }

  const { data: memberRow, error: memberError } = await supabase
    .from("team_members")
    .select("id, name")
    .eq("id", aliasRow.member_id)
    .eq("team_id", access.teamId)
    .maybeSingle();

  if (memberError || !memberRow) {
    throw new Error("Could not find the selected team member.");
  }

  const primaryMemberName = normalizeNullableText(memberRow.name);
  const resolvedPlayerId =
    typeof aliasRow.player_id === "string"
      ? aliasRow.player_id
      : await getResolvedLinkedPlayerId(access.teamId, aliasRow.member_id);

  if (primaryMemberName && normalizeAliasKey(primaryMemberName) === normalizeAliasKey(normalizedAlias)) {
    throw new Error("That name is already the member's primary name. Reset the external name instead.");
  }

  if (!resolvedPlayerId) {
    throw new Error("Link a player before setting an external name.");
  }

  const { data, error } = await supabase
    .from("team_member_aliases")
    .update({
      player_id: resolvedPlayerId,
      alias: normalizedAlias,
      normalized_alias: normalizeAliasKey(normalizedAlias)
    })
    .eq("id", aliasId)
    .eq("team_id", access.teamId)
    .select("id, member_id, player_id, alias, alias_type, is_primary")
    .single();

  if (error || !data) {
    throw new Error(
      error?.code === "23505"
        ? "That external name already exists for this team."
        : "Could not update the alias."
    );
  }

  return {
    memberId: typeof data.member_id === "string" ? data.member_id : aliasRow.member_id,
    alias: {
      aliasId: typeof data.id === "string" ? data.id : aliasId,
      playerId: typeof data.player_id === "string" ? data.player_id : resolvedPlayerId,
      alias: typeof data.alias === "string" ? data.alias : normalizedAlias,
      aliasType: mapAliasType(data.alias_type),
      isPrimary: data.is_primary === true
    } satisfies TeamMemberAliasRecord
  } as const;
}

export async function deleteTeamMemberAlias(aliasId: string) {
  const access = await requireIdentityManagementAccess();

  if (!(await hasMembershipFoundationSupport())) {
    throw new Error("Membership foundation is not available in this environment yet.");
  }

  const { data: aliasRow, error: aliasError } = await supabase
    .from("team_member_aliases")
    .select("id, member_id, player_id, is_primary")
    .eq("id", aliasId)
    .eq("team_id", access.teamId)
    .maybeSingle();

  if (aliasError || !aliasRow) {
    throw new Error("Could not find the selected alias.");
  }

  if (aliasRow.is_primary === true) {
    throw new Error("Primary aliases cannot be deleted.");
  }

  const { error } = await supabase
    .from("team_member_aliases")
    .delete()
    .eq("id", aliasId)
    .eq("team_id", access.teamId);

  if (error) {
    throw new Error("Could not delete the alias.");
  }

  return {
    aliasId,
    memberId: typeof aliasRow.member_id === "string" ? aliasRow.member_id : null,
    playerId: typeof aliasRow.player_id === "string" ? aliasRow.player_id : null
  } as const;
}
