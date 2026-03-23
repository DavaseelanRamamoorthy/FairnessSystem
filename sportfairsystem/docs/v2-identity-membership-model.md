# SportFairSystem V2 Identity And Membership Model

## Purpose

This document defines the correct V2 foundation for identity, team membership, roles, invites, and scorecard-name resolution before deeper implementation work continues.

It replaces the earlier assumption that a `team_member` might exist independently from a `user` as the main product path.

## Core Decision

For SportFairSystem V2, the primary identity model should be:

- `users` = the person in the application
- `teams` = the workspace or club/team unit
- `team_members` = that user's membership inside a specific team

This means:

- a person signs up as a `user`
- a person becomes a `team_member` when they create or join a team
- roles are assigned on `team_members`, not on `users`
- one `user` can belong to multiple teams in the future
- the UI can still remain single-team initially by using one active team context

## Product Flow

### User Lifecycle

1. A person signs up and becomes an app `user`.
2. The user logs in.
3. The user either:
   - creates a team
   - joins a team through an invite or code
4. At that point, a `team_members` row is created.
5. That membership controls the user's team-specific role and access.

### Team Creation Flow

1. User creates a new team.
2. A `teams` row is created.
3. A `team_members` row is created for that user and team.
4. That first membership is assigned `admin`.
5. That team becomes the active team in the UI.

### Join Team Flow

1. Existing admin invites a user or shares a join code.
2. User signs in or signs up.
3. User accepts invite or enters the join code.
4. A `team_members` row is created for that user and team.
5. Membership starts as active with a default role such as `player`, unless invite rules specify something else.

### Invite Team Member Flow

1. Admin sends invite.
2. Invite exists as a pending team access artifact, not as a final anonymous member record.
3. When the invited user completes signup or login and accepts, the real `team_members` row is created or activated.

## Entity Model

## 1. users

Global application identity.

Suggested responsibility:

- authentication identity
- profile fields
- app-level preferences

Suggested fields:

- `id`
- `email`
- `first_name`
- `last_name`
- `username`
- `created_at`
- `updated_at`

Important rule:

- do not store team role as the primary source of truth on `users`

## 2. teams

The team workspace.

Suggested fields:

- `id`
- `name`
- `code`
- `created_by_user_id`
- `created_at`

## 3. team_members

The user's membership in a team.

This is the main operational entity.

Suggested fields:

- `id`
- `team_id`
- `user_id`
- `role`
- `status`
- `joined_at`
- `left_at`
- `invited_by_user_id`
- `season_id` optional for current season association
- `created_at`
- `updated_at`

Suggested role values:

- `admin`
- `captain`
- `player`

Suggested status values:

- `active`
- `inactive`
- `invited`
- `archived`

Important rules:

- `team_members` is team-specific
- a user can have multiple memberships across teams
- role must be evaluated from membership, not from the user row

## 4. membership_seasons

Team-specific seasons for operational assignment.

Suggested fields:

- `id`
- `team_id`
- `name`
- `start_date`
- `end_date`
- `is_active`

Important rule:

- a membership may be assigned to a season, but season assignment must remain editable because historical uploads may lag behind operational reality

## 5. team_member_aliases

Aliases used to resolve scorecard names.

This is critical for names like:

- app/profile name: `Sharathkumar J`
- scorecard alias: `Sharath`

Suggested fields:

- `id`
- `team_id`
- `member_id`
- `alias`
- `normalized_alias`
- `alias_type`
- `is_primary`
- `created_at`

Suggested alias types:

- `primary`
- `scorecard`
- `short`
- `legacy`

Important rules:

- alias uniqueness should be enforced per team on `normalized_alias`
- scorecard resolution should use aliases first

## 6. players

Legacy compatibility and stats identity layer.

In V2, `players` should stop being the main onboarding entity.

Suggested role:

- preserve `player_id` compatibility for V1 stats and match history
- maintain a hidden or low-visibility technical mapping for analytics, validation, and historical records

Suggested transition:

- add `member_id` to `players`
- make `member_id` unique once migration is stable
- stop letting admins think of `players` as the main roster table

## 7. member_links

This can continue temporarily during migration, but its long-term role should be reconsidered.

If `team_members.user_id` becomes required and `players.member_id` exists, `member_links` may become transitional rather than permanent.

## Recommended Long-Term Relationships

- `users 1 -> many team_members`
- `teams 1 -> many team_members`
- `teams 1 -> many membership_seasons`
- `team_members 1 -> many team_member_aliases`
- `team_members 1 -> 1 players` eventually for the main playing identity

