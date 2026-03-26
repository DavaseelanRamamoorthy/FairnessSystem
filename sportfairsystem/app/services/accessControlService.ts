import { supabase } from "@/app/services/supabaseClient";
import {
  normalizeTeamBusinessRole,
  TeamBusinessRole,
  TeamPermission
} from "@/app/services/teamRoles";
import type { User } from "@supabase/supabase-js";

type CurrentUserAccess = {
  user: User;
  role: "admin" | "member";
  teamId: string | null;
};

type CurrentTeamMembershipAccess = CurrentUserAccess & {
  memberId: string | null;
  legacyMembershipRole: "admin" | "captain" | "player" | null;
  teamRole: TeamBusinessRole | null;
  permissions: TeamPermission[];
};

export type WorkspaceAccessSnapshot = {
  canAccessMemberships: boolean;
  canAccessPlanner: boolean;
  canAccessAnalytics: boolean;
  canAccessValidation: boolean;
  canManageMatches: boolean;
  canSeeFairness: boolean;
};

type CachedValue<T> = {
  value: T;
  expiresAt: number;
};

const ACCESS_CACHE_TTL_MS = 1500;

let currentUserAccessPromise: Promise<CurrentUserAccess> | null = null;
let currentUserAccessCache: CachedValue<CurrentUserAccess> | null = null;
let currentTeamMembershipAccessPromise: Promise<CurrentTeamMembershipAccess> | null = null;
let currentTeamMembershipAccessCache: CachedValue<CurrentTeamMembershipAccess> | null = null;

function getCachedValue<T>(cache: CachedValue<T> | null) {
  if (!cache || cache.expiresAt <= Date.now()) {
    return null;
  }

  return cache.value;
}

function setCachedValue<T>(value: T): CachedValue<T> {
  return {
    value,
    expiresAt: Date.now() + ACCESS_CACHE_TTL_MS
  };
}

export function clearAccessControlCache() {
  currentUserAccessPromise = null;
  currentUserAccessCache = null;
  currentTeamMembershipAccessPromise = null;
  currentTeamMembershipAccessCache = null;
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange(() => {
    clearAccessControlCache();
  });
}

function buildWorkspaceAccessSnapshot(access: CurrentTeamMembershipAccess): WorkspaceAccessSnapshot {
  if (!access.teamId || !access.memberId) {
    return {
      canAccessMemberships: false,
      canAccessPlanner: false,
      canAccessAnalytics: false,
      canAccessValidation: false,
      canManageMatches: false,
      canSeeFairness: false
    };
  }

  const canAccessMemberships =
    access.teamRole === "organiser"
    || access.teamRole === "captain"
    || access.permissions.includes("members_manage")
    || access.permissions.includes("invites_manage")
    || access.permissions.includes("identity_manage");

  const canAccessPlanner =
    access.teamRole === "organiser"
    || access.permissions.includes("planner_manage");

  const canAccessAnalytics =
    access.teamRole === "organiser"
    || access.teamRole === "captain"
    || access.legacyMembershipRole === "captain"
    || access.permissions.includes("stats_manage");

  const canAccessValidation =
    access.teamRole === "organiser"
    || access.teamRole === "captain"
    || access.legacyMembershipRole === "captain"
    || access.permissions.includes("stats_manage")
    || access.permissions.includes("identity_manage");

  const canManageMatches =
    access.teamRole === "organiser"
    || access.permissions.includes("stats_manage");

  const canSeeFairness =
    access.teamRole === "organiser"
    || access.teamRole === "captain"
    || access.legacyMembershipRole === "captain"
    || access.permissions.includes("planner_manage");

  return {
    canAccessMemberships,
    canAccessPlanner,
    canAccessAnalytics,
    canAccessValidation,
    canManageMatches,
    canSeeFairness
  };
}

export async function requireAuthenticatedUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("You must be signed in to perform this action.");
  }

  return user;
}

export async function getCurrentUserAccess() {
  const cachedAccess = getCachedValue(currentUserAccessCache);

  if (cachedAccess) {
    return cachedAccess;
  }

  if (currentUserAccessPromise) {
    return currentUserAccessPromise;
  }

  currentUserAccessPromise = (async () => {
    const user = await requireAuthenticatedUser();

    const { data, error } = await supabase
      .from("users")
      .select("role, team_id")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      throw new Error(
        "Your user access profile is not ready yet."
      );
    }

    const access: CurrentUserAccess = {
      user,
      role: data.role === "admin" ? "admin" : "member",
      teamId: data.team_id
    };

    currentUserAccessCache = setCachedValue(access);
    return access;
  })();

  try {
    return await currentUserAccessPromise;
  } finally {
    currentUserAccessPromise = null;
  }
}

export async function requireAdminAccess() {
  const access = await getCurrentUserAccess();

  if (access.role !== "admin") {
    throw new Error("Admin access is required to perform this action.");
  }

  if (!access.teamId) {
    throw new Error("Your admin account is not mapped to a team yet.");
  }

  return access;
}

