import { getCurrentUserAccess, requireAdminAccess } from "@/app/services/accessControlService";
import { formatName } from "@/app/services/formatname";
import { supabase } from "@/app/services/supabaseClient";

export const FEEDBACK_CATEGORIES = ["Bug", "Suggestion", "Improvement", "Question"] as const;
export const FEEDBACK_MODULES = [
  "General",
  "Dashboard",
  "Matches",
  "Players",
  "Planner",
  "Analytics",
  "Validation",
  "Configure",
  "Profile",
  "Upload",
  "Authentication"
] as const;
export const FEEDBACK_PRIORITIES = ["Low", "Medium", "High"] as const;
export const FEEDBACK_STATUSES = ["New", "Reviewed", "In Progress", "Closed"] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export type FeedbackModule = (typeof FEEDBACK_MODULES)[number];
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export type FeedbackFilters = {
  category?: FeedbackCategory | "all";
  module?: FeedbackModule | "all";
  status?: FeedbackStatus | "all";
};

export type FeedbackFormValues = {
  category: FeedbackCategory;
  module: FeedbackModule;
  title: string;
  description: string;
  priority: FeedbackPriority;
};

export type FeedbackRecord = {
  id: string;
  teamId: string;
  userId: string;
  category: FeedbackCategory;
  module: FeedbackModule;
  title: string;
  description: string;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  submittedByDisplayName: string | null;
};

export type FeedbackWorkspaceData = {
  myFeedback: FeedbackRecord[];
  teamFeedback: FeedbackRecord[];
  canManageTeamFeedback: boolean;
};

type RawFeedbackRow = {
  id?: unknown;
  team_id?: unknown;
  user_id?: unknown;
  category?: unknown;
  module?: unknown;
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  status?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type RawFeedbackUserRow = {
  id?: unknown;
  email?: unknown;
  username?: unknown;
  first_name?: unknown;
  last_name?: unknown;
};

let feedbackModuleSupportPromise: Promise<boolean> | null = null;

function normalizeNullableText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredText(value: unknown, fallback = "") {
  return normalizeNullableText(value) ?? fallback;
}

function normalizeCategory(value: unknown): FeedbackCategory {
  return FEEDBACK_CATEGORIES.includes(value as FeedbackCategory)
    ? (value as FeedbackCategory)
    : "Suggestion";
}

function normalizeModule(value: unknown): FeedbackModule {
  return FEEDBACK_MODULES.includes(value as FeedbackModule)
    ? (value as FeedbackModule)
    : "General";
}

function normalizePriority(value: unknown): FeedbackPriority {
  return FEEDBACK_PRIORITIES.includes(value as FeedbackPriority)
    ? (value as FeedbackPriority)
    : "Medium";
}

function normalizeStatus(value: unknown): FeedbackStatus {
  return FEEDBACK_STATUSES.includes(value as FeedbackStatus)
    ? (value as FeedbackStatus)
    : "New";
}

function buildFeedbackUserDisplayName(row: RawFeedbackUserRow) {
  const firstName = normalizeNullableText(row.first_name);
  const lastName = normalizeNullableText(row.last_name);
  const username = normalizeNullableText(row.username);
  const email = normalizeRequiredText(row.email);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return formatName(fullName);
  }

  if (username) {
    return `@${username}`;
  }

  return email || "Unknown User";
}

function mapFeedbackRow(
  row: RawFeedbackRow,
  userDisplayNameById?: Map<string, string>
): FeedbackRecord {
  const userId = normalizeRequiredText(row.user_id);

  return {
    id: normalizeRequiredText(row.id),
    teamId: normalizeRequiredText(row.team_id),
    userId,
    category: normalizeCategory(row.category),
    module: normalizeModule(row.module),
    title: normalizeRequiredText(row.title),
    description: normalizeRequiredText(row.description),
    priority: normalizePriority(row.priority),
    status: normalizeStatus(row.status),
    createdAt: normalizeRequiredText(row.created_at),
    updatedAt: normalizeRequiredText(row.updated_at),
    submittedByDisplayName: userDisplayNameById?.get(userId) ?? null
  };
}

function normalizeTitle(title: string) {
  return title.trim();
}

function normalizeDescription(description: string) {
  return description.trim();
}

function validateFeedbackInput(values: FeedbackFormValues) {
  const title = normalizeTitle(values.title);
  const description = normalizeDescription(values.description);

  if (!FEEDBACK_CATEGORIES.includes(values.category)) {
    throw new Error("Please choose a valid feedback category.");
  }

  if (!FEEDBACK_MODULES.includes(values.module)) {
    throw new Error("Please choose a valid product module.");
  }

  if (!FEEDBACK_PRIORITIES.includes(values.priority)) {
    throw new Error("Please choose a valid priority.");
  }

  if (!title) {
    throw new Error("Feedback title is required.");
  }

  if (title.length > 120) {
    throw new Error("Feedback title must be 120 characters or fewer.");
  }

  if (!description) {
    throw new Error("Feedback description is required.");
  }

  if (description.length < 10) {
    throw new Error("Feedback description must be at least 10 characters.");
  }

  return {
    title,
    description
  };
}

