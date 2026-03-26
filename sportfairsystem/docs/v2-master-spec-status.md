# SportFairSystem V2 Master Spec Status

## Purpose

This document compares the current implementation in this repository against the recorded V2 master spec in:

- [v2-master-spec-record.md](/e:/SubMain/FairnessSystem/sportfairsystem/docs/v2-master-spec-record.md)

It is intended to answer one practical question:

- where are we right now compared with the V2.0 spec?

Important framing note for this repository:

- this document compares the codebase against the original V2 master spec
- for current release planning, first-class events, RSVP, posts, polls, and comments have been moved to V3.0 future scope
- that means original-spec alignment and practical V2.0 release readiness are no longer the same number

## Overall Read

SportFairSystem is on the right V2 track.

The project has already delivered most of the V2 identity and planning foundation, and it is ahead of the base spec in some fairness-related areas.

Practical phase position:

- Foundation and membership model: mostly complete
- Role-aware product split: in progress and already visible
- Team operations and planner/fairness workflows: strongly in progress
- Communication module: not started as a first-class V2 module
- Invite/event-centered team operations: partially prepared, not fully delivered

Practical release read for the narrowed V2.0 scope:

- V2.0 foundation: strong
- V2.0 Team Core: in progress and moving toward closeout
- V2.0 release hardening: still required before release

## Status Key

- `Done` = implemented and operational in the app or schema
- `In Progress` = foundation exists, partial product behavior exists, or the direction is actively underway
- `Remaining` = still expected for full V2 alignment
- `Beyond Spec` = implemented even though the base V2 master spec did not require it explicitly

---

## 1. Vision

Spec target:

- evolve from an internal team tool into a team operating system for amateur cricket teams

Current status:

- `In Progress`

Why:

- the app is no longer only an analytics tool
- roster, memberships, planner, fairness, and member self-view are now part of the product
- finance, inventory, communication, and full event operations are still pending

Assessment:

- the product direction matches the spec well

---

## 2. Core Module: Team Core

Spec items:

- team creation
- invite system
- membership validity
- roles:
  - Admin
  - Captain
  - Player

Current status:

- `In Progress`

### 2.1 Team creation

Status:

- `Remaining`

Notes:

- the repo is still effectively operating in a single-team runtime model
- team context and team-aware data structures exist
- a full team creation flow is not yet the main product runtime

### 2.2 Invite system

Status:

- `Remaining`

Notes:

- invite-based membership is part of the V2 design docs
- permission models already include `invites_manage`
- a real invite acceptance product flow is not yet delivered

### 2.3 Membership validity

Status:

- `Done`

Evidence:

- `membership_seasons`
- `team_members`
- current-season filtering
- active/inactive/invited/archive-oriented membership thinking
- membership workspace for season/status control

### 2.4 Roles

Status:

- `In Progress`

Evidence:

- leadership/member split is working in fairness
- role and permission foundation is implemented in schema and services
- V2 business roles now go beyond the original spec:
  - organiser
  - coordinator
  - financer
  - inventory_manager
  - member

Notes:

- this is intentionally richer than the original `Admin / Captain / Player` wording from the master spec
- some legacy access behavior still exists in parts of the app

---

## 3. Core Module: Team Operations

Spec items:

- events
- RSVP
- Playing XI
- bench management

Current status:

- `In Progress`

### 3.1 Events

Status:

- `Remaining`

Notes:

- no first-class `events` product module is delivered yet
- planner is currently carrying part of the operational coordination role that events are meant to formalize later

### 3.2 RSVP

Status:

- `Remaining`

Notes:

- attendance workbook and planner overrides currently act as a transitional availability mechanism
- a real in-app RSVP/event response system is not yet delivered

### 3.3 Playing XI

Status:

- `Done`

Evidence:

- planner generates friendly and tournament selections
- saved matchday plans persist XI/12th/bench decisions
- actual-vs-planned comparison exists in fairness

### 3.4 Bench management

Status:

- `Done`

Evidence:

- planner supports 12th and bench handling
- saved matchday assignments persist this structure
- fairness review includes planned vs actual usage from bench/12th positions

---

## 4. Core Module: Communication

Spec items:

- posts
- polls
- comments
- lightweight only, not full chat

Current status:

- `Remaining`

Notes:

- this module is not yet implemented as a first-class product area
- the repo direction still respects the spec boundary of not turning V2 into chat

---

## 5. Key Principle: Maintain V1 Identity System (`player_id`-first)

Current status:

- `Done`

Why:

- V1 `player_id` compatibility is still preserved
- `players` remains the stats compatibility layer
- member-first additions were added without breaking the old anchor model

Important nuance:

