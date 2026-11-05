import { ELIGIBILITY_LABEL } from "./eligibility";
import { bandOf, maxOvers, round2 } from "./rules";
import type { BattingBand } from "./rules";
import type { Candidate, FairnessRules, Pick, Suggestion } from "./types";

export type PlanInput = {
  overs: number;
  candidates: Candidate[];
  rules: FairnessRules;
  preferredKeeperId?: string;
};

/** Highest XI balance first; fewer XIs this season breaks ties; then name. */
function byPriority(a: Candidate, b: Candidate) {
  if (b.balance.xi !== a.balance.xi) return b.balance.xi - a.balance.xi;
  if (a.seasonXiCount !== b.seasonXiCount) return a.seasonXiCount - b.seasonXiCount;
  return a.name.localeCompare(b.name) || a.memberId.localeCompare(b.memberId);
}

function owedText(c: Candidate) {
  const xi = round2(c.balance.xi);
  if (xi > 0) return `owed ${xi} XI${xi === 1 ? "" : "s"}`;
  if (xi < 0) return `${Math.abs(xi)} XI${xi === -1 ? "" : "s"} ahead of fair share`;
  return "level on XIs";
}

/**
 * Suggests XI, 12th man, reserves, batting order and bowling plan.
 * Pure and deterministic: same input, same output.
 */
export function suggestSelection(input: PlanInput): Suggestion {
  const { candidates, rules } = input;
  const warnings: string[] = [];
  const onTime = candidates.filter((c) => c.eligibility === "on_time").sort(byPriority);
  const late = candidates.filter((c) => c.eligibility === "late").sort(byPriority);
  const pool = [...onTime, ...late];

  const xi: Candidate[] = [];
  const why = new Map<string, string>();
  const take = (c: Candidate | undefined, reason: string) => {
    if (!c || xi.includes(c) || xi.length >= rules.xiSize) return false;
    xi.push(c);
    why.set(c.memberId, reason);
    return true;
  };
  const lateNote = (c: Candidate) => (c.eligibility === "late" ? " (late answer, used to fill a gap)" : "");

  // 1. Hard constraints.
  if (rules.lockCaptain) {
    const captain = pool.find((c) => c.isCaptain);
    if (captain) take(captain, `Captain${lateNote(captain)}`);
  }

  if (!xi.some((c) => c.isWicketkeeper || c.memberId === input.preferredKeeperId)) {
    const keeper =
      pool.find((c) => c.memberId === input.preferredKeeperId) ?? pool.find((c) => c.isWicketkeeper);
    if (keeper) take(keeper, `Wicketkeeper, ${owedText(keeper)}${lateNote(keeper)}`);
    else warnings.push("No wicketkeeper is available.");
  }

  for (const bowler of pool.filter((c) => c.bowls)) {
    if (xi.filter((c) => c.bowls).length >= rules.minBowlers) break;
    take(bowler, `Bowling option, ${owedText(bowler)}${lateNote(bowler)}`);
  }
  if (xi.filter((c) => c.bowls).length < rules.minBowlers) {
    warnings.push(`Only ${xi.filter((c) => c.bowls).length} bowling options available (target ${rules.minBowlers}).`);
  }

  // 2. Fill by balance; late answers only after every on-time player.
  for (const c of pool) take(c, `${owedText(c)[0].toUpperCase()}${owedText(c).slice(1)}${lateNote(c)}`);
  if (xi.length < rules.xiSize) warnings.push(`Only ${xi.length} players available for an XI of ${rules.xiSize}.`);

  const rest = pool.filter((c) => !xi.includes(c));
  const twelfth = rest[0];

  const battingOrder = planBattingOrder(xi, rules);
  const overs = planBowling(xi, input.overs, rules, warnings);

  const picks: Pick[] = [];
  for (const c of xi) {
    picks.push({
      memberId: c.memberId,
      name: c.name,
      slot: "xi",
      battingPosition: battingOrder.get(c.memberId) ?? null,
      plannedOvers: overs.get(c.memberId) ?? null,
      reason: why.get(c.memberId)!
    });
  }
  for (const c of rest) {
    const isTwelfth = c === twelfth;
    picks.push({
      memberId: c.memberId,
      name: c.name,
      slot: isTwelfth ? "twelfth" : "reserve",
      battingPosition: null,
      plannedOvers: null,
      reason:
        c.eligibility === "late"
          ? "Answered after the deadline; on-time players come first"
          : `${isTwelfth ? "Next in line" : "Reserve"}: ${owedText(c)}; others are owed more`
    });
  }
  for (const c of candidates) {
    if (c.eligibility === "on_time" || c.eligibility === "late") continue;
    if (c.eligibility === "not_available" || c.eligibility === "not_member") continue;
    picks.push({
      memberId: c.memberId,
      name: c.name,
      slot: "left_out",
      battingPosition: null,
      plannedOvers: null,
      reason: ELIGIBILITY_LABEL[c.eligibility]
    });
  }

  return { picks, warnings };
}

