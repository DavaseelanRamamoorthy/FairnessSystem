// Turns validated Spond snapshots and scorecards into the payloads the
// import RPCs expect, after a person has confirmed who each name is.
import { nameKey, resolveName, type Identity, type IdentitySource, type MemberRef, type Resolution } from "@/src/import/nameMatching";
import type { Scorecard } from "@/src/import/scorecardSchema";
import type { SpondSnapshot } from "@/src/import/spondSchema";

export type OutsideName = { name: string; externalId?: string | null };

/** What the captain decided for one outside name. */
export type NameDecision =
  | { kind: "member"; memberId: string; remember: boolean }
  | { kind: "guest" } // scorecards: keep the name, no member
  | { kind: "skip" }; // Spond: ignore this name

export const decisionKey = (outside: OutsideName) => outside.externalId ? `id:${outside.externalId}` : `name:${nameKey(outside.name)}`;

export type NameRow = { outside: OutsideName; resolution: Resolution; decision: NameDecision | null };

/** Resolves each distinct name; exact matches get a decision straight away. */
export function prepareNames(names: OutsideName[], source: IdentitySource, identities: Identity[], members: MemberRef[]): NameRow[] {
  const seen = new Set<string>();
  const rows: NameRow[] = [];
  for (const outside of names) {
    const key = decisionKey(outside);
    if (seen.has(key)) continue;
    seen.add(key);
    const resolution = resolveName(outside, source, identities, members);
    // Pre-select (but still show) a single member with exactly the same name;
    // shortened names and initials always wait for a person to choose.
    const sameName = resolution.status === "suggested" ? resolution.suggestions.filter((s) => s.why === "same name") : [];
    rows.push({
      outside,
      resolution,
      decision:
        resolution.status === "matched"
          ? { kind: "member", memberId: resolution.memberId, remember: false }
          : sameName.length === 1
            ? { kind: "member", memberId: sameName[0].memberId, remember: true }
            : null
    });
  }
  return rows;
}

export const allDecided = (rows: NameRow[]) => rows.every((row) => row.decision !== null);

function decisionsByKey(rows: NameRow[]) {
  return new Map(rows.map((row) => [decisionKey(row.outside), row] as const));
}

/** Confirmed new names to remember, so the next import matches them automatically. */
function newIdentities(rows: NameRow[], source: IdentitySource) {
  return rows.flatMap((row) =>
    row.decision?.kind === "member" && row.decision.remember && row.resolution.status !== "matched"
      ? [{ member_id: row.decision.memberId, source, external_id: row.outside.externalId ?? null, display_name: row.outside.name }]
      : []
  );
}

// ---------------------------------------------------------------- Spond

export function spondNames(snapshot: SpondSnapshot): OutsideName[] {
  return snapshot.responses.map((r) => ({ name: r.name }));
}

/**
 * Entries for import_availability_snapshot. "unanswered" is left out (no answer
 * means not available); "maybe" is stored but never counts as available.
 */
export function spondEntries(snapshot: SpondSnapshot, rows: NameRow[]) {
  const byKey = decisionsByKey(rows);
  const entries = new Map<string, { member_id: string; answer: "yes" | "no" | "maybe" }>();
  for (const response of snapshot.responses) {
    if (response.answer === "unanswered") continue;
    const decision = byKey.get(decisionKey({ name: response.name }))?.decision;
    if (decision?.kind !== "member") continue;
    entries.set(decision.memberId, { member_id: decision.memberId, answer: response.answer });
  }
  return [...entries.values()];
}

export function spondNewIdentities(rows: NameRow[]) {
  return newIdentities(rows, "spond");
}

// ---------------------------------------------------------------- scorecard

/** Only our own players need resolving: our batters, and our bowlers (who bowl in the other side's innings). */
export function scorecardNames(card: Scorecard): OutsideName[] {
  return card.innings.flatMap((inn) =>
    inn.ours
      ? inn.batting.map((b) => ({ name: b.name, externalId: b.cricheroes_player_id ?? null }))
      : inn.bowling.map((b) => ({ name: b.name, externalId: b.cricheroes_player_id ?? null }))
  );
}

export function scorecardPayload(card: Scorecard, rows: NameRow[]) {
  const source: IdentitySource = card.source === "cricheroes" ? "cricheroes" : "pdf";
  const byKey = decisionsByKey(rows);
  const memberOf = (name: string, externalId?: string) => {
    const decision = byKey.get(decisionKey({ name, externalId: externalId ?? null }))?.decision;
    return decision?.kind === "member" ? decision.memberId : null;
  };
  return {
    cricheroes_match_ref: card.cricheroes_match_ref,
    result: card.result,
    result_summary: card.result_summary,
    innings: card.innings.map((inn) => ({
      innings_no: inn.innings_no,
      ours: inn.ours,
      team_name: inn.team_name,
      runs: inn.runs,
      wickets: inn.wickets,
      balls: inn.overs,
      extras: inn.extras,
      batting: inn.batting.map((b) => ({
        member_id: inn.ours ? memberOf(b.name, b.cricheroes_player_id) : null,
        name: b.name,
        position: b.position,
        runs: b.runs,
        balls: b.balls,
        fours: b.fours,
        sixes: b.sixes,
        how_out: b.how_out ?? null,
        not_out: b.not_out,
        did_bat: b.did_bat
      })),
      bowling: inn.bowling.map((b) => ({
        member_id: inn.ours ? null : memberOf(b.name, b.cricheroes_player_id),
        name: b.name,
        balls: b.overs,
        maidens: b.maidens,
        runs: b.runs,
        wickets: b.wickets,
        wides: b.wides,
        no_balls: b.no_balls
      }))
    })),
    new_identities: newIdentities(rows, source)
  };
}
