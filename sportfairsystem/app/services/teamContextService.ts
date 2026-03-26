import { getCurrentUserAccess } from "@/app/services/accessControlService";
import { supabase } from "@/app/services/supabaseClient";
import { resolveActiveTeamCode, resolveActiveTeamName } from "@/app/utils/teamBranding";

type TeamRow = {
  id: string;
  name: string | null;
  join_code: string | null;
};

export type ActiveTeamContext = {
  teamId: string;
  teamName: string;
  teamCode: string;
};

type CachedValue<T> = {
  value: T;
  expiresAt: number;
};

const TEAM_CONTEXT_CACHE_TTL_MS = 3000;

let activeTeamContextPromise: Promise<ActiveTeamContext> | null = null;
let activeTeamContextCache: CachedValue<ActiveTeamContext> | null = null;

function getCachedValue<T>(cache: CachedValue<T> | null) {
  if (!cache || cache.expiresAt <= Date.now()) {
    return null;
  }

  return cache.value;
}

function setCachedValue<T>(value: T): CachedValue<T> {
  return {
    value,
    expiresAt: Date.now() + TEAM_CONTEXT_CACHE_TTL_MS
  };
}

export function clearActiveTeamContextCache() {
  activeTeamContextPromise = null;
  activeTeamContextCache = null;
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange(() => {
    clearActiveTeamContextCache();
  });
}

export async function getActiveTeamContext(): Promise<ActiveTeamContext> {
  const cachedContext = getCachedValue(activeTeamContextCache);

  if (cachedContext) {
    return cachedContext;
  }

  if (activeTeamContextPromise) {
    return activeTeamContextPromise;
  }

  activeTeamContextPromise = (async () => {
    const access = await getCurrentUserAccess();

    if (!access.teamId) {
      throw new Error("Could not load the current team.");
    }

    const { data, error } = await supabase
      .from("teams")
      .select("id, name, join_code")
      .eq("id", access.teamId)
      .single();

    const context: ActiveTeamContext = error || !data
      ? {
          teamId: access.teamId,
          teamName: resolveActiveTeamName(null),
          teamCode: resolveActiveTeamCode(null, null)
        }
      : {
          teamId: (data as TeamRow).id,
          teamName: resolveActiveTeamName((data as TeamRow).name),
          teamCode: resolveActiveTeamCode((data as TeamRow).name, (data as TeamRow).join_code)
        };

    activeTeamContextCache = setCachedValue(context);
    return context;
  })();

  try {
    return await activeTeamContextPromise;
  } finally {
    activeTeamContextPromise = null;
  }
}

export async function getActiveTeamName() {
  const context = await getActiveTeamContext();
  return context.teamName;
}

export async function getActiveTeamCode() {
  const context = await getActiveTeamContext();
  return context.teamCode;
}