const BAND_ACCEPTS: Record<BattingBand, Array<Candidate["batPref"]>> = {
  top: ["top", "flexible"],
  middle: ["middle", "flexible", "top"],
  lower: ["lower", "flexible", "middle", "top"]
};

/**
 * Fills slots 1..n in order. Each slot goes to the most-owed (batting balance)
 * player whose preference accepts that band; "lower" players are only placed
 * in the lower order, "middle" players never open.
 */
export function planBattingOrder(xi: Candidate[], rules: FairnessRules) {
  const order = new Map<string, number>();
  const remaining = [...xi].sort(
    (a, b) => b.balance.bat - a.balance.bat || a.name.localeCompare(b.name) || a.memberId.localeCompare(b.memberId)
  );
  for (let position = 1; position <= xi.length; position += 1) {
    const accepted = BAND_ACCEPTS[bandOf(position)];
    const fitting = rules.respectBatPref ? remaining.findIndex((c) => accepted.includes(c.batPref)) : 0;
    const [chosen] = remaining.splice(fitting >= 0 ? fitting : 0, 1);
    order.set(chosen.memberId, position);
  }
  return order;
}

/** Hands out overs one at a time to the bowler with the largest remaining bowling balance. */
export function planBowling(xi: Candidate[], totalOvers: number, rules: FairnessRules, warnings: string[]) {
  const cap = maxOvers(totalOvers, rules);
  const bowlers = xi.filter((c) => c.bowls);
  const allocated = new Map<string, number>(bowlers.map((c) => [c.memberId, 0]));
  for (let over = 0; over < totalOvers; over += 1) {
    const next = bowlers
      .filter((c) => allocated.get(c.memberId)! < cap)
      .sort(
        (a, b) =>
          b.balance.bowl - allocated.get(b.memberId)! - (a.balance.bowl - allocated.get(a.memberId)!) ||
          allocated.get(a.memberId)! - allocated.get(b.memberId)! ||
          a.name.localeCompare(b.name)
      )[0];
    if (!next) {
      warnings.push(`Bowlers can cover only ${over} of ${totalOvers} overs at ${cap} overs each.`);
      break;
    }
    allocated.set(next.memberId, allocated.get(next.memberId)! + 1);
  }
  return allocated;
}

/**
 * Plans several fixtures on one day. After each plan, balances are adjusted
 * as if the plan happened, so the next match favours whoever just missed out.
 */
export function suggestDay(
  fixtures: Array<{ overs: number; candidates: Candidate[] }>,
  rules: FairnessRules,
  preferredKeeperId?: string
): Suggestion[] {
  const provisional = new Map<string, { xi: number; xiCount: number }>();
  return fixtures.map((fixture) => {
    const candidates = fixture.candidates.map((c) => {
      const adj = provisional.get(c.memberId);
      return adj
        ? { ...c, balance: { ...c.balance, xi: c.balance.xi + adj.xi }, seasonXiCount: c.seasonXiCount + adj.xiCount }
        : c;
    });
    const result = suggestSelection({ overs: fixture.overs, candidates, rules, preferredKeeperId });
    const onTime = candidates.filter((c) => c.eligibility === "on_time");
    const owedEach = onTime.length > 0 ? Math.min(1, rules.xiSize / onTime.length) : 0;
    for (const c of onTime) {
      const cur = provisional.get(c.memberId) ?? { xi: 0, xiCount: 0 };
      cur.xi += owedEach;
      provisional.set(c.memberId, cur);
    }
    for (const pick of result.picks.filter((p) => p.slot === "xi")) {
      const cur = provisional.get(pick.memberId) ?? { xi: 0, xiCount: 0 };
      cur.xi -= 1;
      cur.xiCount += 1;
      provisional.set(pick.memberId, cur);
    }
    return result;
  });
}