async function requireTeamScopedAccess() {
  const access = await getCurrentUserAccess();

  if (!access.teamId) {
    throw new Error("Your account is not assigned to a team yet.");
  }

  return access;
}

export async function hasFeedbackModuleSupport() {
  if (!feedbackModuleSupportPromise) {
    feedbackModuleSupportPromise = (async () => {
      const { error } = await supabase
        .from("feedback")
        .select("id")
        .limit(1);

      return !error;
    })();
  }

  return feedbackModuleSupportPromise;
}

export async function getFeedbackWorkspace(filters: FeedbackFilters = {}): Promise<FeedbackWorkspaceData> {
  const access = await requireTeamScopedAccess();

  if (!(await hasFeedbackModuleSupport())) {
    throw new Error("Feedback is not available in this environment yet.");
  }

  const myFeedbackQuery = supabase
    .from("feedback")
    .select("id, team_id, user_id, category, module, title, description, priority, status, created_at, updated_at")
    .eq("team_id", access.teamId)
    .eq("user_id", access.user.id)
    .order("created_at", { ascending: false });

  const teamFeedbackQuery = access.role === "admin"
    ? (() => {
      let query = supabase
        .from("feedback")
        .select("id, team_id, user_id, category, module, title, description, priority, status, created_at, updated_at")
        .eq("team_id", access.teamId);

      if (filters.category && filters.category !== "all") {
        query = query.eq("category", filters.category);
      }

      if (filters.module && filters.module !== "all") {
        query = query.eq("module", filters.module);
      }

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      return query.order("created_at", { ascending: false });
    })()
    : Promise.resolve({ data: [], error: null });

  const [
    { data: myFeedbackData, error: myFeedbackError },
    { data: teamFeedbackData, error: teamFeedbackError }
  ] = await Promise.all([myFeedbackQuery, teamFeedbackQuery]);

  if (myFeedbackError) {
    throw new Error("Could not load your feedback yet.");
  }

  if (teamFeedbackError) {
    throw new Error("Could not load team feedback yet.");
  }

  const rawTeamFeedback = (teamFeedbackData ?? []) as RawFeedbackRow[];
  const submitterIds = [...new Set(rawTeamFeedback.map((row) => normalizeRequiredText(row.user_id)).filter(Boolean))];
  let userDisplayNameById = new Map<string, string>();

  if (access.role === "admin" && submitterIds.length > 0) {
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, username, first_name, last_name")
      .in("id", submitterIds);

    if (userError) {
      throw new Error("Could not load the feedback submitter details.");
    }

    userDisplayNameById = new Map(
      ((userData ?? []) as RawFeedbackUserRow[])
        .map((row) => [normalizeRequiredText(row.id), buildFeedbackUserDisplayName(row)] as const)
    );
  }

  return {
    myFeedback: ((myFeedbackData ?? []) as RawFeedbackRow[]).map((row) => mapFeedbackRow(row)),
    teamFeedback: rawTeamFeedback.map((row) => mapFeedbackRow(row, userDisplayNameById)),
    canManageTeamFeedback: access.role === "admin"
  };
}

export async function submitFeedback(values: FeedbackFormValues) {
  const access = await requireTeamScopedAccess();

  if (!(await hasFeedbackModuleSupport())) {
    throw new Error("Feedback is not available in this environment yet.");
  }

  const normalized = validateFeedbackInput(values);

  const { error } = await supabase
    .from("feedback")
    .insert({
      team_id: access.teamId,
      user_id: access.user.id,
      category: values.category,
      module: values.module,
      title: normalized.title,
      description: normalized.description,
      priority: values.priority,
      status: "New"
    });

  if (error) {
    throw new Error("Could not submit your feedback.");
  }
}

export async function updateFeedbackStatus(feedbackId: string, status: FeedbackStatus) {
  const access = await requireAdminAccess();

  if (!(await hasFeedbackModuleSupport())) {
    throw new Error("Feedback is not available in this environment yet.");
  }

  if (!FEEDBACK_STATUSES.includes(status)) {
    throw new Error("Please choose a valid feedback status.");
  }

  const { error } = await supabase
    .from("feedback")
    .update({ status })
    .eq("id", feedbackId)
    .eq("team_id", access.teamId);

  if (error) {
    throw new Error("Could not update the feedback status.");
  }
}
