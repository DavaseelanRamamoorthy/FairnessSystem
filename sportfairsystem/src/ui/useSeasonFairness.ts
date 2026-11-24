"use client";

import { useCallback, useMemo } from "react";
import { computeLedger } from "@/src/engine/ledger";
import { resolveRules } from "@/src/engine/rules";
import { loadSeasonFacts } from "@/src/db/fixtures";
import { loadMembers, loadSeasonMembers, type Member, type SeasonMember } from "@/src/db/membership";
import { rowToFact, type FactRow } from "@/src/fairness/facts";
import { useLoad } from "./kit";
import { useSession } from "./session";

export type SeasonFairness = {
  rows: FactRow[];
  members: Map<string, Member>;
  squad: SeasonMember[];
  ledger: ReturnType<typeof computeLedger>;
  rules: ReturnType<typeof resolveRules>;
};

/**
 * Everything a fairness view needs for the current season. Every viewer
 * computes the same ledger from the same facts, so the numbers always agree.
 */
export function useSeasonFairness() {
  const { season, team } = useSession();
  const seasonId = season?.id ?? "";
  const teamId = team?.id ?? "";
  const load = useCallback(async () => {
    const [rows, members, squad] = await Promise.all([
      loadSeasonFacts(seasonId),
      loadMembers(teamId),
      loadSeasonMembers(seasonId)
    ]);
    return { rows, members, squad };
  }, [seasonId, teamId]);
  const state = useLoad(load);

  const data = useMemo<SeasonFairness | undefined>(() => {
    if (!state.data) return undefined;
    const rules = resolveRules(season?.rules);
    return {
      rows: state.data.rows,
      members: new Map(state.data.members.map((m) => [m.id, m])),
      squad: state.data.squad,
      rules,
      ledger: computeLedger(state.data.rows.map(rowToFact), rules)
    };
  }, [state.data, season?.rules]);

  return { ...state, data };
}
