"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/app/services/supabaseClient";
import {
  getFriendlyAuthErrorMessage,
  normalizeAuthEmail
} from "@/app/services/authValidation";

export type AuthRole = "admin" | "member";

export type AuthProfile = {
  id: string;
  email: string;
  role: AuthRole;
  teamId: string | null;
  playerId: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
};

type AuthContextValue = {
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  profileError: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isProfileComplete: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; requiresEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

type UserProfileRow = {
  id: string;
  email: string | null;
  role: string | null;
  team_id: string | null;
  player_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  phone_country_code?: string | null;
  phone_number?: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeRole(role: string | null | undefined): AuthRole {
  return role === "admin" ? "admin" : "member";
}

function normalizeProfileText(value: string | null | undefined) {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function isProfileComplete(profile: AuthProfile | null) {
  return Boolean(
    profile?.firstName
    && profile.lastName
    && profile.username
    && profile.phoneCountryCode
    && profile.phoneNumber
  );
}

function mapUserProfile(row: UserProfileRow, fallbackEmail: string | undefined): AuthProfile {
  return {
    id: row.id,
    email: row.email?.trim() || fallbackEmail || "",
    role: normalizeRole(row.role),
    teamId: row.team_id,
    playerId: row.player_id ?? null,
    firstName: normalizeProfileText(row.first_name),
    lastName: normalizeProfileText(row.last_name),
    username: normalizeProfileText(row.username),
    phoneCountryCode: normalizeProfileText(row.phone_country_code),
    phoneNumber: normalizeProfileText(row.phone_number)
  };
}

function getProfileLoadErrorMessage(error: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return "Signed in, but the app user profile could not be loaded.";
  }

  if (error.code === "PGRST116") {
    return "Signed in, but no matching app user profile row exists yet. Run database/v1_auth_access_control.sql and confirm the auth-to-public.users sync trigger is installed.";
  }

  if (error.code === "42P01") {
    return "Signed in, but the public.users table is not available yet. Run database/v1_auth_access_control.sql before testing auth.";
  }

  return "Signed in, but the app user profile could not be loaded. Run database/v1_auth_access_control.sql and confirm a users row exists for this account.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", nextSession.user.id)
      .single();

    if (error) {
      setProfile(null);
      setProfileError(getProfileLoadErrorMessage(error));
      return;
    }

    setProfile(mapUserProfile(data as UserProfileRow, nextSession.user.email));
    setProfileError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session: nextSession }
    } = await supabase.auth.getSession();

    setSession(nextSession);
    await loadProfile(nextSession);
  }, [loadProfile]);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const {
        data: { session: initialSession }
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSession(initialSession);
      await loadProfile(initialSession);

      if (isMounted) {
        setIsLoading(false);
      }
    };

    void initializeAuth();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(true);

      void loadProfile(nextSession).finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeAuthEmail(email),
      password
    });

    return error ? getFriendlyAuthErrorMessage("signIn", error.message) : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: normalizeAuthEmail(email),
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : undefined
      }
    });

    return {
      error: error ? getFriendlyAuthErrorMessage("signUp", error.message) : null,
      requiresEmailConfirmation: !data.session
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setProfileError(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    isLoading,
    session,
    user: session?.user ?? null,
    profile,
    profileError,
    isAuthenticated: Boolean(session?.user),
    isAdmin: profile?.role === "admin",
    isMember: profile?.role === "member",
    isProfileComplete: isProfileComplete(profile),
    signIn,
    signUp,
    signOut,
    refreshProfile
  }), [isLoading, profile, profileError, refreshProfile, session, signIn, signOut, signUp]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
