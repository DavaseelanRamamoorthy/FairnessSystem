import {
  requireAttendanceManagementAccess,
  requirePlannerWorkspaceAccess
} from "@/app/services/accessControlService";
import { formatName } from "@/app/services/formatname";
import { supabase } from "@/app/services/supabaseClient";

export type AttendanceAvailabilityState = "available" | "not_available" | "maybe";

export type AttendanceSessionRecord = {
  sessionId: string;
  plannerMode: "friendly" | "tournament";
  season: string | null;
  weekendDate: string;
  weekendLabel: string;
  matchCount: number;
  availableCount: number;
  maybeCount: number;
  notAvailableCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceSessionMemberRecord = {
  memberId: string;
  name: string;
  playerId: string | null;
  availability: AttendanceAvailabilityState;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  roleTags: string[];
};

export type AttendanceSessionDetail = {
  session: AttendanceSessionRecord;
  members: AttendanceSessionMemberRecord[];
};

type AttendanceSessionRow = {
  id?: unknown;
  planner_mode?: unknown;
  season?: unknown;
  weekend_date?: unknown;
  weekend_label?: unknown;
  match_count?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type AttendanceEntryRow = {
  session_id?: unknown;
  member_id?: unknown;
  availability?: unknown;
};

type AttendanceEntryDetailRow = {
  member_id?: unknown;
  availability?: unknown;
};

type TeamMemberRow = {
  id?: unknown;
  name?: unknown;
  status?: unknown;
  season_id?: unknown;
};

type LinkedPlayerRow = {
  id?: unknown;
  member_id?: unknown;
  is_captain?: unknown;
  is_wicket_keeper?: unknown;
  role_tags?: unknown;
};

type CreateAttendanceSessionInput = {
  season: string | null;
  weekendDate: string;
  matchCount: number;
};

type SaveAttendanceAvailabilityInput = {
  sessionId: string;
  updates: Array<{
    memberId: string;
    availability: AttendanceAvailabilityState;
  }>;
};

function formatWeekendLabelFromIsoDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${isoDate}T00:00:00`));
}

function mapAttendanceAvailability(value: unknown): AttendanceAvailabilityState {
  if (value === "available" || value === "maybe") {
    return value;
  }

  return "not_available";
}

function buildAttendanceCounts(entries: AttendanceEntryRow[]) {
  return entries.reduce(
    (counts, row) => {
      const availability = mapAttendanceAvailability(row.availability);

      if (availability === "available") {
        counts.availableCount += 1;
      } else if (availability === "maybe") {
        counts.maybeCount += 1;
      } else {
        counts.notAvailableCount += 1;
      }

      return counts;
    },
    {
      availableCount: 0,
      maybeCount: 0,
      notAvailableCount: 0
    }
  );
}

function mapAttendanceSessionRecord(
  row: AttendanceSessionRow,
  entries: AttendanceEntryRow[]
): AttendanceSessionRecord | null {
  if (
    typeof row.id !== "string"
    || typeof row.weekend_date !== "string"
    || typeof row.weekend_label !== "string"
    || typeof row.created_at !== "string"
    || typeof row.updated_at !== "string"
    || typeof row.match_count !== "number"
  ) {
    return null;
  }

  const counts = buildAttendanceCounts(entries);

  return {
    sessionId: row.id,
    plannerMode: row.planner_mode === "tournament" ? "tournament" : "friendly",
    season: typeof row.season === "string" ? row.season : null,
    weekendDate: row.weekend_date,
    weekendLabel: row.weekend_label,
    matchCount: row.match_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...counts
  };
}

async function resolveSeasonIds(teamId: string, season: string | null) {
  if (!season || season === "all") {
    return null;
  }

  const { data, error } = await supabase
    .from("membership_seasons")
    .select("id")
    .eq("team_id", teamId)
    .eq("name", season);

  if (error) {
    throw new Error("Could not load membership seasons for attendance.");
  }

  return (data ?? [])
    .flatMap((row) => (typeof row.id === "string" ? [row.id] : []));
}

async function loadAttendanceSessionRows(teamId: string, season: string | null) {
  const query = supabase
    .from("attendance_sessions")
    .select("id, planner_mode, season, weekend_date, weekend_label, match_count, created_at, updated_at")
    .eq("team_id", teamId)
    .eq("planner_mode", "friendly")
    .order("weekend_date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data, error } = season && season !== "all"
    ? await query.eq("season", season)
    : await query;

  if (error) {
    throw new Error("Could not load native attendance sessions.");
  }

  return (data ?? []) as AttendanceSessionRow[];
}

export async function getPlannerAttendanceSessions(season?: string | null) {
  const access = await requirePlannerWorkspaceAccess();
  const sessionRows = await loadAttendanceSessionRows(access.teamId, season ?? null);

  if (sessionRows.length === 0) {
    return [] as AttendanceSessionRecord[];
  }

  const sessionIds = sessionRows.flatMap((row) => (typeof row.id === "string" ? [row.id] : []));
  const { data: entryRows, error: entryError } = await supabase
    .from("attendance_session_entries")
    .select("session_id, member_id, availability")
    .eq("team_id", access.teamId)
    .in("session_id", sessionIds);

  if (entryError) {
    throw new Error("Could not load native attendance entries.");
  }

  const entriesBySessionId = new Map<string, AttendanceEntryRow[]>();
  ((entryRows ?? []) as AttendanceEntryRow[]).forEach((row) => {
    const sessionId = typeof row.session_id === "string" ? row.session_id : null;

    if (!sessionId) {
      return;
    }

    const currentEntries = entriesBySessionId.get(sessionId) ?? [];
    currentEntries.push(row);
    entriesBySessionId.set(sessionId, currentEntries);
  });

  return sessionRows
    .map((row) => mapAttendanceSessionRecord(row, entriesBySessionId.get(typeof row.id === "string" ? row.id : "") ?? []))
    .filter((session): session is AttendanceSessionRecord => Boolean(session));
}

export async function createPlannerAttendanceSession({
  season,
  weekendDate,
  matchCount
}: CreateAttendanceSessionInput) {
  const access = await requireAttendanceManagementAccess();

  if (!weekendDate) {
    throw new Error("Choose an attendance date before creating the session.");
  }

  if (matchCount < 1 || matchCount > 3) {
    throw new Error("Attendance sessions support between 1 and 3 matches.");
  }

  const seasonIds = await resolveSeasonIds(access.teamId, season);

  const memberQuery = supabase
    .from("team_members")
    .select("id, name, status, season_id")
    .eq("team_id", access.teamId)
    .eq("status", "active")
    .order("name", { ascending: true });

  const { data: memberRows, error: memberError } = seasonIds && seasonIds.length > 0
    ? await memberQuery.in("season_id", seasonIds)
    : seasonIds
      ? { data: [], error: null }
      : await memberQuery;

  if (memberError) {
    throw new Error("Could not load team members for attendance.");
  }

  const activeMembers = ((memberRows ?? []) as TeamMemberRow[])
    .flatMap((row) => (typeof row.id === "string" ? [{ memberId: row.id }] : []));

  if (activeMembers.length === 0) {
    throw new Error("No active team members are available for the selected attendance scope.");
  }

  const weekendLabel = formatWeekendLabelFromIsoDate(weekendDate);
  const nowIso = new Date().toISOString();

  const { data: insertedSession, error: insertSessionError } = await supabase
    .from("attendance_sessions")
    .insert({
      team_id: access.teamId,
      planner_mode: "friendly",
      season: season && season !== "all" ? season : null,
      weekend_date: weekendDate,
      weekend_label: weekendLabel,
      match_count: matchCount,
      attendance_source: "native",
      created_by_user_id: access.user.id,
      updated_at: nowIso
    })
    .select("id")
    .single();

  if (insertSessionError || typeof insertedSession?.id !== "string") {
    if (insertSessionError?.code === "23505") {
      throw new Error("A native attendance session already exists for that date.");
    }

    throw new Error("Could not create the native attendance session.");
  }

  const sessionId = insertedSession.id;
  const entryPayload = activeMembers.map(({ memberId }) => ({
    session_id: sessionId,
    team_id: access.teamId,
    member_id: memberId,
    availability: "not_available" as const,
    updated_by_user_id: access.user.id,
    updated_at: nowIso
  }));

  const { error: insertEntriesError } = await supabase
    .from("attendance_session_entries")
    .insert(entryPayload);

  if (insertEntriesError) {
    throw new Error("Could not initialize native attendance entries.");
  }

  return getPlannerAttendanceSessionDetail(sessionId);
}

export async function getPlannerAttendanceSessionDetail(sessionId: string) {
  const access = await requirePlannerWorkspaceAccess();

  const { data: sessionRow, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select("id, planner_mode, season, weekend_date, weekend_label, match_count, created_at, updated_at")
    .eq("team_id", access.teamId)
    .eq("id", sessionId)
    .single();

  if (sessionError || !sessionRow) {
    throw new Error("Could not load the selected native attendance session.");
  }

  const { data: entryRows, error: entryError } = await supabase
    .from("attendance_session_entries")
    .select("member_id, availability")
    .eq("team_id", access.teamId)
    .eq("session_id", sessionId);

  if (entryError) {
    throw new Error("Could not load native attendance entries.");
  }

  const memberIds = ((entryRows ?? []) as AttendanceEntryDetailRow[])
    .flatMap((row) => (typeof row.member_id === "string" ? [row.member_id] : []));

  const [
    { data: memberRows, error: memberError },
    { data: linkedPlayerRows, error: linkedPlayerError }
  ] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, name")
      .eq("team_id", access.teamId)
      .in("id", memberIds),
    supabase
      .from("players")
      .select("id, member_id, is_captain, is_wicket_keeper, role_tags")
      .eq("team_id", access.teamId)
      .eq("is_guest", false)
      .in("member_id", memberIds)
  ]);

  if (memberError) {
    throw new Error("Could not load attendance team members.");
  }

  if (linkedPlayerError) {
    throw new Error("Could not load attendance linked players.");
  }

  const memberNameById = new Map<string, string>();
  ((memberRows ?? []) as TeamMemberRow[]).forEach((row) => {
    if (typeof row.id === "string" && typeof row.name === "string") {
      memberNameById.set(row.id, formatName(row.name));
    }
  });

  const linkedPlayerByMemberId = new Map<string, LinkedPlayerRow>();
  ((linkedPlayerRows ?? []) as LinkedPlayerRow[]).forEach((row) => {
    if (typeof row.member_id === "string") {
      linkedPlayerByMemberId.set(row.member_id, row);
    }
  });

  const members = ((entryRows ?? []) as AttendanceEntryDetailRow[])
    .map((row) => {
      const memberId = typeof row.member_id === "string" ? row.member_id : null;

      if (!memberId) {
        return null;
      }

      const linkedPlayer = linkedPlayerByMemberId.get(memberId);

      return {
        memberId,
        name: memberNameById.get(memberId) ?? "Unknown Member",
        playerId: typeof linkedPlayer?.id === "string" ? linkedPlayer.id : null,
        availability: mapAttendanceAvailability(row.availability),
        isCaptain: linkedPlayer?.is_captain === true,
        isWicketKeeper: linkedPlayer?.is_wicket_keeper === true,
        roleTags: Array.isArray(linkedPlayer?.role_tags)
          ? linkedPlayer.role_tags.filter((value): value is string => typeof value === "string")
          : []
      } satisfies AttendanceSessionMemberRecord;
    })
    .filter((member): member is AttendanceSessionMemberRecord => Boolean(member))
    .sort((left, right) => left.name.localeCompare(right.name));

  const session = mapAttendanceSessionRecord(sessionRow as AttendanceSessionRow, (entryRows ?? []) as AttendanceEntryRow[]);

  if (!session) {
    throw new Error("Could not map the selected native attendance session.");
  }

  return {
    session,
    members
  } satisfies AttendanceSessionDetail;
}

export async function savePlannerAttendanceAvailability({
  sessionId,
  updates
}: SaveAttendanceAvailabilityInput) {
  const access = await requireAttendanceManagementAccess();

  if (updates.length === 0) {
    throw new Error("Update at least one attendance record before saving.");
  }

  const nowIso = new Date().toISOString();
  const payload = updates.map((update) => ({
    session_id: sessionId,
    team_id: access.teamId,
    member_id: update.memberId,
    availability: update.availability,
    updated_by_user_id: access.user.id,
    updated_at: nowIso
  }));

  const { error } = await supabase
    .from("attendance_session_entries")
    .upsert(payload, {
      onConflict: "session_id,member_id"
    });

  if (error) {
    throw new Error("Could not save native attendance availability.");
  }

  const { error: sessionUpdateError } = await supabase
    .from("attendance_sessions")
    .update({ updated_at: nowIso })
    .eq("team_id", access.teamId)
    .eq("id", sessionId);

  if (sessionUpdateError) {
    throw new Error("Could not refresh the attendance session timestamp.");
  }

  return getPlannerAttendanceSessionDetail(sessionId);
}
