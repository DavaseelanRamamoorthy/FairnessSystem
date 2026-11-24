"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/db/client";
import {
  loadCurrentSeason,
  loadMyApplication,
  loadMyMember,
  loadMySeasonRows,
  loadTeam,
  type Application,
  type Member,
  type Season,
  type SeasonMember,
  type Team
} from "@/src/db/membership";

export type Session = {
  loading: boolean;
  error: string | null;
  user: User | null;
  team: Team | null;
  /** Null when registration is closed and the viewer is not in the squad. */
  season: Season | null;
  member: Member | null;
  /** The viewer's row for the current season, or their latest one if they left. */
  seasonMember: SeasonMember | null;
  application: Application | null;
  isOrganiser: boolean;
  canManageMatches: boolean;
  canManageMoney: boolean;
  canManageKit: boolean;
  refresh: () => void;
};

type Loaded = Omit<Session, "loading" | "error" | "refresh" | "isOrganiser" | "canManageMatches" | "canManageMoney" | "canManageKit">;

const EMPTY: Loaded = { user: null, team: null, season: null, member: null, seasonMember: null, application: null };

const SessionContext = createContext<Session | null>(null);

async function loadSession(user: User | null): Promise<Loaded> {
  if (!user) return EMPTY;
  const team = await loadTeam();
  if (!team) return { ...EMPTY, user };
  const [season, member] = await Promise.all([loadCurrentSeason(team.id), loadMyMember(user.id)]);
  const seasonRows = member ? await loadMySeasonRows(member.id) : [];
  const seasonMember = season ? (seasonRows.find((row) => row.season_id === season.id) ?? null) : (seasonRows[0] ?? null);
  const application = season ? await loadMyApplication(season.id, user.id) : null;
  return { user, team, season, member, seasonMember, application };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Only store the user here: querying inside this callback can deadlock auth.
    const { data } = supabase().auth.onAuthStateChange((_event, session) => {
      setAuthUser((current) => {
        const next = session?.user ?? null;
        return current?.id === next?.id && current !== undefined ? current : next;
      });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authUser === undefined) return;
    let alive = true;
    loadSession(authUser)
      .then((next) => {
        if (!alive) return;
        setLoaded(next);
        setError(null);
      })
      .catch((reason: Error) => {
        if (alive) setError(reason.message);
      });
    return () => {
      alive = false;
    };
  }, [authUser, tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  const value = useMemo<Session>(() => {
    const data = loaded ?? EMPTY;
    const row = data.seasonMember && data.seasonMember.status !== "left" ? data.seasonMember : null;
    const isOrganiser = row?.role === "organiser";
    const stale = loaded !== null && authUser !== undefined && (loaded.user?.id ?? null) !== (authUser?.id ?? null);
    return {
      ...data,
      loading: (loaded === null && !error) || stale,
      error,
      isOrganiser,
      canManageMatches: isOrganiser || row?.role === "captain" || row?.role === "vice_captain",
      canManageMoney: isOrganiser || Boolean(row?.responsibilities.includes("treasurer")),
      canManageKit: isOrganiser || Boolean(row?.responsibilities.includes("kit_manager")),
      refresh
    };
  }, [loaded, error, authUser, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
