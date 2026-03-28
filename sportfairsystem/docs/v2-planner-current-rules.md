# SportFairSystem V2 Planner Current Rules

## Purpose

This document records the planner rules the app is currently using in code today.

It is intentionally an as-built reference, not the aspirational target model.

Primary implementation sources:

- `app/services/plannerService.ts`
- `app/planner/page.tsx`
- `app/services/plannerHistoryService.ts`
- `app/services/plannerFairnessService.ts`
- `app/services/plannerActualService.ts`

---

## 1. Access Rules

- Planner is available to:
  - `organiser`
  - members with explicit `planner_manage` permission
- Fairness leadership views are available to:
  - `organiser`
  - `captain`
  - members with `planner_manage` in the fairness access path
- Member self-view fairness is exposed separately through `/my-fairness`

---

## 2. Planner Modes

The app currently supports two planner modes:

- `friendly`
- `tournament`

Current practical behavior:

- friendly mode can generate up to 3 match plans for the same day
- tournament mode currently generates a single match plan from manual availability

---

## 3. Friendly Availability Input

Friendly mode depends on an uploaded attendance workbook.

Current parsing rules:

- only the first worksheet is read
- weekend availability columns start at column index 6
- weekend labels are derived from the first row
- player availability rows are read from row 3 onward
- an availability cell counts as available when it contains:
  - a positive number
  - `yes`
  - `y`
  - `available`
  - `1`
  - `true`

If no weekend columns are found, planner generation stops with an error.

---

## 4. Identity Matching Rules

Attendance names are matched to squad players using a layered identity strategy.

The planner tries:

1. explicit identity/alias match keys
2. cleaned token match on player name
3. exact normalized full-name match
4. first-token plus initial match
5. prefix-compatible token matching

Unmatched names are preserved and surfaced back to the user as warnings.

---

## 5. Availability Override Rules

### Friendly mode

- each available player can be toggled per match
- a player can be marked unavailable for the full day
- if a player has zero eligible friendly matches, they are treated as unavailable

### Tournament mode

- players are manually toggled in or out before generation

---

## 6. Planner Role Classification

Each player is classified into one planner role:

- `batter`
- `bowler`
- `all-rounder`

Current classification rules:

- `all-rounder` if tagged `all-rounder` or tagged as both batter and bowler
- `bowler` if tagged `bowler` or if the profile role is `Bowler`
- otherwise `batter`

---

## 7. Planner Scoring

The planner gives each player a score and sorts descending before suggestion building.

Current score formula:

- `matchesPlayed * 3`
- `+40` if captain
- `+24` if wicket keeper
- `+18` if all-rounder
- `+12` if bowler
- `+10` if batter
- `+2` if batting style is present

This means the current planner is still strongly weighted toward prior usage and structural squad metadata, not fairness-first ranking.

---

## 8. Previous Actual Opportunity Correction

Friendly mode now applies a previous-matchday opportunity correction before the normal same-day rotation logic.

Primary reference rule:

- when a linked actual result exists for the most recent saved friendly matchday, that actual result becomes the primary fairness reference
- when no linked actual result exists, the planner falls back to the most recent saved friendly batch assignments
- the rule is generic and applies to any qualifying player; it does not use hardcoded player-name exceptions

Current opportunity statuses:

- `fully_utilized`
- `unused_in_xi`
- `bench_or_12th`
- `not_selected`
- `unavailable`
- `unknown`

Current actual-result classification behavior:

- `fully_utilized` if the player actually batted or bowled
- `unused_in_xi` if the player appeared in the most recent linked actual playing group but did not bat and did not bowl
- `bench_or_12th` if the player did not get an actual opportunity and their saved assignment was bench or 12th man
- `not_selected` if the player was available in the saved batch but no actual opportunity was found
- `unavailable` if the player was unavailable across the saved matchday
- `unknown` if no reliable prior row exists

Current friendly opportunity boost values:

- `+20` for `unused_in_xi`
- `+10` for `bench_or_12th`
- `+5` for `not_selected`
- `+0` for `fully_utilized`
- `+0` for `unavailable`
- `+0` for `unknown`

