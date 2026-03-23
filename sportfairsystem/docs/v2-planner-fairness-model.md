# SportFairSystem V2 Planner Fairness Model

## Purpose

This document defines how V2 should handle:

- friendly-match fairness rotation
- tournament selection
- attendance-driven player availability
- player fairness tracking over time
- organiser and captain alerts for bias-risk scenarios

It separates two concepts that should not use the same algorithm:

- `friendly matches`
- `tournament matches`

## Core Decision

Friendly matches should not be performance-first.

Tournament matches can become performance-aware.

The product should therefore support two planning modes with different selection rules:

### 1. Friendly Matchday Planner

Use fairness-first rotation based on attendance and tracked match opportunities.

### 2. Tournament Planner

Use performance-aware selection after minimum opportunity thresholds have been met.

## Friendly Matchday Rules

Friendly matches should use the weekly attendance sheet as the source of truth for availability.

For each available player:

- the system should track how many fair opportunities they have already received
- the planner should try to rotate available players across the day's matches
- the planner should avoid repeatedly excluding the same available player

### Fairness Goal

If a player is available on the day, the planner should try to ensure that:

- they appear in at least one `Playing XI` or `12th man` slot whenever the available pool size allows it
- the same player is not repeatedly dropped across multiple friendly matchdays without explanation

### Minimum Opportunity Window

Each player should get a minimum of `5 matches` to prove performance.

Before that threshold is reached:

- selection should be fairness-led
- recent exclusion history should carry a penalty
- performance can be visible, but it should not dominate the planner

After a player completes `5 matches`:

- performance can start influencing selection order
- fairness should still remain a constraint, not disappear completely

## Tournament Rules

Tournament planning can use performance-aware ranking more aggressively.

Tournament selection should consider:

- form and performance
- balance of roles
- captain and wicket-keeper coverage
- opponent/context later if needed

But even in tournament mode, the system should still surface fairness-risk alerts when a player is repeatedly excluded.

## Data Model Additions

V2 should persist planner fairness history instead of recalculating only from the current day.

### 1. `member_match_opportunities`

Tracks whether a member was available and what opportunity they received on a given matchday.

Suggested fields:

- `id`
- `team_id`
- `member_id`
- `season_id`
- `match_date`
- `planner_mode` such as `friendly` or `tournament`
- `availability_source` such as `attendance_sheet` or `manual`
- `was_available`
- `assigned_to_xi`
- `assigned_as_twelfth`
- `was_dropped`
- `generated_plan_batch_id`
- `created_at`

### 2. `planner_generation_batches`

Tracks one generated planner run for auditability.

Suggested fields:

- `id`
- `team_id`
- `season_id`
- `planner_mode`
- `match_date`
- `source_file_name`
- `weekend_label`
- `generated_by_user_id`
- `created_at`

### 3. `member_fairness_snapshots`

Stores summarized fairness indicators for fast dashboard use.

Suggested fields:

- `member_id`
- `season_id`
- `available_days`
- `friendly_matches_assigned`
- `friendly_twelfth_assignments`
- `friendly_drops`
- `consecutive_drops_when_available`
- `matches_completed_for_quota`
- `quota_completed_at`
- `last_selected_at`
- `last_dropped_at`
- `fairness_score`
- `selection_pressure_score`
- `updated_at`

## Fairness Score

The fairness score should be visible to organiser and captain.

This score should not mean "best player".

It should mean "how fairly this player has been treated compared with their availability and opportunity history".

### Suggested Inputs

- number of days available
- number of times selected in XI
- number of times selected as 12th man
- number of times dropped while available
- consecutive available days without selection
- whether the player is still inside the minimum 5-match opportunity window

### Suggested Interpretation

- `high fairness score`
  - player is receiving fair opportunities
- `warning fairness score`
  - player is drifting toward underuse
- `critical fairness score`
  - player is available regularly but keeps missing XI or 12th-man opportunities

## Selection Logic

Friendly selection should use a composite ordering, not just raw performance.

### Stage 1: Availability Filter

Only players matched from:

- member name
- external name
- linked player identity

should enter the available pool.

### Stage 2: Hard Constraints

Protect the structure of the squad:

- captain coverage
- wicket-keeper coverage
- minimum bowling coverage
- minimum XI count

### Stage 3: Friendly Fairness Ordering

Before quota completion, rank mostly by fairness need:

- available and dropped recently -> move up
- low total opportunities -> move up
- repeated exclusion -> move up strongly
- already selected frequently in recent friendly matches -> move down

After quota completion, blend fairness and performance:

- fairness still matters
- performance starts carrying more weight
- repeated unused streaks still trigger warnings

## Bias-Risk Alerts

Organiser and captain should be warned about suspicious selection patterns.

### Scenario 1

Player completed minimum 5 matches and is performing well.

Expected outcome:

- regular XI consideration is valid

But the dashboard should still show whether the same players are monopolizing friendly slots too often.

### Scenario 2

Player completed minimum 5 matches and is not performing well.

Expected outcome:

- fewer XI chances may be reasonable

But if that player is repeatedly available and never getting XI or 12th-man chances, organiser and captain should get an alert such as:

- `Player unused for 3 straight available matchdays after quota completion`

### Additional Alert Types

- `Available player dropped from all generated matches for the day`
- `Player has not reached 5-match quota but keeps missing opportunities`
- `Same core XI repeated across friendly weeks despite larger attendance pool`
- `Captain or organiser overrides are repeatedly excluding the same player`

## Dashboard Scope

This should become a dedicated organiser/captain dashboard.

Suggested widgets:

- fairness score by player
- players below quota
- players underused while available
- consecutive drop streaks
- XI share and 12th-man share
- weekly planner overrides and who made them

Suggested access:

- organiser
- coordinator/captain

## Recommended Implementation Order

### Phase 1

Replace current friendly planner scoring with fairness-first day rotation:

- match attendance names to member identity
- ensure available players rotate across generated matches
- avoid dropping the same player across all matches unless constraints force it

### Phase 2

Persist planner generation history:

- save each generated batch
- save per-member availability and assignment outcomes

### Phase 3

Add fairness score calculation and organiser/captain dashboard:

- quota progress
- underuse alerts
- repeated exclusion alerts

### Phase 4

Introduce post-quota blended performance weighting:

- friendly mode becomes fairness-first plus light performance
- tournament mode remains stronger performance-first

## Immediate Product Direction

For the current app state, the next behavior change should be:

- keep tournament logic separate
- change friendly planning to fairness-first rotation
- guarantee that available players like `Ravinder` are not dropped across all generated matches unless hard role constraints require it

This should be the next planner implementation step before scorecard-import refactors continue.