export async function getCurrentTeamMembershipAccess() {
  const cachedAccess = getCachedValue(currentTeamMembershipAccessCache);

  if (cachedAccess) {
    return cachedAccess;
  }

  if (currentTeamMembershipAccessPromise) {
    return currentTeamMembershipAccessPromise;
  }

  currentTeamMembershipAccessPromise = (async () => {
    const access = await getCurrentUserAccess();

    if (!access.teamId) {
      const nextAccess: CurrentTeamMembershipAccess = {
        ...access,
        memberId: null,
        legacyMembershipRole: null,
        teamRole: null,
        permissions: []
      };

      currentTeamMembershipAccessCache = setCachedValue(nextAccess);
      return nextAccess;
    }

    const { data: memberRow, error: memberError } = await supabase
      .from("team_members")
      .select("id, team_role, role")
      .eq("team_id", access.teamId)
      .eq("user_id", access.user.id)
      .maybeSingle();

    if (memberError || !memberRow || typeof memberRow.id !== "string") {
      const nextAccess: CurrentTeamMembershipAccess = {
        ...access,
        memberId: null,
        legacyMembershipRole: null,
        teamRole: null,
        permissions: []
      };

      currentTeamMembershipAccessCache = setCachedValue(nextAccess);
      return nextAccess;
    }

    const { data: permissionRows, error: permissionsError } = await supabase
      .from("team_member_permissions")
      .select("permission")
      .eq("team_id", access.teamId)
      .eq("member_id", memberRow.id);

    if (permissionsError) {
      throw new Error("Could not load team member permissions.");
    }

    const permissions = (permissionRows ?? [])
      .map((row) => (typeof row.permission === "string" ? row.permission : null))
      .filter((value): value is TeamPermission => Boolean(value));

    const nextAccess: CurrentTeamMembershipAccess = {
      ...access,
      memberId: memberRow.id,
      legacyMembershipRole: memberRow.role === "admin" || memberRow.role === "captain" ? memberRow.role : "player",
      teamRole: normalizeTeamBusinessRole(memberRow.team_role, memberRow.role),
      permissions
    };

    currentTeamMembershipAccessCache = setCachedValue(nextAccess);
    return nextAccess;
  })();

  try {
    return await currentTeamMembershipAccessPromise;
  } finally {
    currentTeamMembershipAccessPromise = null;
  }
}

export async function getCurrentWorkspaceAccessSnapshot() {
  const access = await getCurrentTeamMembershipAccess();
  return buildWorkspaceAccessSnapshot(access);
}

export async function canAccessMembershipWorkspace() {
  const snapshot = await getCurrentWorkspaceAccessSnapshot();
  return snapshot.canAccessMemberships;
}

export async function requireMembershipWorkspaceAccess() {
  const access = await getCurrentTeamMembershipAccess();

  const canAccess =
    Boolean(access.teamId && access.memberId)
    && (
      access.teamRole === "organiser"
      || access.teamRole === "captain"
      || access.permissions.includes("members_manage")
      || access.permissions.includes("invites_manage")
      || access.permissions.includes("identity_manage")
    );

  if (!canAccess) {
    throw new Error("You do not have permission to access the membership workspace.");
  }

  return access;
}

export async function canManageMembershipRecords() {
  const access = await getCurrentTeamMembershipAccess();

  if (!access.teamId || !access.memberId) {
    return false;
  }

  if (access.teamRole === "organiser") {
    return true;
  }

  return access.permissions.includes("members_manage");
}

export async function requireMembershipManagementAccess() {
  const access = await getCurrentTeamMembershipAccess();

  const canAccess =
    Boolean(access.teamId && access.memberId)
    && (
      access.teamRole === "organiser"
      || access.permissions.includes("members_manage")
    );

  if (!canAccess) {
    throw new Error("You do not have permission to change team membership records.");
  }

  return access;
}

export async function canManageMembershipRoles() {
  const access = await getCurrentTeamMembershipAccess();

  if (!access.teamId || !access.memberId) {
    return false;
  }

  return (
    access.teamRole === "organiser"
    || access.permissions.includes("team_settings_manage")
  );
}

export async function canManageRosterPlayers() {
  const access = await getCurrentTeamMembershipAccess();

  if (!access.teamId || !access.memberId) {
    return false;
  }

  return (
    access.teamRole === "organiser"
    || access.permissions.includes("team_settings_manage")
  );
}

export async function requireOrganiserAccess() {
  const access = await getCurrentTeamMembershipAccess();

  const canAccess =
    Boolean(access.teamId && access.memberId)
    && (
      access.teamRole === "organiser"
      || access.permissions.includes("team_settings_manage")
    );

  if (!canAccess) {
    throw new Error("Only the organiser can perform this action.");
  }

  return access;
}

export async function canAccessFairnessWorkspace() {
  const snapshot = await getCurrentWorkspaceAccessSnapshot();
  return snapshot.canSeeFairness;
}

export async function requireFairnessWorkspaceAccess() {
  const access = await getCurrentTeamMembershipAccess();

  const canAccess =
    Boolean(access.teamId && access.memberId)
    && (
      access.teamRole === "organiser"
      || access.teamRole === "captain"
      || access.legacyMembershipRole === "captain"
      || access.permissions.includes("planner_manage")
    );

  if (!canAccess) {
    throw new Error("Only the organiser or captain can access the fairness workspace.");
  }

  return access;
}