- the product is intentionally moving toward member-first operational identity
- but it is doing so in a compatibility-first way, which matches the spec’s constraint

---

## 6. Key Principle: Introduce `team_id` Without Breaking Existing Schema

Current status:

- `Done`

Why:

- team-aware membership foundation exists beside legacy models
- current V1 modules continue to function
- team-scoped policies and compatibility layers are already part of the migration path

---

## 7. Key Principle: Keep The System Simple, Mobile-First, And Scalable

Current status:

- `In Progress`

Why:

- the product remains relatively focused
- several mobile UX improvements have already been delivered
- the recent fairness split improved leadership/member clarity

Still needed:

- more first-class event flows
- broader V2 modules delivered with equally clean UX

---

## 8. Key Principle: Avoid Overbuilding

Current status:

- `Done`

Why:

- no full chat system has been built
- no complex multi-team switching UX has been forced in early
- compatibility-first migration has been used instead of a full rewrite

---

## 9. Data Model Additions From The Master Spec

### 9.1 `teams`

Status:

- `Done`

### 9.2 `team_members`

Status:

- `Done`

### 9.3 `invites`

Status:

- `Remaining`

### 9.4 `events`

Status:

- `Remaining`

### 9.5 `event_responses`

Status:

- `Remaining`

### 9.6 `posts`

Status:

- `Remaining`

### 9.7 `polls`

Status:

- `Remaining`

### 9.8 `poll_votes`

Status:

- `Remaining`

---

## 10. Scope Exclusions From The Master Spec

### 10.1 Full messaging/chat

Status:

- `Respected`

### 10.2 Payments

Status:

- `Respected`

### 10.3 Tournaments

Status:

- `Partially Exceeded`

Notes:

- the master spec excludes tournaments from V2 scope
- the app currently has tournament-planner behavior as a compatibility/product extension
- this is not necessarily harmful, but it is beyond the strict minimal V2 scope

### 10.4 Multi-team complex switching UI

Status:

- `Respected`

Notes:

- the schema and direction are becoming multi-team ready
- the runtime UI still behaves largely as single-team first

---

## 11. Important Areas Already Beyond The Base Spec

These areas are meaningful extensions beyond the minimal V2 master spec:

### 11.1 Fairness system

- dedicated `/fairness` leadership workspace
- `/my-fairness` member self-view
- leadership member detail pages
- planned-vs-actual comparison
- scorecard reconciliation
- fairness alerts and comparison insights

### 11.2 External name identity layer

- attendance and legacy-name matching via `team_member_aliases`

### 11.3 Actual scorecard reconciliation

- saved matchday plans can be linked to real matches
- fairness can now compare plan vs actual outcome

These are valuable additions and they strengthen the product, but they go beyond the narrow wording of the master spec.

---

## 12. Current Completion Read

If we map the implementation against the master spec at a practical level:

- Team Core: about `65-75%` aligned
- Team Operations: about `55-65%` aligned
- Communication: `0-10%` aligned
- Core architectural principles: strongly aligned

Overall V2 master-spec alignment today:

- roughly `60-70%` of the intended foundation is either done or actively underway

This is a healthy position because the hardest foundation work:

- identity
- membership
- role-aware access
- planner persistence
- fairness data integrity

has already been tackled first.

If we instead read the project against the narrowed repository V2.0 release scope:

- foundation and architecture are largely in place
- Team Core is the main remaining product milestone
- the project is in a late-foundation / mid-completion state rather than an early V2 state

---

## 13. Biggest Remaining Milestones For Practical V2.0 Release

### Highest priority

1. Finish scorecard identity unification
2. Deliver invite flow
3. Finish team creation, join-request, and onboarding flow stability
4. Finish replacing legacy role assumptions with V2 permission checks

### Next priority

5. Complete active-team context cleanup across remaining pages and services
6. Run full V2.0 regression and release-hardening passes

### Moved to V3.0 future scope

7. events and RSVP as first-class modules
8. posts, polls, and comments
9. broader organiser/coordinator event workflows
10. finance and inventory modules

---

## 14. Summary

Compared with the master spec, the project is:

- clearly on the right track
- ahead of the spec in fairness sophistication
- still missing invites, events/RSVP, and communication as major V2 modules

The current implementation is strongest in:

- identity and membership
- planner and fairness
- leadership/member workflow split

The current implementation is weakest against the master spec in:

- invite flows
- event/RSVP productization
- posts/polls/comments

That means the project is not drifting. It is building from the right foundation, with some advanced fairness work already exceeding the original spec.

For the narrowed repository V2.0 release scope, the more practical summary is:

- foundation is mostly there
- Team Core is the main remaining delivery area
- V2.0 is closer to release than the original-spec percentage alone suggests
