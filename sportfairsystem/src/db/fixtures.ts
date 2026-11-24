"use client";

import type { FactRow } from "@/src/fairness/facts";
import { fetchAll, supabase } from "./client";

export type CompetitionKind = "friendly_series" | "tournament" | "league";

export type Competition = {
  id: string;
  season_id: string;
  name: string;
  kind: CompetitionKind;
  fairness_weight: number;
};

export type FixtureStatus = "open" | "locked" | "selected" | "played" | "abandoned";

export type Fixture = {
  id: string;
  competition_id: string;
  match_date: string;
  slot: number;
  opponent: string;
  ground: string | null;
  overs: number;
  availability_deadline: string | null;
  status: FixtureStatus;
  result: "won" | "lost" | "tied" | "no_result" | null;
  result_summary: string | null;
  competition: Competition;
};

export type SelectionRow = {
  fixture_id: string;
  member_id: string;
  slot: "xi" | "twelfth" | "reserve";
  planned_bat_pos: number | null;
  planned_overs: number | null;
  reason: string | null;
  overridden: boolean;
  override_note: string | null;
  published_at: string | null;
};

export type BattingRow = {
  id: string;
  member_id: string | null;
  name_raw: string;
  position: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  how_out: string | null;
  not_out: boolean;
  did_bat: boolean;
};

export type BowlingRow = {
  id: string;
  member_id: string | null;
  name_raw: string;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
};

export type InningsRow = {
  id: string;
  innings_no: number;
  ours: boolean;
  team_name: string;
  runs: number;
  wickets: number;
  balls: number;
  extras: number;
  batting: BattingRow[];
  bowling: BowlingRow[];
};

export type PlayerStats = {
  season_id: string;
  member_id: string;
  matches: number;
  innings: number;
  not_outs: number;
  runs: number;
  balls_faced: number;
  high_score: number | null;
  batting_average: number | null;
  strike_rate: number | null;
  balls_bowled: number;
  runs_conceded: number;
  wickets: number;
  economy: number | null;
  bowling_average: number | null;
};

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

function must<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

const FIXTURE_SELECT = "*, competition:competitions!inner(id, season_id, name, kind, fairness_weight)";

function normaliseFixture(row: Fixture): Fixture {
  return { ...row, competition: { ...row.competition, fairness_weight: Number(row.competition.fairness_weight) } };
}

// ---------------------------------------------------------------- competitions & fixtures

export async function loadCompetitions(seasonId: string) {
  const rows = must(await supabase().from("competitions").select("*").eq("season_id", seasonId).order("name")) as Competition[];
  return rows.map((c) => ({ ...c, fairness_weight: Number(c.fairness_weight) }));
}

export async function createCompetition(seasonId: string, name: string, kind: CompetitionKind, weight: number) {
  return must(
    await supabase()
      .from("competitions")
      .insert({ season_id: seasonId, name: name.trim(), kind, fairness_weight: weight })
      .select("id")
      .single()
  ) as { id: string };
}

export async function loadFixtures(seasonId: string) {
  const rows = await fetchAll<Fixture>((from, to) =>
    supabase()
      .from("fixtures")
      .select(FIXTURE_SELECT)
      .eq("competition.season_id", seasonId)
      .order("match_date")
      .order("slot")
      .range(from, to)
      .overrideTypes<Fixture[], { merge: false }>()
  );
  return rows.map(normaliseFixture);
}

export async function loadFixture(id: string) {
  const row = must(await supabase().from("fixtures").select(FIXTURE_SELECT).eq("id", id).maybeSingle()) as Fixture | null;
  return row ? normaliseFixture(row) : null;
}

export type FixtureInput = {
  competition_id: string;
  match_date: string;
  slot: number;
  opponent: string;
  ground: string | null;
  overs: number;
  availability_deadline: string | null;
};

export async function createFixture(input: FixtureInput) {
  return must(await supabase().from("fixtures").insert(input).select("id").single()) as { id: string };
}

export async function updateFixture(id: string, patch: Partial<FixtureInput>) {
  must(await supabase().from("fixtures").update(patch).eq("id", id));
}

export async function deleteFixture(id: string) {
  must(await supabase().from("fixtures").delete().eq("id", id));
}

export function reopenFixture(id: string, reason: string) {
  return rpc<void>("reopen_fixture", { p_fixture: id, p_reason: reason });
}

// ---------------------------------------------------------------- facts, availability, selection

export function loadSeasonFacts(seasonId: string) {
  return fetchAll<FactRow>((from, to) =>
    supabase()
      .from("v_fixture_facts")
      .select("*")
      .eq("season_id", seasonId)
      .order("match_date")
      .range(from, to)
      .overrideTypes<FactRow[], { merge: false }>()
  );
}

export function setAvailability(fixtureId: string, memberId: string, answer: "yes" | "no" | "maybe") {
  return rpc<void>("set_availability", { p_fixture: fixtureId, p_member: memberId, p_answer: answer });
}

export function importAvailability(fixtureId: string, entries: Array<{ member_id: string; answer: string }>, payload: unknown) {
  return rpc<number>("import_availability_snapshot", {
    p_fixture: fixtureId,
    p_entries: entries,
    p_source: "spond",
    p_payload: payload
  });
}

export async function loadSelections(fixtureId: string) {
  return must(await supabase().from("selections").select("*").eq("fixture_id", fixtureId)) as SelectionRow[];
}

export type PickInput = {
  member_id: string;
  slot: "xi" | "twelfth" | "reserve";
  planned_bat_pos: number | null;
  planned_overs: number | null;
  reason: string;
  overridden: boolean;
  override_note: string | null;
};

export function saveSelection(fixtureId: string, picks: PickInput[]) {
  return rpc<void>("save_selection", { p_fixture: fixtureId, p_picks: picks });
}

export function publishSelection(fixtureId: string) {
  return rpc<void>("publish_selection", { p_fixture: fixtureId });
}

// ---------------------------------------------------------------- scorecard & stats

export function importScorecard(fixtureId: string, payload: unknown, source: "cricheroes" | "pdf" | "manual") {
  return rpc<void>("import_scorecard", { p_fixture: fixtureId, p_payload: payload, p_source: source });
}

export async function loadScorecard(fixtureId: string) {
  const rows = must(
    await supabase().from("innings").select("*, batting(*), bowling(*)").eq("fixture_id", fixtureId).order("innings_no")
  ) as InningsRow[];
  return rows.map((inn) => ({
    ...inn,
    batting: [...inn.batting].sort((a, b) => a.position - b.position),
    bowling: inn.bowling
  }));
}

export function loadPlayerStats(seasonId: string) {
  return fetchAll<PlayerStats>((from, to) =>
    supabase()
      .from("v_player_stats")
      .select("*")
      .eq("season_id", seasonId)
      .range(from, to)
      .overrideTypes<PlayerStats[], { merge: false }>()
  );
}
