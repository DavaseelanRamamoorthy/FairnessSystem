# SportFairSystem V2 Roles And Permissions Model

## Purpose

This document defines the V2 foundation for team roles, scoped responsibilities, and permission-based access control.

It builds on the member-first model and prepares the product to support:

- one main operating system for the team
- combined team management and performance analytics
- attendance, planning, finance, and inventory workflows
- multiple teams in the future

## Core Decision

V2 should not treat every elevated user as the same kind of admin.

Instead:

- `team_members` carries the business role for that person in that team
- scoped permissions control sensitive actions
- dangerous or identity-affecting workflows should require explicit permissions

This avoids overloading one broad `admin` role with unrelated responsibilities.

## Team Roles

Each team can assign one of these primary business roles to a member.

### 1. organiser

The main team owner.

Responsibilities:

- owns the team workspace
- controls team settings
- manages invites and role assignment
- approves identity mappings and external name mappings
- can delegate permissions

This is the highest-trust role.

### 2. coordinator

The team operations lead.

Responsibilities:

- coordinates matchday availability
- manages attendance and planner workflows
- helps maintain the active roster
- supports events and day-to-day team operations

This is the operational role, not the financial or ownership role.

### 3. financer

The team fund manager.

Responsibilities:

- manages team funds
- tracks fees, expenses, and balances
- reviews finance-only views and records

This role should not automatically get roster or identity-edit access.

### 4. inventory_manager

The club inventory manager.

Responsibilities:

- tracks kits, balls, bats, bibs, and shared items
- manages issue/return state
- maintains inventory records

This role should not automatically get member or identity-edit access.

### 5. member

The default team member role.

Responsibilities:

- basic access to the team workspace
- self-service and read access within allowed areas

This role should not edit protected operational data by default.

## Why Roles Alone Are Not Enough

Roles explain a member's job in the team, but permissions decide what they can actually change.

Example:

- a coordinator may manage attendance
- but should not necessarily edit external names
- a financer may manage money
- but should not edit scorecard identity resolution

So V2 should use:

- one primary business role
- plus scoped permissions for high-trust actions

## Permission Model

Suggested permissions:

- `team_settings_manage`
- `members_manage`
- `invites_manage`
- `identity_manage`
- `attendance_manage`
- `planner_manage`
- `stats_manage`
- `finance_manage`
- `inventory_manage`
- `events_manage`

## Permission Meanings

### team_settings_manage

Can update team-level settings and ownership-related controls.

### members_manage

Can change member status, season, and non-sensitive roster management details.

### invites_manage

Can invite or remove team access for users.

### identity_manage

Can edit:

- external names
- member-to-player compatibility links
- import resolution mappings

This permission should be tightly controlled.

### attendance_manage

Can manage availability, attendance imports, and attendance records.

### planner_manage

Can use and adjust planner workflows for squad generation and matchday planning.

### stats_manage

Can manage scorecard-import resolution and analytics correction workflows.

### finance_manage

Can manage finance records and future fee/expense workflows.

### inventory_manage

Can manage inventory records and issue/return operations.

### events_manage

Can manage future events, sessions, and team-post/event workflows.

## Recommended Default Mapping

### organiser

Default permissions:

- all permissions

### coordinator

Default permissions:

- `members_manage`
- `invites_manage`
- `attendance_manage`
- `planner_manage`
- `stats_manage`
- `events_manage`

Optional:

- `identity_manage` only for trusted coordinators

### financer

Default permissions:

- `finance_manage`

### inventory_manager

Default permissions:

- `inventory_manage`

### member

Default permissions:

- none of the elevated permissions above

## External Names Access

The current `Aliases` concept should be treated as `External Names` in the product.

This covers names used by:

- attendance sheets
- CricHeroes
- legacy tools
- short names and initials

Editing external names should not be allowed for every elevated member.

Recommended access:

- view external names: organiser and coordinator
- edit external names: organiser by default
- optionally allow a trusted coordinator through `identity_manage`

This protects the most sensitive matching layer in the app.

## Multi-Team Future

This model works cleanly for future multi-team support because:

- roles live on `team_members`
- permissions live on `team_members`
- the same `user` can have different roles in different teams

Example:

- organiser in Team A
- financer in Team B
- member in Team C

without conflicts at the user level

## Recommended Schema Direction

To avoid breaking the current app immediately, the first foundation step should be additive.

### Keep for now

- current `team_members.role` values used by the app
- current `users.role`
- current admin checks

### Add now

- `team_members.team_role`
- `team_member_permissions`

Then migrate app access gradually from:

- `admin/captain/player`

to:

- business role + permissions

## Transition Strategy

### Stage 1

Add the new business-role and permissions schema without removing the current access model.

### Stage 2

Backfill business roles conservatively:

- `admin` -> `organiser`
- `captain` -> `coordinator`
- `player` -> `member`

This is only a starting point and can be corrected manually after migration.

### Stage 3

Add permission-aware helper functions in the app for:

- identity management
- attendance management
- planner management
- finance management
- inventory management

### Stage 4

Move protected UI modules to permission-based gating.

### Stage 5

Retire the old broad admin assumptions once all major modules use the new model.

## Recommendation

The right V2 foundation is:

- business role for each member
- scoped permissions for elevated responsibilities
- restricted identity editing
- team-specific access that will scale to multiple teams

This gives the product a cleaner operating model for the current season and a safer path into next season's multi-team version.
