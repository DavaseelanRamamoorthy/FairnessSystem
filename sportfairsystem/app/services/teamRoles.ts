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

export type TeamBusinessRole =
  | "organiser"
  | "captain"
  | "finance"
  | "coordinator"
  | "inventory_manager"
  | "player";

export type LegacyTeamMembershipRole = "admin" | "captain" | "player";
export type AppAuthRole = "admin" | "member";

export const TEAM_BUSINESS_ROLE_OPTIONS: Array<{
  value: TeamBusinessRole;
  label: string;
  helper: string;
}> = [
  {
    value: "organiser",
    label: "Organiser",
    helper: "Full team ownership and CRUD across the workspace."
  },
  {
    value: "captain",
    label: "Captain",
    helper: "Full visibility across the app without broad edit access by default."
  },
  {
    value: "finance",
    label: "Finance",
    helper: "Reserved for finance workflows and finance-specific permissions."
  },
  {
    value: "coordinator",
    label: "Coordinator",
    helper: "Operational coordination for members, invites, and planning support."
  },
  {
    value: "inventory_manager",
    label: "Inventory",
    helper: "Reserved for inventory management workflows."
  },
  {
    value: "player",
    label: "Player",
    helper: "Base team member role without elevated workspace access."
  }
];

const TEAM_BUSINESS_ROLE_SET = new Set<TeamBusinessRole>(
  TEAM_BUSINESS_ROLE_OPTIONS.map((option) => option.value)
);

export function isTeamBusinessRole(value: unknown): value is TeamBusinessRole {
  return typeof value === "string" && TEAM_BUSINESS_ROLE_SET.has(value as TeamBusinessRole);
}

export function normalizeTeamBusinessRole(
  teamRole: unknown,
  legacyRole?: unknown
): TeamBusinessRole {
  if (teamRole === "coordinator" && legacyRole === "captain") {
    return "captain";
  }

  if (teamRole === "financer") {
    return "finance";
  }

  if (teamRole === "member") {
    return "player";
  }

  if (isTeamBusinessRole(teamRole)) {
    return teamRole;
  }

  if (legacyRole === "admin") {
    return "organiser";
  }

  if (legacyRole === "captain") {
    return "captain";
  }

  return "player";
}

export function mapBusinessRoleToLegacyMembershipRole(role: TeamBusinessRole): LegacyTeamMembershipRole {
  if (role === "organiser") {
    return "admin";
  }

  if (role === "captain") {
    return "captain";
  }

  return "player";
}

export function mapBusinessRoleToAppAuthRole(role: TeamBusinessRole): AppAuthRole {
  return role === "organiser" ? "admin" : "member";
}

export function getDefaultPermissionsForRole(role: TeamBusinessRole): TeamPermission[] {
  switch (role) {
    case "organiser":
      return [
        "team_settings_manage",
        "members_manage",
        "invites_manage",
        "identity_manage",
        "attendance_manage",
        "planner_manage",
        "stats_manage",
        "finance_manage",
        "inventory_manage",
        "events_manage"
      ];
    case "coordinator":
      return [
        "members_manage",
        "invites_manage",
        "attendance_manage",
        "planner_manage"
      ];
    case "finance":
      return ["finance_manage"];
    case "inventory_manager":
      return ["inventory_manage"];
    case "captain":
    case "player":
    default:
      return [];
  }
}

export function getTeamBusinessRoleLabel(role: TeamBusinessRole) {
  return TEAM_BUSINESS_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? "Player";
}
