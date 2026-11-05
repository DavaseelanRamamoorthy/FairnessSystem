// Test helpers: build players and simulate weeks of plan -> play -> ledger.
import { classify } from "./eligibility";
import { balanceOf, computeLedger } from "./ledger";
import { suggestSelection } from "./planner";
import type { BatPref, Candidate, FairnessRules, FixtureFact, Ledger, Suggestion } from "./types";

export type TestPlayer = {
  id: string;
  bowls?: boolean;
  keeper?: boolean;
  captain?: boolean;
  batPref?: BatPref;
  joinedOn?: string;
  leftOn?: string;
  paid?: boolean;
  unavailable?: string[]; // match dates
};

export type WeekAnswer = { yes: string[]; late?: string[] };

export function makeFact(player: TestPlayer, fixtureId: string, matchDate: string, overrides: Partial<FixtureFact> = {}): FixtureFact {
  return {
    fixtureId,
    seasonId: "s1",
    matchDate,
    slot: 1,
    status: "played",
    overs: 20,
    fairnessWeight: 1,
    memberId: player.id,
    bowls: player.bowls ?? false,
    isWicketkeeper: player.keeper ?? false,
    batPref: player.batPref ?? "flexible",
    seasonRole: player.captain ? "captain" : "player",
    joinedOn: player.joinedOn ?? "2027-01-01",
    leftOn: player.leftOn ?? null,
    membershipPaid: player.paid ?? true,
    unavailable: player.unavailable?.includes(matchDate) ?? false,
    answer: null,
    onTime: false,
    played: false,
    batPosition: null,
    ballsBowled: 0,
    teamBallsBowled: 120,
    ...overrides
  };
}

export function toCandidates(players: TestPlayer[], facts: FixtureFact[], ledger: Ledger): Candidate[] {
  return players.map((player) => {
    const fact = facts.find((f) => f.memberId === player.id)!;
    return {
      memberId: player.id,
      name: player.id,
      eligibility: classify(fact),
      isCaptain: player.captain ?? false,
      isWicketkeeper: player.keeper ?? false,
      bowls: player.bowls ?? false,
      batPref: player.batPref ?? "flexible",
      bowlPref: "flexible",
      balance: balanceOf(ledger, player.id),
      seasonXiCount: ledger.get(player.id)?.matchesPlayed ?? 0
    };
  });
}

/** Runs the planner week by week and plays exactly what it suggests. */
export function simulateSeason(players: TestPlayer[], weeks: WeekAnswer[], rules: FairnessRules) {
  const allFacts: FixtureFact[] = [];
  const plans: Suggestion[] = [];
  weeks.forEach((week, index) => {
    const fixtureId = `f${index + 1}`;
    const matchDate = `2027-05-${String(index + 1).padStart(2, "0")}`;
    const weekFacts = players.map((player) =>
      makeFact(player, fixtureId, matchDate, {
        answer: week.yes.includes(player.id) || week.late?.includes(player.id) ? "yes" : null,
        onTime: week.yes.includes(player.id),
        status: "locked"
      })
    );
    const ledger = computeLedger(allFacts, rules);
    const plan = suggestSelection({ overs: 20, candidates: toCandidates(players, weekFacts, ledger), rules });
    plans.push(plan);
    for (const fact of weekFacts) {
      const pick = plan.picks.find((p) => p.memberId === fact.memberId && p.slot === "xi");
      allFacts.push({
        ...fact,
        status: "played",
        played: Boolean(pick),
        batPosition: pick?.battingPosition ?? null,
        ballsBowled: (pick?.plannedOvers ?? 0) * 6
      });
    }
  });
  return { facts: allFacts, plans, ledger: computeLedger(allFacts, rules) };
}

export function squad(count: number, extra: (index: number) => Partial<TestPlayer> = () => ({})): TestPlayer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${String(index + 1).padStart(2, "0")}`,
    bowls: index % 2 === 0,
    keeper: index === 1,
    ...extra(index)
  }));
}