export async function canAccessPlannerWorkspace() {
  const snapshot = await getCurrentWorkspaceAccessSnapshot();
  return snapshot.canAccessPlanner;
}

export async function requirePlannerWorkspaceAccess() {
  const access = await getCurrentTeamMembershipAccess();

  const canAccess =
    Boolean(access.teamId && access.memberId)
    && (
      access.teamRole === "organiser"
      || access.permissions.includes("planner_manage")
    );

  if (!canAccess) {
    throw new Error("You do not have permission to access the planner workspace.");
  }

  return access;
}

export async function canAccessAnalyticsWorkspace() {
  const snapshot = await getCurrentWorkspaceAccessSnapshot();
  return snapshot.canAccessAnalytics;
}

export async function requireAnalyticsWorkspaceAccess() {
  const access = await getCurrentTeamMembershipAccess();

  const canAccess =
    Boolean(access.teamId && access.memberId)
    && (
      access.teamRole === "organiser"
      || access.teamRole === "captain"
      || access.legacyMembershipRole === "captain"
      || access.permissions.includes("stats_manage")
    );

  if (!canAccess) {
    throw new Error("You do not have permission to access analytics.");
  }

  return access;
}

export async function canAccessValidationWorkspace() {
  const snapshot = await getCurrentWorkspaceAccessSnapshot();
  return snapshot.canAccessValidation;
}

export async function requireValidationWorkspaceAccess() {
  const access = await getCurrentTeamMembershipAccess();

  const canAccess =
    Boolean(access.teamId && access.memberId)
    && (
      access.teamRole === "organiser"
      || access.teamRole === "captain"
      || access.legacyMembershipRole === "captain"
      || access.permissions.includes("stats_manage")
      || access.permissions.includes("identity_manage")
    );

  if (!canAccess) {
    throw new Error("You do not have permission to access validation.");
  }

  return access;
}

export async function canManageValidationWorkspace() {
  const access = await getCurrentTeamMembershipAccess();

  if (!access.teamId || !access.memberId) {
    return false;
  }

  if (access.teamRole === "organiser") {
    return true;
  }

  return (
    access.permissions.includes("stats_manage")
    || access.permissions.includes("identity_manage")
  );
}

export async function requireValidationManagementAccess() {
  const access = await getCurrentTeamMembershipAccess();

  const canAccess =
    Boolean(access.teamId && access.memberId)
    && (
      access.teamRole === "organiser"
      || access.permissions.includes("stats_manage")
      || access.permissions.includes("identity_manage")
    );

  if (!canAccess) {
    throw new Error("You do not have permission to change validation-related data.");
  }

  return access;
}

export async function canManageMatchData() {
  const snapshot = await getCurrentWorkspaceAccessSnapshot();
  return snapshot.canManageMatches;
}

export async function requireMatchDataManagementAccess() {
  const access = await getCurrentTeamMembershipAccess();

  const canAccess =
    Boolean(access.teamId && access.memberId)
    && (
      access.teamRole === "organiser"
      || access.permissions.includes("stats_manage")
    );

  if (!canAccess) {
    throw new Error("You do not have permission to manage match data.");
  }

  return access;
}

export async function canManageTeamInvites() {
  const access = await getCurrentTeamMembershipAccess();

  if (!access.teamId || !access.memberId) {
    return false;
  }

  if (access.teamRole === "organiser") {
    return true;
  }

  return access.permissions.includes("invites_manage");
}

export async function requireInviteManagementAccess() {
  const access = await getCurrentTeamMembershipAccess();

  const canAccess =
    Boolean(access.teamId && access.memberId)
    && (
      access.teamRole === "organiser"
      || access.permissions.includes("invites_manage")
    );

  if (!canAccess) {
    throw new Error("You do not have permission to manage team invites.");
  }

  return access;
}

export async function canManageIdentityWorkspace() {
  const access = await getCurrentTeamMembershipAccess();

  if (!access.teamId || !access.memberId) {
    return false;
  }

  if (access.teamRole === "organiser") {
    return true;
  }

  return access.permissions.includes("identity_manage");
}

export async function requireIdentityManagementAccess() {
  const access = await getCurrentTeamMembershipAccess();

  const canAccess =
    Boolean(access.teamId && access.memberId)
    && (
      access.teamRole === "organiser"
      || access.permissions.includes("identity_manage")
    );

  if (!canAccess) {
    throw new Error("You do not have permission to manage player identity and membership mapping.");
  }

  return access;
}

export async function hasCurrentTeamPermission(permission: TeamPermission) {
  const access = await getCurrentTeamMembershipAccess();
  return access.permissions.includes(permission);
}

export async function requireCurrentTeamPermission(permission: TeamPermission) {
  const access = await getCurrentTeamMembershipAccess();

  if (!access.permissions.includes(permission)) {
    throw new Error("You do not have permission to perform this action.");
  }

  return access;
}