## Scope Decisions

## Decision 1: Membership Is User-Based

`team_members` should be treated as user-based membership, not as a separate anonymous roster entity in the main flow.

This matches the real product journey:

- sign up
- create or join team
- become team member

## Decision 2: Remove Add-To-Squad Flow

The `Add to squad` flow should be removed from scorecard ingestion.

Reason:

- it creates a second onboarding path
- it causes duplicate identity creation
- it blurs the boundary between roster management and scorecard resolution

## Decision 3: Membership Owns Onboarding

New rostered people should enter the system through membership and invite flows, not through scorecard parsing.

## Decision 4: Scorecards Resolve Against Membership

Scorecard import should:

1. normalize the parsed name
2. resolve through `team_member_aliases`
3. find the target `team_member`
4. use linked `player_id` if present
5. if unresolved, flag for review instead of silently creating a permanent player

## Decision 5: Keep players Temporarily

Do not remove `players` immediately.

Reason:

- V1 analytics
- V1 validation
- V1 match history
- V1 `player_id` linkage

all still depend on it.

The app should become member-first in UX, while `players` remains a compatibility layer during migration.

## Recommended UI Model

The UI should present:

- Teams
- Members
- Invites
- Roles
- Aliases

The UI should avoid presenting `players` as the main thing admins manage.

Suggested changes:

- `/memberships` becomes the core admin roster workspace
- `Configure` should evolve into:
  - member-to-user review
  - member-to-player compatibility review
  - alias management
- `Players` may remain as a stats view, not the onboarding source

## Duplicate Problem Explained

Current duplicate risk exists because two flows can create identity-bearing rows:

1. scorecard import creates rows in `players`
2. membership flow creates rows in `team_members`

If both represent the same person independently, duplication becomes inevitable.

The fix is not just deduping records after the fact. The fix is removing the second ownership path.

## Recommended Migration Strategy

## Phase A: Lock The Model

1. Treat `users` as app identity.
2. Treat `team_members` as the operational roster identity.
3. Treat `players` as legacy stats compatibility.
4. Introduce `team_member_aliases`.

## Phase B: Prepare Schema

1. Add `user_id` to `team_members` as the long-term required relationship.
2. Add `member_id` to `players`.
3. Add `team_member_aliases`.
4. Add unique constraints that prevent duplicate alias resolution per team.

## Phase C: Backfill

1. Match current `team_members` to existing `users`.
2. Match current `players` to `team_members`.
3. Populate aliases from:
   - membership display name
   - player name
   - known short scorecard names where available

## Phase D: Change Ingestion Behavior

1. Stop auto-creating permanent `players` rows during scorecard save.
2. Attempt alias-based member resolution first.
3. If unresolved, store as unresolved identity review work.

## Phase E: Remove Old Product Assumptions

1. Remove `Add to squad`.
2. Move roster onboarding fully into membership flow.
3. Repurpose Configure into membership and alias admin.

## Phase F: Cleanup

1. Deduplicate `players`.
2. Enforce one primary linked player per member.
3. Continue reducing direct dependency on visible player management.

## Step-By-Step Implementation Plan

This is the recommended order going forward.

### Step 1

Lock this identity model in the docs and use it as the source of truth.

Status:

- do this now

### Step 2

Fix the 404 experience so routing and fallback UI are stable before we continue broader V2 work.

Why:

- current 404 behavior is distracting debugging and QA

### Step 3

Design the exact schema migration for:

- `team_member_aliases`
- `players.member_id`
- `team_members.user_id` alignment

Output:

- SQL migration draft
- backfill plan

### Step 4

Update `/memberships` to become the core roster workspace.

Needed additions:

- alias management
- clearer membership onboarding
- better season and status management

### Step 5

Refactor scorecard import to resolve names from membership aliases.

Important:

- do not auto-create permanent players anymore

### Step 6

Remove `Add to squad` from the upload flow.

### Step 7

Repurpose `Configure` into:

- member/account mapping
- compatibility player mapping
- alias review and fixes

### Step 8

Run duplicate cleanup and lock constraints to prevent the issue from returning.

## Recommendation

Yes, we should think from a multi-team perspective at the schema and lifecycle level now, even if the initial UI remains single-team.

The correct V2 base is:

- user signs up once
- user can belong to multiple teams through memberships
- roles are team-specific
- scorecard names resolve through aliases tied to members
- roster onboarding happens through membership, not scorecard import

This is the cleanest foundation and the safest point to restructure before V2 grows further.
