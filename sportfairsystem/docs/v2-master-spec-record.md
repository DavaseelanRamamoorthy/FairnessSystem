# SportFairSystem V2 Master Spec Record

## Source

This record is based on the user-provided PDF:

- `e:\Moonwalkers\Documents\V2.0\SportFairSystem_V2_Master_Spec.pdf`

Extracted on `2026-03-24` for use as the canonical V2 reference in this repository.

## Title

`SportFairSystem Version 2.0 - Master Specification`

## Vision

Evolve SportFairSystem from an internal team tool into a team operating system for amateur cricket teams.

## Core Modules

### 1. Team Core

- team creation
- invite system
- membership validity
- roles:
  - Admin
  - Captain
  - Player

### 2. Team Operations

- events
- RSVP
- Playing XI
- bench management

### 3. Communication

- posts
- polls
- comments

Important boundary from the spec:

- communication should remain lightweight
- V2 should not become a full chat system

## Key Principles

- maintain the V1 identity system (`player_id`-first)
- introduce `team_id` without breaking the existing schema
- keep the system simple, mobile-first, and scalable
- avoid overbuilding in V2

## Data Model Additions

The spec explicitly calls for these additions:

- `teams`
- `team_members`
- `invites`
- `events`
- `event_responses`
- `posts`
- `polls`
- `poll_votes`

## Scope Exclusions

The spec explicitly excludes these from V2:

- full messaging/chat
- payments
- tournaments
- multi-team complex switching UI

## Intended Outcome

A stable, scalable team-management foundation that is ready for future expansion.

## Implementation Reading For This Repo

When applying this spec to the current codebase, the practical interpretation is:

- preserve V1 match and analytics compatibility
- introduce team and membership entities safely beside the current model
- keep the UI single-team first, even if the schema becomes multi-team ready
- deliver V2 as phased expansion, not a V1 replacement

## Related Repo Docs

- [v2-development-plan.md](/e:/SubMain/FairnessSystem/sportfairsystem/docs/v2-development-plan.md)
- [v2-identity-membership-model.md](/e:/SubMain/FairnessSystem/sportfairsystem/docs/v2-identity-membership-model.md)
- [v2-roles-permissions-model.md](/e:/SubMain/FairnessSystem/sportfairsystem/docs/v2-roles-permissions-model.md)
- [v2-planner-fairness-model.md](/e:/SubMain/FairnessSystem/sportfairsystem/docs/v2-planner-fairness-model.md)
