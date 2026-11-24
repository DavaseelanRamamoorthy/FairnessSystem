import { describe, expect, it } from "vitest";
import { nameKey, resolveName, type Identity } from "./nameMatching";
import { checkScorecard, oversToBalls, scorecardSchema } from "./scorecardSchema";

describe("nameKey", () => {
  it("drops annotations, punctuation and case", () => {
    expect(nameKey("Davaseelan (wk)")).toBe("davaseelan");
    expect(nameKey("  Anir   C. ")).toBe("anir c");
    expect(nameKey("Jürgen")).toBe("jürgen");
  });
});

describe("resolveName", () => {
  const members = [
    { id: "m1", displayName: "Anirban" },
    { id: "m2", displayName: "Davaseelan Ramamoorthy" },
    { id: "m3", displayName: "Gaurav Patil" }
  ];
  const identities: Identity[] = [
    { memberId: "m1", source: "cricheroes", externalId: "1134459", nameKey: "anir" },
    { memberId: "m1", source: "spond", externalId: null, nameKey: "anir c" }
  ];

  it("matches by CricHeroes id even when the name differs", () => {
    expect(resolveName({ name: "A. Champ", externalId: "1134459" }, "cricheroes", identities, members)).toEqual({
      status: "matched", memberId: "m1", via: "external_id"
    });
  });

  it("matches a known Spond name exactly", () => {
    expect(resolveName({ name: "Anir C" }, "spond", identities, members)).toMatchObject({ status: "matched", memberId: "m1" });
  });

  it("only suggests (never assigns) shortened names", () => {
    const result = resolveName({ name: "Davaseelan R" }, "spond", identities, members);
    expect(result.status).toBe("suggested");
    if (result.status === "suggested") expect(result.suggestions[0].memberId).toBe("m2");
  });

  it("leaves strangers unresolved", () => {
    expect(resolveName({ name: "Opponent Guy" }, "cricheroes", identities, members)).toEqual({ status: "unresolved" });
  });
});

describe("scorecard", () => {
  it("converts overs to balls", () => {
    expect(oversToBalls("19.4")).toBe(118);
    expect(oversToBalls(20)).toBe(120);
    expect(() => oversToBalls("19.7")).toThrow();
  });

  const card = {
    source: "cricheroes" as const,
    match_date: "2027-05-02",
    our_team: "Moonwalkers",
    opponent: "Rivals",
    overs: 20,
    innings: [
      {
        innings_no: 1, team_name: "Moonwalkers", ours: true, runs: 25, wickets: 1, overs: "3.0", extras: 5,
        batting: [
          { name: "A", position: 1, runs: 12, balls: 9, not_out: true },
          { name: "B", position: 2, runs: 8, balls: 7, how_out: "b X" },
          { name: "C", position: 3, runs: 0, balls: 2, not_out: true }
        ],
        bowling: [
          { name: "X", overs: "2.0", runs: 15, wickets: 1 },
          { name: "Y", overs: 1, runs: 10, wickets: 0 }
        ]
      }
    ]
  };

  it("parses and passes arithmetic checks", () => {
    const parsed = scorecardSchema.parse(card);
    expect(parsed.innings[0].overs).toBe(18);
    expect(checkScorecard(parsed)).toEqual([]);
  });

  it("reports totals that do not add up", () => {
    const parsed = scorecardSchema.parse({ ...card, innings: [{ ...card.innings[0], runs: 30 }] });
    expect(checkScorecard(parsed)[0]).toMatch(/total is 30/);
  });
});
