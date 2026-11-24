import { classify } from "@/src/engine/eligibility";
import { balanceOf } from "@/src/engine/ledger";
import type { BowlPref, Candidate, FixtureFact, Ledger } from "@/src/engine/types";

export type MemberInfo = { id: string; display_name: string; bowl_pref: BowlPref };

/** Planner input for one fixture, from its facts and the season ledger so far. */
export function buildCandidates(fixtureFacts: FixtureFact[], ledger: Ledger, members: Map<string, MemberInfo>): Candidate[] {
  return fixtureFacts.map((fact) => {
    const member = members.get(fact.memberId);
    return {
      memberId: fact.memberId,
      name: member?.display_name ?? "Unknown player",
      eligibility: classify(fact),
      isCaptain: fact.seasonRole === "captain",
      isWicketkeeper: fact.isWicketkeeper,
      bowls: fact.bowls,
      batPref: fact.batPref,
      bowlPref: member?.bowl_pref ?? "flexible",
      balance: balanceOf(ledger, fact.memberId),
      seasonXiCount: ledger.get(fact.memberId)?.matchesPlayed ?? 0
    };
  });
}
