"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/app/services/supabaseClient";
import {
  FALLBACK_TEAM_CODE,
  FALLBACK_TEAM_NAME,
  resolveActiveTeamCode,
  resolveActiveTeamName,
  resolveStoredTeamJoinCode
} from "@/app/utils/teamBranding";

type TeamBranding = {
  joinCode: string;
  teamName: string;
  teamCode: string;
};

type RawTeamRow = {
  name?: string | null;
  join_code?: string | null;
};

export function useActiveTeamBranding(): TeamBranding {
  const { profile } = useAuth();
  const [branding, setBranding] = useState<TeamBranding>({
    joinCode: "",
    teamName: FALLBACK_TEAM_NAME,
    teamCode: FALLBACK_TEAM_CODE
  });

  useEffect(() => {
    let isActive = true;

    const loadBranding = async () => {
      if (!profile?.teamId) {
        if (isActive) {
          setBranding({
            joinCode: "",
            teamName: FALLBACK_TEAM_NAME,
            teamCode: FALLBACK_TEAM_CODE
          });
        }
        return;
      }

      const { data } = await supabase
        .from("teams")
        .select("name, join_code")
        .eq("id", profile.teamId)
        .maybeSingle();

      const teamRow = (data ?? null) as RawTeamRow | null;
      const nextJoinCode = resolveStoredTeamJoinCode(teamRow?.join_code);
      const nextTeamName = resolveActiveTeamName(teamRow?.name);
      const nextTeamCode = resolveActiveTeamCode(teamRow?.name, teamRow?.join_code);

      if (isActive) {
        setBranding({
          joinCode: nextJoinCode,
          teamName: nextTeamName,
          teamCode: nextTeamCode
        });
      }
    };

    void loadBranding();

    return () => {
      isActive = false;
    };
  }, [profile?.teamId]);

  return branding;
}
