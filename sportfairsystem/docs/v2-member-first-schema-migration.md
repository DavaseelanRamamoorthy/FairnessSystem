# V2 Member-First Schema Migration Draft

## Purpose

This document turns the approved V2 identity model into an actionable schema migration plan before implementation.

It is intentionally a review artifact first. The goal is to lock the database direction before applying the migration in Supabase.

## Goal

Move SportFairSystem toward a member-first architecture:

- `users` = app identity
- `team_members` = team-specific membership
- `team_member_aliases` = scorecard-name resolution layer
- `players` = transitional stats identity compatibility layer

## What Changes

### 1. team_members becomes user-based

`team_members` should move toward:

- required `user_id` for the long-term main path
- role and membership status stored there
- one user can belong to multiple teams

### 2. team_member_aliases is introduced

This becomes the first-class resolution layer for:

- scorecard short names
- initials
- nicknames
- legacy spellings

### 3. players gets linked to team_members

`players` stays alive for compatibility, but should no longer be the main onboarding entity.

Add:

- `players.member_id`

Long-term goal:

- one linked player identity per member where stats compatibility is needed

### 4. member_links becomes transitional

Current `member_links` can remain for now, but once:

- `team_members.user_id` is fully aligned
- `players.member_id` is populated

its long-term role should shrink or disappear.

## Important Non-Goals

This migration should not yet:

- remove `players`
- remove `users.player_id`
- rewrite all analytics and validation queries
- change scorecard import behavior yet

Those happen after the schema and backfill are stable.

## Recommended Migration Order

## Stage 1: Schema Additions

Add safe, additive schema first:

1. extend `team_members`
2. add `team_member_aliases`
3. add `players.member_id`
4. add helper indexes and constraints

## Stage 2: Backfill

Populate:

1. `team_members.user_id`
2. `players.member_id`
3. `team_member_aliases`

## Stage 3: Service Refactor

Update application logic to:

1. resolve scorecards by alias
2. stop auto-creating permanent players
3. remove `Add to squad`

## Stage 4: Cleanup

After the app is stable:

1. deduplicate legacy `players`
2. strengthen constraints
3. reduce reliance on `member_links`

## Schema Changes

## team_members

Current issues:

- no `user_id`
- no `joined_at`
- no `left_at`
- no `invited_by_user_id`
- `name` is still acting like a freeform person record rather than a team membership identity

Recommended additions:

- `user_id uuid references public.users(id) on delete cascade`
- `joined_at timestamptz`
- `left_at timestamptz`
- `invited_by_user_id uuid references public.users(id) on delete set null`
- `updated_at timestamptz`

Recommended constraints:

- eventually unique `(team_id, user_id)` where `user_id is not null`

Note:

- do not make `user_id` required immediately in the first migration if current data still needs staged backfill

## team_member_aliases

New table.

Suggested shape:

- `id uuid primary key default gen_random_uuid()`
- `team_id uuid not null references public.teams(id) on delete cascade`
- `member_id uuid not null references public.team_members(id) on delete cascade`
- `alias text not null`
- `normalized_alias text not null`
- `alias_type text not null default 'scorecard'`
- `is_primary boolean not null default false`
- `created_at timestamptz not null default timezone('utc', now())`

Suggested alias types:

- `primary`
- `scorecard`
- `short`
- `legacy`

Recommended constraints:

- unique `(team_id, normalized_alias)`
- optionally at most one primary alias per member

## players

Add:

- `member_id uuid references public.team_members(id) on delete set null`

Recommended constraints:

- unique `member_id` where not null

Important:

- do not remove existing `users.player_id` yet
- do not remove existing `player_id` references in stats tables yet

## member_links

Keep temporarily for compatibility.

Later migration path:

- reduce or remove once direct `team_members.user_id` and `players.member_id` are stable

## Backfill Strategy

## A. Backfill team_members.user_id

Use the safest available order:

1. if `member_links.user_id` exists, use it
2. otherwise if exact user-name match within the same team is unique, use it
3. otherwise leave null and flag for manual review

## B. Backfill players.member_id

Use the safest available order:

1. if `member_links.player_id` exists, set that player's `member_id`
2. otherwise match by unique same-team exact normalized name
3. otherwise leave null and flag for manual review

## C. Backfill aliases

Create aliases from:

1. `team_members.name`
2. linked `players.name`
3. known historical variations if available later

Suggested rule:

- membership name becomes a `primary` alias
- linked player name becomes `legacy` if it differs

## D. Manual Review Set

We should expect a review queue for:

- duplicate names
- conflicting user-to-member matches
- conflicting player-to-member matches
- nickname collisions

That is normal and safer than forcing bad automatic mappings.

## Scorecard Resolution Model After Migration

This is the target behavior after schema and backfill are ready:

1. normalize parsed scorecard name
2. find alias in `team_member_aliases` by `(team_id, normalized_alias)`
3. resolve member
4. resolve linked `player_id` through compatibility layer
5. if no alias match:
   - mark unresolved
   - do not auto-create a permanent player

## What To Remove Later

After the migration is stable and scorecard resolution is refactored:

- `Add to squad` from upload flow
- direct roster onboarding through `players`
- visible admin dependence on `players` as the main team list

## Risks

### Risk 1

Current backfilled `team_members` are not strictly user-based yet.

Mitigation:

- stage the migration with nullable `user_id`
- finish backfill before enforcing tighter constraints

### Risk 2

Alias collisions may happen for common short names.

Mitigation:

- unique alias per team
- unresolved review flow for conflicts

### Risk 3

Existing scorecard import still creates `players`.

Mitigation:

- do not apply behavior changes until schema and alias model are in place

## Review Checklist

Before applying the SQL migration, confirm:

1. `team_members.user_id` should be staged as nullable first
2. `players.member_id` should be unique where not null
3. `team_member_aliases` should enforce unique alias per team
4. `member_links` should remain transitional for now
5. scorecard import change is a later step, not part of this migration

## Recommendation

Apply the next schema as additive and migration-safe:

- add the missing membership columns
- add aliases
- add `players.member_id`

Then backfill, verify, and only after that move the upload flow away from player auto-creation.
