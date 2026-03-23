import { supabase } from "@/app/services/supabaseClient";

export type TeamPermission =
  | "team_settings_manage"
  | "members_manage"
  | "invites_manage"
  | "identity_manage"
  | "attendance_manage"
  | "planner_manage"
  | "stats_manage"
  | "finance_manage"
  | "inventory_manage"
  | "events_manage";

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

  return {
    user,
    role: data.role === "admin" ? "admin" : "member",
    teamId: data.team_id
  } as const;
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
  const access = await getCurrentUserAccess();

  if (!access.teamId) {
    return {
      ...access,
      memberId: null,
      teamRole: null,
      permissions: [] as TeamPermission[]
    } as const;
  }

  const { data: memberRow, error: memberError } = await supabase
    .from("team_members")
    .select("id, team_role")
    .eq("team_id", access.teamId)
    .eq("user_id", access.user.id)
    .maybeSingle();

  if (memberError || !memberRow || typeof memberRow.id !== "string") {
    return {
      ...access,
      memberId: null,
      teamRole: null,
      permissions: [] as TeamPermission[]
    } as const;
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

  return {
    ...access,
    memberId: memberRow.id,
    teamRole: typeof memberRow.team_role === "string" ? memberRow.team_role : null,
    permissions
  } as const;
}

export async function canAccessFairnessWorkspace() {
  const access = await getCurrentTeamMembershipAccess();

  if (!access.teamId || !access.memberId) {
    return false;
  }

  if (access.teamRole === "organiser" || access.teamRole === "coordinator") {
    return true;
  }

  return access.permissions.includes("planner_manage");
}

export async function requireFairnessWorkspaceAccess() {
  const access = await getCurrentTeamMembershipAccess();

  const canAccess =
    Boolean(access.teamId && access.memberId)
    && (
      access.teamRole === "organiser"
      || access.teamRole === "coordinator"
      || access.permissions.includes("planner_manage")
    );

  if (!canAccess) {
    throw new Error("Only the organiser or captain can access the fairness workspace.");
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
