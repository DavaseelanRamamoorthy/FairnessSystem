import { describe, expect, it } from "vitest";
import { classify } from "./eligibility";
import { computeLedger } from "./ledger";
import { planBowling, suggestDay, suggestSelection } from "./planner";
import { DEFAULT_RULES, resolveRules } from "./rules";
import { makeFact, simulateSeason, squad, toCandidates } from "./testing";

const rules = DEFAULT_RULES;

describe("eligibility", () => {
  const base = { id: "a" };
  it("classifies on time, late, unpaid, leave, not member", () => {
    expect(classify(makeFact(base, "f", "2027-05-01", { answer: "yes", onTime: true }))).toBe("on_time");
    expect(classify(makeFact(base, "f", "2027-05-01", { answer: "yes", onTime: false }))).toBe("late");
    expect(classify(makeFact({ id: "a", paid: false }, "f", "2027-05-01", { answer: "yes", onTime: true }))).toBe("unpaid");
    expect(
      classify(makeFact({ id: "a", unavailable: ["2027-05-01"] }, "f", "2027-05-01", { answer: "yes", onTime: true }))
    ).toBe("unavailable");
    expect(
      classify(makeFact({ id: "a", joinedOn: "2027-06-01" }, "f", "2027-05-01", { answer: "yes", onTime: true }))
    ).toBe("not_member");
    expect(classify(makeFact(base, "f", "2027-05-01", { answer: "no" }))).toBe("not_available");
  });
});

describe("season fairness", () => {
  it("15 available for 11 spots over 4 weeks: nobody ends more than 1 XI short", () => {
    const players = squad(15);
    const all = players.map((p) => p.id);
    const { ledger } = simulateSeason(players, [{ yes: all }, { yes: all }, { yes: all }, { yes: all }], rules);
    for (const p of players) {
      expect(ledger.get(p.id)!.xi.balance).toBeLessThanOrEqual(1);
    }
    // The only wicketkeeper (p02) is required in every XI, so exclude them from the spread.
    const played = players.filter((p) => !p.keeper).map((p) => ledger.get(p.id)!.matchesPlayed);
    expect(Math.max(...played) - Math.min(...played)).toBeLessThanOrEqual(1);
    expect(ledger.get("p02")!.matchesPlayed).toBe(4);
  });

  it("with two keepers, the keeper spot rotates too", () => {
    const players = squad(15, (i) => (i === 3 ? { keeper: true } : {}));
    const all = players.map((p) => p.id);
    const { ledger } = simulateSeason(players, [{ yes: all }, { yes: all }, { yes: all }, { yes: all }], rules);
    const played = players.map((p) => ledger.get(p.id)!.matchesPlayed);
    expect(Math.max(...played) - Math.min(...played)).toBeLessThanOrEqual(1);
  });

  it("a player left out for 2 weeks is picked in week 3", () => {
    const players = squad(14);
    const all = players.map((p) => p.id);
    const { plans } = simulateSeason(players, [{ yes: all }, { yes: all }, { yes: all }], rules);
    const xiIn = (week: number) => new Set(plans[week].picks.filter((p) => p.slot === "xi").map((p) => p.memberId));
    for (const p of players) {
      if (!xiIn(0).has(p.id) && !xiIn(1).has(p.id)) {
        expect(xiIn(2).has(p.id)).toBe(true);
      }
    }
  });

  it("late or unpaid players never displace on-time paid players", () => {
    const players = [...squad(12), { id: "late1", bowls: true }, { id: "unpaid1", bowls: true, paid: false }];
    const onTime = squad(12).map((p) => p.id).concat("unpaid1");
    const { plans } = simulateSeason(players, [{ yes: onTime, late: ["late1"] }], rules);
    const xi = plans[0].picks.filter((p) => p.slot === "xi").map((p) => p.memberId);
    expect(xi).not.toContain("late1");
    expect(xi).not.toContain("unpaid1");
    expect(plans[0].picks.find((p) => p.memberId === "unpaid1")!.slot).toBe("left_out");
  });

  it("late players fill the XI when the on-time pool is short", () => {
    const players = [...squad(9), { id: "late1" }, { id: "late2" }, { id: "late3" }];
    const { plans } = simulateSeason(players, [{ yes: squad(9).map((p) => p.id), late: ["late1", "late2", "late3"] }], rules);
    const xi = plans[0].picks.filter((p) => p.slot === "xi").map((p) => p.memberId);
    expect(xi).toHaveLength(11);
    expect(plans[0].picks.find((p) => p.slot === "twelfth")?.memberId).toMatch(/^late/);
  });

  it("long-term unavailability builds up no owed credit", () => {
    const players = squad(13, (i) => (i === 12 ? { unavailable: ["2027-05-01", "2027-05-02"] } : {}));
    const all = players.map((p) => p.id);
    const { ledger } = simulateSeason(players, [{ yes: all }, { yes: all }], rules);
    expect(ledger.get("p13")!.xi.owed).toBe(0);
    expect(ledger.get("p13")!.matchesPlayed).toBe(0);
  });

  it("a mid-season joiner starts level", () => {
    const players = squad(12, (i) => (i === 11 ? { joinedOn: "2027-05-03" } : {}));
    const all = players.map((p) => p.id);
    const { facts } = simulateSeason(players, [{ yes: all }, { yes: all }], rules);
    const ledgerBefore = computeLedger(facts, rules);
    expect(ledgerBefore.get("p12")!.xi.owed).toBe(0);
    expect(ledgerBefore.get("p12")!.xi.balance).toBe(0);
  });

  it("is deterministic", () => {
    const players = squad(16);
    const all = players.map((p) => p.id);
    const a = simulateSeason(players, [{ yes: all }, { yes: all }], rules);
    const b = simulateSeason(players, [{ yes: all }, { yes: all }], rules);
    expect(a.plans).toEqual(b.plans);
  });
});

