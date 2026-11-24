import { describe, expect, it } from "vitest";
import { headToHead, leaders, opponentKey, seasonResults, top, totals, type DashFixture, type DashStats } from "./dashboard";

const fx = (id: string, year: number, opponent: string, result: DashFixture["result"], status = "played"): DashFixture => ({
  id, season_year: year, match_date: `${year}-05-01`, slot: 1, opponent, status, result, result_summary: null, competition_kind: "friendly_series"
});

describe("dashboard summaries", () => {
  const fixtures = [
    fx("1", 2025, "Vaadivasal OG 1", "won"),
    fx("2", 2025, "Vaadivasal OG", "lost"),
    fx("3", 2026, "Team BISKUT", "won"),
    fx("4", 2026, "BISKUT", "tied"),
    fx("5", 2026, "Deccan Chargers", null, "abandoned")
  ];

  it("counts results per season and overall", () => {
    expect(seasonResults(fixtures)).toEqual([
      { year: 2025, played: 2, won: 1, lost: 1, tied: 0, abandoned: 0 },
      { year: 2026, played: 2, won: 1, lost: 0, tied: 1, abandoned: 1 }
    ]);
    expect(totals(seasonResults(fixtures))).toMatchObject({ played: 4, won: 2, winRate: 50 });
  });

  it("treats CricHeroes spellings of one opponent as one", () => {
    expect(opponentKey("HCC ( Hennigsdorf Cricket Club)")).toBe("hcc");
    expect(opponentKey("Berlin Super Kings.e.V")).toBe(opponentKey("Berlin Super Kings"));
    const h2h = headToHead(fixtures);
    expect(h2h.map((h) => [h.played, h.won, h.lost, h.tied])).toEqual([[2, 1, 0, 1], [2, 1, 1, 0]]);
  });

  it("adds up a player across seasons and applies minimums", () => {
    const stats: DashStats[] = [
      { season_year: 2025, member_id: "a", matches: 10, innings: 10, not_outs: 2, runs: 200, balls_faced: 160, high_score: 50, balls_bowled: 60, runs_conceded: 70, wickets: 5 },
      { season_year: 2026, member_id: "a", matches: 5, innings: 5, not_outs: 0, runs: 100, balls_faced: 90, high_score: 61, balls_bowled: 0, runs_conceded: 0, wickets: 0 },
      { season_year: 2026, member_id: "b", matches: 1, innings: 1, not_outs: 0, runs: 90, balls_faced: 30, high_score: 90, balls_bowled: 6, runs_conceded: 2, wickets: 1 }
    ];
    const rows = leaders(stats, new Map([["a", "Anir"], ["b", "Guesty"]]));
    const anir = rows.find((r) => r.memberId === "a")!;
    expect(anir).toMatchObject({ matches: 15, runs: 300, average: 23.1, strikeRate: 120, highScore: 61, wickets: 5, economy: 7 });
    expect(top(rows, "average", 3, { min: (l) => l.innings >= 5 }).map((r) => r.name)).toEqual(["Anir"]);
    expect(top(rows, "economy", 3, { ascending: true }).map((r) => r.name)).toEqual(["Guesty", "Anir"]);
  });
});
