import type { BatPref, FixtureFact, SeasonRole } from "@/src/engine/types";

/** One row of the `v_fixture_facts` view, as Supabase returns it. */
export type FactRow = {
  fixture_id: string;
  season_id: string;
  match_date: string;
  slot: number;
  status: FixtureFact["status"];
  overs: number;
  fairness_weight: number | string;
  competition_kind: string;
  member_id: string;
  bowls: boolean;
  is_wicketkeeper: boolean;
  bat_pref: BatPref;
  season_role: SeasonRole | null;
  joined_on: string | null;
  left_on: string | null;
  membership_paid: boolean | null;
  unavailable: boolean;
  answer: FixtureFact["answer"];
  on_time: boolean;
  selected_slot: "xi" | "twelfth" | "reserve" | null;
  planned_bat_pos: number | null;
  planned_overs: number | null;
  played: boolean;
  bat_position: number | null;
  balls_bowled: number;
  team_balls_bowled: number;
};

export function rowToFact(row: FactRow): FixtureFact {
  return {
    fixtureId: row.fixture_id,
    seasonId: row.season_id,
    matchDate: row.match_date,
    slot: row.slot,
    status: row.status,
    overs: row.overs,
    // numeric columns arrive as strings from PostgREST
    fairnessWeight: Number(row.fairness_weight),
    memberId: row.member_id,
    bowls: row.bowls,
    isWicketkeeper: row.is_wicketkeeper,
    batPref: row.bat_pref,
    seasonRole: row.season_role,
    joinedOn: row.joined_on,
    leftOn: row.left_on,
    membershipPaid: Boolean(row.membership_paid),
    unavailable: row.unavailable,
    answer: row.answer,
    onTime: row.on_time,
    played: row.played,
    batPosition: row.bat_position,
    ballsBowled: row.balls_bowled,
    teamBallsBowled: row.team_balls_bowled
  };
}

/** Planned-vs-actual differences after a scorecard is imported. */
export function selectionDifferences(rows: FactRow[]) {
  return {
    pickedButDidNotPlay: rows.filter((r) => r.selected_slot === "xi" && !r.played).map((r) => r.member_id),
    playedFromOutsideXi: rows.filter((r) => r.selected_slot !== "xi" && r.played).map((r) => r.member_id)
  };
}

export function defaultWeight(kind: "friendly_series" | "tournament" | "league") {
  return kind === "tournament" ? 0.5 : 1;
}

/** Default Spond deadline as a `datetime-local` value: N days before, at 20:00. */
export function defaultDeadline(matchDate: string, daysBefore: number) {
  const d = new Date(`${matchDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - daysBefore);
  return `${d.toISOString().slice(0, 10)}T20:00`;
}