describe("selection constraints", () => {
  it("always includes the captain and a wicketkeeper, and at least 5 bowlers when possible", () => {
    const players = squad(16, (i) => (i === 5 ? { captain: true } : {}));
    const facts = players.map((p) => makeFact(p, "f1", "2027-05-01", { answer: "yes", onTime: true, status: "locked" }));
    const plan = suggestSelection({ overs: 20, candidates: toCandidates(players, facts, new Map()), rules });
    const xi = plan.picks.filter((p) => p.slot === "xi").map((p) => p.memberId);
    expect(xi).toContain("p06");
    expect(xi).toContain("p02");
    expect(xi.filter((id) => players.find((p) => p.id === id)!.bowls).length).toBeGreaterThanOrEqual(5);
    expect(plan.warnings).toEqual([]);
  });

  it("warns instead of failing when a role is missing", () => {
    const players = squad(8).map((p) => ({ ...p, keeper: false, bowls: false }));
    const facts = players.map((p) => makeFact(p, "f1", "2027-05-01", { answer: "yes", onTime: true, status: "locked" }));
    const plan = suggestSelection({ overs: 20, candidates: toCandidates(players, facts, new Map()), rules });
    expect(plan.warnings.join(" ")).toMatch(/wicketkeeper/);
    expect(plan.warnings.join(" ")).toMatch(/Only 8 players/);
  });
});

