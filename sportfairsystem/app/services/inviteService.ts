import {
  requireInviteManagementAccess
} from "@/app/services/accessControlService";
import { normalizeAuthEmail, validateAuthEmail } from "@/app/services/authValidation";
import { supabase } from "@/app/services/supabaseClient";

export type TeamInviteType = "existing_member" | "new_member";
export type TeamInviteStatus = "pending" | "accepted" | "expired" | "cancelled";
export type TeamInviteRole = "admin" | "captain" | "player";

export type TeamInviteRecord = {
  inviteId: string;
  teamId: string;
  email: string;
  inviteType: TeamInviteType;
  memberId: string | null;
  inviteName: string;
  seasonId: string | null;
  invitedRole: TeamInviteRole;
  status: TeamInviteStatus;
  tokenExpiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InviteAcceptanceResult = {
  inviteId: string;
  teamId: string;
  memberId: string;
  inviteType: TeamInviteType;
  createdMember: boolean;
};

type RawTeamInviteRow = {
  id?: unknown;
  team_id?: unknown;
  email?: unknown;
  invite_type?: unknown;
  member_id?: unknown;
  invite_name?: unknown;
  season_id?: unknown;
  invited_role?: unknown;
  status?: unknown;
  token_expires_at?: unknown;
  accepted_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type InsertTeamInviteValues = {
  team_id: string;
  email: string;
  invite_type: TeamInviteType;
  member_id: string | null;
  invite_name: string;
  season_id: string | null;
  invited_role: TeamInviteRole;
  status: TeamInviteStatus;
  token_expires_at: string;
  invited_by_user_id: string;
};

type CreateExistingMemberInviteInput = {
  memberId: string;
  email: string;
  expiresInDays?: number;
};

type CreateNewMemberInviteInput = {
  inviteName: string;
  email: string;
  seasonId: string | null;
  invitedRole?: TeamInviteRole;
  expiresInDays?: number;
};

function normalizeNullableText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTeamInviteRole(value: unknown): TeamInviteRole {
  return value === "admin" || value === "captain" ? value : "player";
}

function normalizeTeamInviteStatus(value: unknown): TeamInviteStatus {
  return value === "accepted" || value === "expired" || value === "cancelled"
    ? value
    : "pending";
}

function normalizeTeamInviteType(value: unknown): TeamInviteType {
  return value === "new_member" ? "new_member" : "existing_member";
}

function mapTeamInviteRow(row: RawTeamInviteRow): TeamInviteRecord {
  return {
    inviteId: typeof row.id === "string" ? row.id : "",
    teamId: typeof row.team_id === "string" ? row.team_id : "",
    email: typeof row.email === "string" ? row.email : "",
    inviteType: normalizeTeamInviteType(row.invite_type),
    memberId: typeof row.member_id === "string" ? row.member_id : null,
    inviteName: typeof row.invite_name === "string" ? row.invite_name : "",
    seasonId: typeof row.season_id === "string" ? row.season_id : null,
    invitedRole: normalizeTeamInviteRole(row.invited_role),
    status: normalizeTeamInviteStatus(row.status),
    tokenExpiresAt: typeof row.token_expires_at === "string" ? row.token_expires_at : "",
    acceptedAt: typeof row.accepted_at === "string" ? row.accepted_at : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : ""
  };
}

function buildInviteExpiryIso(expiresInDays = 14) {
  const safeDays = Number.isFinite(expiresInDays) && expiresInDays > 0
    ? Math.min(30, Math.floor(expiresInDays))
    : 14;
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + safeDays);
  return nextDate.toISOString();
}

function buildInviteToken() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("Secure invite token generation is not available in this environment.");
  }

  return `${globalThis.crypto.randomUUID().replace(/-/g, "")}${globalThis.crypto.randomUUID().replace(/-/g, "")}`;
}

async function hashInviteToken(token: string) {
  const encoder = new TextEncoder();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function buildInviteShareUrl(rawToken: string) {
  if (typeof window === "undefined") {
    return `/accept-invite?token=${encodeURIComponent(rawToken)}`;
  }

  return `${window.location.origin}/accept-invite?token=${encodeURIComponent(rawToken)}`;
}

async function createTeamInviteRecord(
  values: InsertTeamInviteValues,
  rawToken: string
) {
  const tokenHash = await hashInviteToken(rawToken);
  const { data, error } = await supabase
    .from("team_invites")
    .insert({
      ...values,
      token_hash: tokenHash
    })
    .select("id, team_id, email, invite_type, member_id, invite_name, season_id, invited_role, status, token_expires_at, accepted_at, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(
      error?.code === "23505"
        ? "A pending invite already exists for that email or member."
        : "Could not create the invite."
    );
  }

  return {
    invite: mapTeamInviteRow(data as RawTeamInviteRow),
    rawToken,
    inviteUrl: buildInviteShareUrl(rawToken)
  } as const;
}