Current friendly preference order:

1. `unused_in_xi`
2. `bench_or_12th`
3. `not_selected`
4. `fully_utilized`
5. `unknown`

This correction is only meaningful for players who are currently eligible for the match slot being generated.

---

## 9. Single-Match XI Construction

For a single generated match plan, the planner:

1. locks the captain first if available
2. locks the preferred wicket keeper if selected, otherwise the first available wicket keeper
3. adds up to 2 all-rounders
4. adds up to 3 bowlers
5. adds up to 4 batters
6. fills remaining places from the rotated player pool

Current target shape:

- Playing XI target: 11
- 12th man: first unused player after the XI is built
- bench players: everyone outside the XI

Per-plan checks recorded in output:

- captain covered or missing
- wicket keeper covered or missing
- number of bowling options
- XI shortfall if fewer than 11 are available

---

## 10. Friendly Rotation Rules

Friendly mode adds same-day rotation behavior across up to 3 matches.

### Rotation offset

For each next match, the non-locked pool is rotated by:

- `(matchNumber - 1) * 3`

This reduces identical XI repetition across the day.

### Bench balancing

Bench candidates are sorted to spread missed opportunities more evenly.

Current bench sort priority:

1. lower previous-opportunity priority for the next XI
2. fewer previous bench assignments
3. higher XI count
4. fewer previous 12th-man assignments
5. longer since last appearance
6. higher planner score
7. alphabetical name

### 12th-man balancing

12th-man candidates are sorted by:

1. higher previous-opportunity priority for the next XI
2. fewer previous 12th-man assignments
3. fewer bench assignments
4. higher XI count
5. alphabetical name

---

## 11. Friendly Safety Constraints

Before benching a player, the planner checks whether the remaining group can still support a valid matchday core.

A player should not be benched if doing so would leave the remaining squad without:

- a captain
- a wicket keeper
- at least 3 bowling options

This constraint is relaxed only when the squad is already below a full XI size.

---

## 12. Planner Notes And Warnings

The planner currently emits notes for:

- fewer than 11 available players
- exactly 11 available players
- exactly 12 available players
- unmatched attendance names
- no captain in the available pool
- no wicket keeper in the available pool
- bowling coverage below 3 options
- previous actual-result correction being applied
- fallback to saved fairness history when no linked actual result exists

Current friendly correction note:

- `Previous actual-result correction applied for available unused_in_xi players.`

These notes are informational warnings shown in the planner UI.

---

## 13. Saved Planner History

Only friendly planner outputs are currently persisted into planner history for fairness tracking.

Saved planner history includes:

- batch metadata
- weekend label/date
- planner mode
- selected assignments
- player/member identity linkage
- notes

Planner history is then used by the fairness workspace.

---

## 14. Fairness Tracking Rules

Current fairness summaries track, per member/player:

- XI count
- 12th count
- bench count
- unavailable count
- tracked matchdays
- available matchdays
- quota remaining
- consecutive available no-XI batches

Current fairness alert types include:

- `baseline_build`
- `no_xi_yet`
- `underuse_after_quota`
- `repeat_bench`
- `planned_xi_no_show`
- `planned_twelfth_used`
- `planned_bench_used`
- `planned_unavailable_used`

The current baseline language in the app is built around a 5-XI threshold.

---

## 15. Actual-vs-Planned Reconciliation

When linked scorecards exist, fairness can compare saved planner assignments with real participation.

Current reconciliation sources:

- linked actual matches per saved planner batch
- match players
- batting records
- bowling records

Actual participation is recognized through:

- linked `player_id`
- normalized player names

This lets fairness detect where:

- planned XI did not actually appear
- planned bench or 12th man was actually used
- planned unavailable players still appeared

---

## 16. Important Current Constraint

The current planner is not yet the final fairness-first V2 planner described in the broader model docs.

Today it is best described as:

- availability-aware
- role-structured
- captain/WK/bowling constrained
- friendly-day rotation aware
- fairness-tracked after save

But it is still not a fully fairness-led selector.

That distinction matters when evaluating whether planner behavior is a bug or simply a current design limitation.