describe("batting and bowling", () => {
  it("does not push a lower-order player up the order, and does not count it as unfair", () => {
    const players = squad(11, (i) => (i === 0 ? { batPref: "lower" as const } : {}));
    const all = players.map((p) => p.id);
    const { plans, ledger } = simulateSeason(players, [{ yes: all }, { yes: all }, { yes: all }], rules);
    for (const plan of plans) {
      const pos = plan.picks.find((p) => p.memberId === "p01")!.battingPosition!;
      expect(pos).toBeGreaterThanOrEqual(8);
    }
    expect(ledger.get("p01")!.bat.balance).toBeLessThanOrEqual(0);
  });

  it("rotates top-order slots so batting balances stay close", () => {
    const players = squad(11);
    const all = players.map((p) => p.id);
    const weeks = Array.from({ length: 11 }, () => ({ yes: all }));
    const { ledger } = simulateSeason(players, weeks, rules);
    const balances = players.map((p) => ledger.get(p.id)!.bat.balance);
    expect(Math.max(...balances) - Math.min(...balances)).toBeLessThanOrEqual(3);
  });

  it("never exceeds the overs cap and covers all overs when possible", () => {
    const players = squad(11).map((p) => ({ ...p, bowls: true }));
    const facts = players.map((p) => makeFact(p, "f1", "2027-05-01", { answer: "yes", onTime: true }));
    const warnings: string[] = [];
    const overs = planBowling(toCandidates(players, facts, new Map()), 20, rules, warnings);
    expect([...overs.values()].every((o) => o <= 4)).toBe(true);
    expect([...overs.values()].reduce((a, b) => a + b, 0)).toBe(20);
    expect(warnings).toEqual([]);
  });

  it("warns when bowlers cannot cover the innings", () => {
    const players = squad(11).map((p, i) => ({ ...p, bowls: i < 3 }));
    const facts = players.map((p) => makeFact(p, "f1", "2027-05-01", { answer: "yes", onTime: true }));
    const warnings: string[] = [];
    planBowling(toCandidates(players, facts, new Map()), 20, rules, warnings);
    expect(warnings[0]).toMatch(/12 of 20 overs/);
  });
});

describe("ledger details", () => {
  it("applies the competition weight", () => {
    const p = { id: "a" };
    const facts = [makeFact(p, "f1", "2027-05-01", { answer: "yes", onTime: true, fairnessWeight: 0.5 })];
    const ledger = computeLedger(facts, rules);
    expect(ledger.get("a")!.xi.owed).toBe(0.5);
  });

  it("ignores fixtures that are not played yet", () => {
    const facts = [makeFact({ id: "a" }, "f1", "2027-05-01", { answer: "yes", onTime: true, status: "selected" })];
    expect(computeLedger(facts, rules).size).toBe(0);
  });

  it("credits late players who played without owing them", () => {
    const facts = [makeFact({ id: "a" }, "f1", "2027-05-01", { answer: "yes", onTime: false, played: true, batPosition: 3 })];
    const entry = computeLedger(facts, rules).get("a")!;
    expect(entry.xi).toEqual({ owed: 0, given: 1, balance: -1 });
  });

  it("carries over part of last season's balance when configured", () => {
    const carried = new Map([["a", { xi: 2, bat: 0, bowl: 0 }]]);
    const ledger = computeLedger([], resolveRules({ carryOver: 0.5 }), carried);
    expect(ledger.get("a")!.xi.balance).toBe(1);
  });
});

describe("several matches in one day", () => {
  it("rotates players who missed the first match into the second", () => {
    const players = squad(15);
    const facts = players.map((p) => makeFact(p, "f1", "2027-05-01", { answer: "yes", onTime: true, status: "locked" }));
    const candidates = toCandidates(players, facts, new Map());
    const [first, second] = suggestDay([{ overs: 20, candidates }, { overs: 20, candidates }], rules);
    const firstXi = new Set(first.picks.filter((p) => p.slot === "xi").map((p) => p.memberId));
    const missed = players.filter((p) => !firstXi.has(p.id)).map((p) => p.id);
    const secondXi = second.picks.filter((p) => p.slot === "xi").map((p) => p.memberId);
    for (const id of missed) expect(secondXi).toContain(id);
  });
});

describe("rules", () => {
  it("fills missing rule keys with defaults and rejects bad values", () => {
    expect(resolveRules({ minBowlers: 4 }).minBowlers).toBe(4);
    expect(resolveRules({}).xiSize).toBe(11);
    expect(() => resolveRules({ carryOver: 2 })).toThrow();
  });
});
