import type { Eligibility, FixtureFact } from "./types";

/** Was this person in the squad on the match date? */
export function wasMember(fact: Pick<FixtureFact, "seasonRole" | "joinedOn" | "leftOn" | "matchDate">) {
  if (!fact.seasonRole) return false;
  if (fact.joinedOn && fact.joinedOn > fact.matchDate) return false;
  if (fact.leftOn && fact.leftOn < fact.matchDate) return false;
  return true;
}

/**
 * Order matters: someone on long-term leave is "unavailable" even if a stale
 * Spond answer says yes; an unpaid member is never treated as on time.
 */
export function classify(fact: FixtureFact): Eligibility {
  if (!wasMember(fact)) return "not_member";
  if (fact.unavailable) return "unavailable";
  if (fact.answer !== "yes") return "not_available";
  if (!fact.membershipPaid) return "unpaid";
  return fact.onTime ? "on_time" : "late";
}

export const ELIGIBILITY_LABEL: Record<Eligibility, string> = {
  on_time: "Available on time",
  late: "Answered after the deadline",
  unpaid: "Membership not paid",
  unavailable: "On leave",
  not_available: "Not available",
  not_member: "Not in the squad"
};
