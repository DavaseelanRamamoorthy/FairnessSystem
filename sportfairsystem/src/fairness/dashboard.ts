// Pure summaries for the all-seasons dashboard: results per season, leaders,
// and head-to-head records. No database code here, so it is easy to test.

export type DashFixture = {
  id: string;
  season_year: number;
  match_date: string;
  slot: number;
  opponent: string;
  status: string;
  result: "won" | "lost" | "tied" | "no_result" | null;
  result_summary: string | null;
  competition_kind: string;
};

export type DashStats = {
  season_year: number;
  member_id: string;
  matches: number;
  innings: number;
  not_outs: number;
  runs: number;
  balls_faced: number;
  high_score: number | null;
  balls_bowled: number;
  runs_conceded: number;
  wickets: number;
};

export type SeasonResult = { year: number; played: number; won: number; lost: number; tied: number; abandoned: number };

export type Leader = {
  memberId: string;
  name: string;
  matches: number;
  runs: number;
  innings: number;
  average: number | null;
  strikeRate: number | null;
  highScore: number | null;
  wickets: number;
  ballsBowled: number;
  economy: number | null;
};

/** Opponent names drift on CricHeroes ("Vaadivasal OG 1", "Team BISKUT", "HCC ( Hennigsdorf Cricket Club)"). */
export function opponentKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/^team\s+/, "")
    .replace(/\b(e\.?v\.?|cc|cricket club)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s\d+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function seasonResults(fixtures: DashFixture[]): SeasonResult[] {
  const by = new Map<number, SeasonResult>();
  for (const f of fixtures) {
    const row = by.get(f.season_year) ?? { year: f.season_year, played: 0, won: 0, lost: 0, tied: 0, abandoned: 0 };
    if (f.status === "abandoned") row.abandoned += 1;
    else if (f.status === "played") {
      row.played += 1;
      if (f.result === "won") row.won += 1;
      else if (f.result === "lost") row.lost += 1;
      else if (f.result === "tied") row.tied += 1;
    }
    by.set(f.season_year, row);
  }
  return [...by.values()].sort((a, b) => a.year - b.year);
}

export function totals(results: SeasonResult[]) {
  const sum = results.reduce(
    (t, r) => ({ played: t.played + r.played, won: t.won + r.won, lost: t.lost + r.lost, tied: t.tied + r.tied, abandoned: t.abandoned + r.abandoned }),
    { played: 0, won: 0, lost: 0, tied: 0, abandoned: 0 }
  );
  return { ...sum, winRate: sum.played > 0 ? Math.round((sum.won / sum.played) * 100) : null };
}

export function leaders(stats: DashStats[], names: Map<string, string>): Leader[] {
  const by = new Map<string, Leader & { notOuts: number; ballsFaced: number; runsConceded: number }>();
  for (const s of stats) {
    const l = by.get(s.member_id) ?? {
      memberId: s.member_id, name: names.get(s.member_id) ?? "Unknown player", matches: 0, runs: 0, innings: 0, notOuts: 0,
      ballsFaced: 0, highScore: null, wickets: 0, ballsBowled: 0, runsConceded: 0, average: null, strikeRate: null, economy: null
    };
    l.matches += s.matches;
    l.runs += s.runs;
    l.innings += s.innings;
    l.notOuts += s.not_outs;
    l.ballsFaced += s.balls_faced;
    l.highScore = s.high_score === null ? l.highScore : Math.max(l.highScore ?? 0, s.high_score);
    l.wickets += s.wickets;
    l.ballsBowled += s.balls_bowled;
    l.runsConceded += s.runs_conceded;
    by.set(s.member_id, l);
  }
  return [...by.values()].map(({ notOuts, ballsFaced, runsConceded, ...l }) => ({
    ...l,
    average: l.innings - notOuts > 0 ? round1(l.runs / (l.innings - notOuts)) : null,
    strikeRate: ballsFaced > 0 ? round1((l.runs * 100) / ballsFaced) : null,
    economy: l.ballsBowled > 0 ? round2((runsConceded * 6) / l.ballsBowled) : null
  }));
}

/** Top N by a measure, with a minimum so one lucky innings doesn't top the table. */
export function top<K extends keyof Leader>(rows: Leader[], key: K, n: number, opts: { min?: (l: Leader) => boolean; ascending?: boolean } = {}) {
  return rows
    .filter((l) => l[key] !== null && (opts.min ? opts.min(l) : true))
    .sort((a, b) => ((opts.ascending ? 1 : -1) * ((a[key] as number) - (b[key] as number))) || a.name.localeCompare(b.name))
    .slice(0, n);
}

export type HeadToHead = { opponent: string; played: number; won: number; lost: number; tied: number };

export function headToHead(fixtures: DashFixture[]): HeadToHead[] {
  const by = new Map<string, HeadToHead & { names: Map<string, number> }>();
  for (const f of fixtures) {
    if (f.status !== "played") continue;
    const key = opponentKey(f.opponent);
    const row = by.get(key) ?? { opponent: f.opponent, played: 0, won: 0, lost: 0, tied: 0, names: new Map() };
    row.played += 1;
    if (f.result === "won") row.won += 1;
    else if (f.result === "lost") row.lost += 1;
    else if (f.result === "tied") row.tied += 1;
    row.names.set(f.opponent, (row.names.get(f.opponent) ?? 0) + 1);
    by.set(key, row);
  }
  return [...by.values()]
    .map(({ names, ...row }) => ({ ...row, opponent: [...names.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.played - a.played || a.opponent.localeCompare(b.opponent));
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