export async function listTeamInvites() {
  const access = await requireInviteManagementAccess();

  const { data, error } = await supabase
    .from("team_invites")
    .select("id, team_id, email, invite_type, member_id, invite_name, season_id, invited_role, status, token_expires_at, accepted_at, created_at, updated_at")
    .eq("team_id", access.teamId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Could not load team invites.");
  }

  return ((data ?? []) as RawTeamInviteRow[]).map((row) => mapTeamInviteRow(row));
}

export async function createExistingMemberInvite({
  memberId,
  email,
  expiresInDays = 14
}: CreateExistingMemberInviteInput) {
  const access = await requireInviteManagementAccess();
  const normalizedEmail = normalizeAuthEmail(email);
  const emailError = validateAuthEmail(normalizedEmail);

  if (emailError) {
    throw new Error(emailError);
  }

  const { data: memberRow, error: memberError } = await supabase
    .from("team_members")
    .select("id, name, status, season_id, user_id")
    .eq("id", memberId)
    .eq("team_id", access.teamId)
    .maybeSingle();

  if (memberError || !memberRow) {
    throw new Error("Could not find the selected member.");
  }

  if (typeof memberRow.user_id === "string") {
    throw new Error("That member is already claimed by a user account.");
  }

  const rawToken = buildInviteToken();

  return createTeamInviteRecord({
    team_id: access.teamId,
    email: normalizedEmail,
    invite_type: "existing_member",
    member_id: memberId,
    invite_name: normalizeNullableText(memberRow.name) ?? normalizedEmail,
    season_id: typeof memberRow.season_id === "string" ? memberRow.season_id : null,
    invited_role: "player",
    status: "pending",
    token_expires_at: buildInviteExpiryIso(expiresInDays),
    invited_by_user_id: access.user.id
  }, rawToken);
}

export async function createNewMemberInvite({
  inviteName,
  email,
  seasonId,
  invitedRole = "player",
  expiresInDays = 14
}: CreateNewMemberInviteInput) {
  const access = await requireInviteManagementAccess();
  const normalizedEmail = normalizeAuthEmail(email);
  const normalizedName = inviteName.trim().replace(/\s+/g, " ");
  const emailError = validateAuthEmail(normalizedEmail);

  if (emailError) {
    throw new Error(emailError);
  }

  if (!normalizedName) {
    throw new Error("Member name is required.");
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

  const rawToken = buildInviteToken();

  return createTeamInviteRecord({
    team_id: access.teamId,
    email: normalizedEmail,
    invite_type: "new_member",
    member_id: null,
    invite_name: normalizedName,
    season_id: seasonId,
    invited_role: invitedRole,
    status: "pending",
    token_expires_at: buildInviteExpiryIso(expiresInDays),
    invited_by_user_id: access.user.id
  }, rawToken);
}

export async function cancelTeamInvite(inviteId: string) {
  const access = await requireInviteManagementAccess();

  const { data, error } = await supabase
    .from("team_invites")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString()
    })
    .eq("id", inviteId)
    .eq("team_id", access.teamId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Could not cancel the invite.");
  }

  return {
    inviteId: typeof data.id === "string" ? data.id : inviteId
  } as const;
}

export async function getInvitePreviewByToken(rawToken: string) {
  const normalizedToken = rawToken.trim();

  if (!normalizedToken) {
    throw new Error("Invite token is required.");
  }

  const tokenHash = await hashInviteToken(normalizedToken);
  const { data, error } = await supabase
    .from("team_invites")
    .select("id, team_id, email, invite_type, member_id, invite_name, season_id, invited_role, status, token_expires_at, accepted_at, created_at, updated_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load the invite.");
  }

  if (!data) {
    throw new Error("This invite is invalid or no longer available.");
  }

  return mapTeamInviteRow(data as RawTeamInviteRow);
}

export async function acceptTeamInvite(rawToken: string) {
  const normalizedToken = rawToken.trim();

  if (!normalizedToken) {
    throw new Error("Invite token is required.");
  }

  const { data, error } = await supabase.rpc("accept_team_invite", {
    invite_token: normalizedToken
  });

  if (error) {
    throw new Error(error.message || "Could not accept the invite.");
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error("Invite acceptance did not return a result.");
  }

  return {
    inviteId: typeof row.invite_id === "string" ? row.invite_id : "",
    teamId: typeof row.team_id === "string" ? row.team_id : "",
    memberId: typeof row.member_id === "string" ? row.member_id : "",
    inviteType: normalizeTeamInviteType(row.invite_type),
    createdMember: row.created_member === true
  } satisfies InviteAcceptanceResult;
}
