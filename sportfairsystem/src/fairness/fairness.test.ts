import { describe, expect, it } from "vitest";
import { computeLedger } from "@/src/engine/ledger";
import { suggestSelection } from "@/src/engine/planner";
import { DEFAULT_RULES } from "@/src/engine/rules";
import { scorecardSchema } from "@/src/import/scorecardSchema";
import { spondSnapshotSchema } from "@/src/import/spondSchema";
import type { Identity } from "@/src/import/nameMatching";
import { buildCandidates, type MemberInfo } from "./candidates";
import { defaultDeadline, defaultWeight, rowToFact, selectionDifferences, type FactRow } from "./facts";
import { allDecided, prepareNames, scorecardNames, scorecardPayload, spondEntries, spondNames } from "./imports";

function row(memberId: string, extra: Partial<FactRow> = {}): FactRow {
  return {
    fixture_id: "f1",
    season_id: "s1",
    match_date: "2027-05-08",
    slot: 1,
    status: "locked",
    overs: 20,
    fairness_weight: "1.00",
    competition_kind: "friendly_series",
    member_id: memberId,
    bowls: false,
    is_wicketkeeper: false,
    bat_pref: "flexible",
    season_role: "player",
    joined_on: "2027-04-01",
    left_on: null,
    membership_paid: true,
    unavailable: false,
    answer: "yes",
    on_time: true,
    selected_slot: null,
    planned_bat_pos: null,
    planned_overs: null,
    played: false,
    bat_position: null,
    balls_bowled: 0,
    team_balls_bowled: 0,
    ...extra
  };
}

describe("facts and candidates", () => {
  it("maps view rows, including numeric weights sent as text", () => {
    const fact = rowToFact(row("a", { fairness_weight: "0.50", membership_paid: null }));
    expect(fact.fairnessWeight).toBe(0.5);
    expect(fact.membershipPaid).toBe(false);
  });

  it("builds candidates with eligibility, captain flag and names", () => {
    const rows = [
      row("cap", { season_role: "captain" }),
      row("late", { on_time: false }),
      row("unpaid", { membership_paid: false }),
      row("away", { unavailable: true }),
      row("ok")
    ];
    const members = new Map<string, MemberInfo>(
      rows.map((r) => [r.member_id, { id: r.member_id, display_name: r.member_id.toUpperCase(), bowl_pref: "flexible" }])
    );
    const candidates = buildCandidates(rows.map(rowToFact), new Map(), members);
    const byId = Object.fromEntries(candidates.map((c) => [c.memberId, c]));
    expect(byId.cap).toMatchObject({ isCaptain: true, eligibility: "on_time", name: "CAP" });
    expect(byId.late.eligibility).toBe("late");
    expect(byId.unpaid.eligibility).toBe("unpaid");
    expect(byId.away.eligibility).toBe("unavailable");

    const plan = suggestSelection({ overs: 20, candidates, rules: DEFAULT_RULES });
    const slot = (id: string) => plan.picks.find((p) => p.memberId === id)?.slot;
    expect(slot("cap")).toBe("xi");
    expect(slot("unpaid")).toBe("left_out");
    expect(slot("away")).toBe("left_out");
  });

  it("gives a tournament match half the owed weight", () => {
    const facts = [row("a", { status: "played", fairness_weight: "0.50" })].map(rowToFact);
    expect(computeLedger(facts, DEFAULT_RULES).get("a")!.xi.owed).toBe(0.5);
    expect(defaultWeight("tournament")).toBe(0.5);
    expect(defaultWeight("friendly_series")).toBe(1);
  });

  it("keeps a stats-only match (weight 0) at zero, never NaN", () => {
    const facts = [row("a", { status: "played", fairness_weight: "0.00", played: true, bat_position: 3 })].map(rowToFact);
    const entry = computeLedger(facts, DEFAULT_RULES).get("a")!;
    expect(entry.bat.owed).toBe(0);
    expect(entry.bat.given).toBe(0);
    expect(entry.xi.given).toBe(0);
  });

  it("lists planned-vs-actual differences", () => {
    const diff = selectionDifferences([
      row("a", { selected_slot: "xi", played: false }),
      row("b", { selected_slot: "reserve", played: true }),
      row("c", { selected_slot: "xi", played: true })
    ]);
    expect(diff).toEqual({ pickedButDidNotPlay: ["a"], playedFromOutsideXi: ["b"] });
  });

  it("puts the default deadline 2 days before at 20:00", () => {
    expect(defaultDeadline("2027-05-08", 2)).toBe("2027-05-06T20:00");
    expect(defaultDeadline("2027-05-01", 2)).toBe("2027-04-29T20:00");
  });
});

