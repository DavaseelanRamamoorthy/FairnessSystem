// Loads every season's results and player stats for the dashboard.
import type { DashFixture, DashStats } from "@/src/fairness/dashboard";
import { fetchAll, supabase } from "./client";

type FixtureRow = Omit<DashFixture, "season_year" | "competition_kind"> & {
  competition: { kind: string; season: { year: number } };
};
type StatsRow = Omit<DashStats, "season_year"> & { season_id: string };

export async function loadDashboard(teamId: string) {
  const db = supabase();
  const [seasons, fixtures, stats, members] = await Promise.all([
    db.from("seasons").select("id, year").eq("team_id", teamId).order("year"),
    fetchAll<FixtureRow>((from, to) =>
      db
        .from("fixtures")
        .select("id, match_date, slot, opponent, status, result, result_summary, competition:competitions!inner(kind, season:seasons!inner(year, team_id))")
        .eq("competition.season.team_id", teamId)
        .order("match_date")
        .order("slot")
        .range(from, to)
        .overrideTypes<FixtureRow[], { merge: false }>()
    ),
    fetchAll<StatsRow>((from, to) =>
      db.from("v_player_stats").select("*").range(from, to).overrideTypes<StatsRow[], { merge: false }>()
    ),
    fetchAll<{ id: string; display_name: string }>((from, to) =>
      db.from("members").select("id, display_name").eq("team_id", teamId).is("merged_into", null).range(from, to)
    )
  ]);
  if (seasons.error) throw new Error(seasons.error.message);
  const yearOf = new Map((seasons.data ?? []).map((s) => [s.id as string, s.year as number]));
  return {
    years: (seasons.data ?? []).map((s) => s.year as number),
    fixtures: fixtures.map<DashFixture>(({ competition, ...f }) => ({
      ...f,
      season_year: competition.season.year,
      competition_kind: competition.kind
    })),
    stats: stats
      .filter((s) => yearOf.has(s.season_id))
      .map<DashStats>(({ season_id, ...s }) => ({ ...s, season_year: yearOf.get(season_id)! })),
    names: new Map(members.map((m) => [m.id, m.display_name]))
  };
}
