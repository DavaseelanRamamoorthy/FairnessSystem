import {
  requireAuthenticatedUser,
  requireInviteManagementAccess
} from "@/app/services/accessControlService";
import { normalizeJoinCodeInput } from "@/app/services/teamOnboardingService";
import { supabase } from "@/app/services/supabaseClient";

export type TeamJoinRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type TeamJoinRequestRecord = {
  requestId: string;
  teamId: string;
  teamName: string | null;
  requesterUserId: string;
  requesterEmail: string;
  requesterName: string;
  status: TeamJoinRequestStatus;
  requestedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
};

type RawTeamJoinRequestRow = {
  id?: unknown;
  team_id?: unknown;
  requester_user_id?: unknown;
  requester_email?: unknown;
  requester_name?: unknown;
  status?: unknown;
  requested_at?: unknown;
  resolved_at?: unknown;
  resolution_note?: unknown;
  teams?: {
    name?: unknown;
  } | null;
};

type RawJoinRequestResultRow = {
  request_id?: unknown;
  team_id?: unknown;
  team_name?: unknown;
  requester_name?: unknown;
  status?: unknown;
  requested_at?: unknown;
};

function normalizeJoinRequestStatus(value: unknown): TeamJoinRequestStatus {
  if (value === "approved" || value === "rejected" || value === "cancelled") {
    return value;
  }

  return "pending";
}

function mapTeamJoinRequestRow(row: RawTeamJoinRequestRow): TeamJoinRequestRecord {
  return {
    requestId: typeof row.id === "string" ? row.id : "",
    teamId: typeof row.team_id === "string" ? row.team_id : "",
    teamName: typeof row.teams?.name === "string" ? row.teams.name : null,
    requesterUserId: typeof row.requester_user_id === "string" ? row.requester_user_id : "",
    requesterEmail: typeof row.requester_email === "string" ? row.requester_email : "",
    requesterName: typeof row.requester_name === "string" ? row.requester_name : "",
    status: normalizeJoinRequestStatus(row.status),
    requestedAt: typeof row.requested_at === "string" ? row.requested_at : "",
    resolvedAt: typeof row.resolved_at === "string" ? row.resolved_at : null,
    resolutionNote: typeof row.resolution_note === "string" ? row.resolution_note : null
  };
}

function mapJoinRequestResultRow(row: RawJoinRequestResultRow | null | undefined) {
  const requestId = typeof row?.request_id === "string" ? row.request_id : "";
  const teamId = typeof row?.team_id === "string" ? row.team_id : "";
  const requesterName = typeof row?.requester_name === "string" ? row.requester_name : "";
  const status = normalizeJoinRequestStatus(row?.status);
  const requestedAt = typeof row?.requested_at === "string" ? row.requested_at : "";
  const teamName = typeof row?.team_name === "string" ? row.team_name : null;

  if (!requestId || !teamId || !requesterName || !requestedAt) {
    throw new Error("The join request response was incomplete.");
  }

  return {
    requestId,
    teamId,
    teamName,
    requesterName,
    status,
    requestedAt
  };
}

export async function getMyPendingTeamJoinRequest() {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from("team_join_requests")
    .select("id, team_id, requester_user_id, requester_email, requester_name, status, requested_at, resolved_at, resolution_note, teams(name)")
    .eq("requester_user_id", user.id)
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load your pending team request.");
  }

  return data ? mapTeamJoinRequestRow(data as RawTeamJoinRequestRow) : null;
}

export async function submitTeamJoinRequest(teamCode: string, preferredMemberName?: string | null) {
  const normalizedTeamCode = normalizeJoinCodeInput(teamCode);

  if (normalizedTeamCode.length !== 6) {
    throw new Error("Enter the 6-character Team ID before requesting access.");
  }

  const { data, error } = await supabase.rpc("submit_team_join_request_by_code", {
    raw_team_join_code: normalizedTeamCode,
    preferred_member_name: preferredMemberName?.trim() || null
  });

  if (error) {
    throw new Error(error.message || "Could not submit the team join request.");
  }

  return mapJoinRequestResultRow(Array.isArray(data) ? (data[0] as RawJoinRequestResultRow | undefined) : null);
}

export async function cancelMyTeamJoinRequest(requestId: string) {
  const { error } = await supabase.rpc("cancel_my_team_join_request", {
    target_request_id: requestId
  });

  if (error) {
    throw new Error(error.message || "Could not cancel the pending team request.");
  }
}

export async function listPendingTeamJoinRequests() {
  const access = await requireInviteManagementAccess();

  const { data, error } = await supabase
    .from("team_join_requests")
    .select("id, team_id, requester_user_id, requester_email, requester_name, status, requested_at, resolved_at, resolution_note, teams(name)")
    .eq("team_id", access.teamId)
    .eq("status", "pending")
    .order("requested_at", { ascending: true });

  if (error) {
    throw new Error("Could not load pending team join requests.");
  }

  return ((data ?? []) as RawTeamJoinRequestRow[]).map((row) => mapTeamJoinRequestRow(row));
}

export async function approveTeamJoinRequest(requestId: string) {
  const { error } = await supabase.rpc("approve_team_join_request", {
    target_request_id: requestId
  });

  if (error) {
    throw new Error(error.message || "Could not approve the team join request.");
  }
}

export async function rejectTeamJoinRequest(requestId: string, resolutionNote?: string | null) {
  const { error } = await supabase.rpc("reject_team_join_request", {
    target_request_id: requestId,
    next_resolution_note: resolutionNote?.trim() || null
  });

  if (error) {
    throw new Error(error.message || "Could not reject the team join request.");
  }
}
