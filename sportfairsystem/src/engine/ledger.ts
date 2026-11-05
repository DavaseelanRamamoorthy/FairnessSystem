import { classify } from "./eligibility";
import { batPrefCap, round2, weightOf } from "./rules";
import type { Account, FairnessRules, FixtureFact, Ledger, LedgerEntry } from "./types";

function emptyAccount(): Account {
  return { owed: 0, given: 0, balance: 0 };
}

function emptyEntry(memberId: string): LedgerEntry {
  return {
    memberId,
    xi: emptyAccount(),
    bat: emptyAccount(),
    bowl: emptyAccount(),
    matchesPlayed: 0,
    matchesEligible: 0,
    history: []
  };
}

function settle(account: Account) {
  account.owed = round2(account.owed);
  account.given = round2(account.given);
  account.balance = round2(account.owed - account.given);
}

/**
 * Computes three fairness accounts per player from played fixtures.
 *
 * - XI: every on-time eligible player is owed w * min(1, xiSize / pool).
 *   Anyone who actually played is given w.
 * - Batting: XI players share the batting weight the team actually used
 *   (top order counts more). Given = weight of the slot they batted in.
 * - Bowling: players who bowl (or did bowl) share the team's overs.
 *
 * Balance = owed - given. Positive means the team owes that player.
 */
export function computeLedger(
  facts: FixtureFact[],
  rules: FairnessRules,
  carriedBalances?: Map<string, { xi: number; bat: number; bowl: number }>
): Ledger {
  const ledger: Ledger = new Map();
  const entryFor = (memberId: string) => {
    let entry = ledger.get(memberId);
    if (!entry) {
      entry = emptyEntry(memberId);
      ledger.set(memberId, entry);
    }
    return entry;
  };

  const byFixture = new Map<string, FixtureFact[]>();
  for (const fact of facts) {
    if (fact.status !== "played") continue;
    const rows = byFixture.get(fact.fixtureId) ?? [];
    rows.push(fact);
    byFixture.set(fact.fixtureId, rows);
  }

  const fixtures = [...byFixture.values()].sort((a, b) =>
    a[0].matchDate === b[0].matchDate ? a[0].slot - b[0].slot : a[0].matchDate.localeCompare(b[0].matchDate)
  );

  for (const rows of fixtures) {
    const w = rows[0].fairnessWeight;
    const classes = new Map(rows.map((row) => [row.memberId, classify(row)] as const));
    const onTime = rows.filter((row) => classes.get(row.memberId) === "on_time");
    const xiOwedEach = onTime.length > 0 ? w * Math.min(1, rules.xiSize / onTime.length) : 0;

    const playedRows = rows.filter((row) => row.played);
    const usedBatWeight = playedRows.reduce((sum, row) => sum + weightOf(row.batPosition, rules), 0);
    const batOwedEach = playedRows.length > 0 ? (w * usedBatWeight) / playedRows.length : 0;

    const bowlingGroup = playedRows.filter((row) => row.bowls || row.ballsBowled > 0);
    const teamOvers = (rows[0].teamBallsBowled ?? 0) / 6;
    const bowlOwedEach = bowlingGroup.length > 0 ? (w * teamOvers) / bowlingGroup.length : 0;

    for (const row of rows) {
      const eligibility = classes.get(row.memberId)!;
      const entry = entryFor(row.memberId);
      const xiOwed = eligibility === "on_time" ? xiOwedEach : 0;
      const xiGiven = row.played ? w : 0;
      const batOwed = row.played ? Math.min(batOwedEach, w * batPrefCap(row.batPref, rules)) : 0;
      const batGiven = row.played ? w * weightOf(row.batPosition, rules) : 0;
      const inBowlingGroup = row.played && (row.bowls || row.ballsBowled > 0);
      const bowlOwed = inBowlingGroup ? bowlOwedEach : 0;
      const bowlGiven = row.played ? (w * row.ballsBowled) / 6 : 0;

      entry.xi.owed += xiOwed;
      entry.xi.given += xiGiven;
      entry.bat.owed += batOwed;
      entry.bat.given += batGiven;
      entry.bowl.owed += bowlOwed;
      entry.bowl.given += bowlGiven;
      if (row.played) entry.matchesPlayed += 1;
      if (eligibility === "on_time") entry.matchesEligible += 1;
      entry.history.push({
        fixtureId: row.fixtureId,
        matchDate: row.matchDate,
        eligibility,
        played: row.played,
        xi: { owed: round2(xiOwed), given: round2(xiGiven) },
        bat: { owed: round2(batOwed), given: round2(batGiven), position: row.batPosition },
        bowl: { owed: round2(bowlOwed), given: round2(bowlGiven) }
      });
    }
  }

  if (carriedBalances && rules.carryOver > 0) {
    for (const [memberId, carried] of carriedBalances) {
      const entry = entryFor(memberId);
      entry.xi.owed += carried.xi * rules.carryOver;
      entry.bat.owed += carried.bat * rules.carryOver;
      entry.bowl.owed += carried.bowl * rules.carryOver;
    }
  }

  for (const entry of ledger.values()) {
    settle(entry.xi);
    settle(entry.bat);
    settle(entry.bowl);
  }
  return ledger;
}

export function balanceOf(ledger: Ledger, memberId: string) {
  const entry = ledger.get(memberId);
  return {
    xi: entry?.xi.balance ?? 0,
    bat: entry?.bat.balance ?? 0,
    bowl: entry?.bowl.balance ?? 0
  };
}
