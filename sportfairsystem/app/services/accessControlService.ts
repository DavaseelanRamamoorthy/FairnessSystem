import { supabase } from "@/app/services/supabaseClient";

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
      "Your user access profile is not ready yet. Run database/v1_auth_access_control.sql and confirm your public.users row exists."
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