const members = [
  { id: "m1", displayName: "Anirban" },
  { id: "m2", displayName: "Davaseelan Ramamoorthy" }
];
const identities: Identity[] = [
  { memberId: "m1", source: "spond", externalId: null, nameKey: "anir c" },
  { memberId: "m1", source: "cricheroes", externalId: "1134459", nameKey: "anir" }
];

describe("Spond import", () => {
  const snapshot = spondSnapshotSchema.parse({
    source: "spond",
    event_title: "Saturday friendly",
    event_date: "2027-05-08",
    captured_at: "2027-05-06T20:00:00+02:00",
    responses: [
      { name: "Anir C", answer: "yes" },
      { name: "Davaseelan R", answer: "maybe" },
      { name: "Stranger", answer: "unanswered" }
    ]
  });

  it("matches known names and waits for a decision on the rest", () => {
    const rows = prepareNames(spondNames(snapshot), "spond", identities, members);
    expect(rows[0].decision).toEqual({ kind: "member", memberId: "m1", remember: false });
    expect(rows[1].resolution.status).toBe("suggested");
    expect(allDecided(rows)).toBe(false);
  });

  it("drops unanswered, keeps maybe as not available, and remembers confirmed names", () => {
    const rows = prepareNames(spondNames(snapshot), "spond", identities, members);
    rows[1].decision = { kind: "member", memberId: "m2", remember: true };
    rows[2].decision = { kind: "skip" };
    expect(spondEntries(snapshot, rows)).toEqual([
      { member_id: "m1", answer: "yes" },
      { member_id: "m2", answer: "maybe" }
    ]);
  });
});

describe("scorecard import", () => {
  const card = scorecardSchema.parse({
    source: "cricheroes",
    cricheroes_match_ref: "555",
    match_date: "2027-05-08",
    our_team: "Moonwalkers",
    opponent: "Rivals",
    overs: 20,
    result: "won",
    innings: [
      {
        innings_no: 1, team_name: "Moonwalkers", ours: true, runs: 20, wickets: 1, overs: "2.0", extras: 0,
        batting: [
          { name: "Anir", cricheroes_player_id: "1134459", position: 1, runs: 12, balls: 7, how_out: "b X" },
          { name: "Dava", position: 2, runs: 8, balls: 5, not_out: true }
        ],
        bowling: [{ name: "Opp Bowler", overs: "2.0", runs: 20, wickets: 1 }]
      },
      {
        innings_no: 2, team_name: "Rivals", ours: false, runs: 10, wickets: 0, overs: "1.0", extras: 0,
        batting: [{ name: "Opp Batter", position: 1, runs: 10, balls: 6, not_out: true }],
        bowling: [{ name: "Anir", cricheroes_player_id: "1134459", overs: "1.0", runs: 10, wickets: 0 }]
      }
    ]
  });

  it("only asks about our own players", () => {
    const names = scorecardNames(card).map((n) => n.name);
    expect(names).toEqual(["Anir", "Dava", "Anir"]);
    expect(names).not.toContain("Opp Batter");
    expect(names).not.toContain("Opp Bowler");
  });

  it("links our players by id and leaves the opposition unlinked", () => {
    const rows = prepareNames(scorecardNames(card), "cricheroes", identities, members);
    expect(rows).toHaveLength(2); // Anir appears twice but is resolved once
    rows[1].decision = { kind: "member", memberId: "m2", remember: true };
    const payload = scorecardPayload(card, rows);
    expect(payload.innings[0].batting.map((b) => b.member_id)).toEqual(["m1", "m2"]);
    expect(payload.innings[0].bowling[0].member_id).toBeNull();
    expect(payload.innings[1].batting[0].member_id).toBeNull();
    expect(payload.innings[1].bowling[0]).toMatchObject({ member_id: "m1", balls: 6 });
    expect(payload.new_identities).toEqual([{ member_id: "m2", source: "cricheroes", external_id: null, display_name: "Dava" }]);
  });

  it("pre-selects a member with exactly the same name, but not initials", () => {
    const rows = prepareNames([{ name: "Anirban" }, { name: "Davaseelan R" }], "pdf", [], members);
    expect(rows[0].decision).toEqual({ kind: "member", memberId: "m1", remember: true });
    expect(rows[1].decision).toBeNull();
  });

  it("keeps guests as names only", () => {
    const rows = prepareNames(scorecardNames(card), "cricheroes", identities, members);
    rows[1].decision = { kind: "guest" };
    const payload = scorecardPayload(card, rows);
    expect(payload.innings[0].batting[1]).toMatchObject({ member_id: null, name: "Dava" });
    expect(payload.new_identities).toEqual([]);
  });
});
