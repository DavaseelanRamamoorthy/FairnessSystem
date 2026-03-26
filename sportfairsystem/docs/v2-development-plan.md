# SportFairSystem V2 Development Plan

## Source

This plan is based on `SportFairSystem_V2_Master_Spec.pdf`, the recorded summary in `docs/v2-master-spec-record.md`, and the current V1 codebase in this repository.

## Planning Intent

V2 should evolve the current single-team internal application into a team operating system without breaking the V1 match pipeline, analytics, validation, or player identity model.

The implementation order below is designed around four constraints from the spec:

- Team Member becomes the central entity
- Team, Member, Player, and User must stay separate
- The UI remains single-team at first even if the schema becomes multi-team ready
- The existing `player_id`-first identity model must keep working

## Current Baseline

The current repository already gives us a strong starting point:

- Team-scoped row-level security already exists through `users.team_id`
- Match, innings, player, analytics, planner, and validation modules are already team-aware at the data layer
- Player identity repair already depends on `player_id` and should be preserved
- The current UI still assumes one named team in several places
- Access control currently supports only `admin` and `member`

## Recommended Delivery Strategy

Do not build V2 by replacing V1 wholesale. Build V2 as a compatibility-first expansion:

1. Introduce new membership tables and services beside the current auth model.
2. Add compatibility reads so existing screens continue to function.
3. Migrate UI pages from hardcoded current-team assumptions to active-team context.
4. Deliver new V2 modules phase by phase behind stable service boundaries.

## Current Release Framing

The original V2 master spec includes team operations and lightweight communication modules.

For the current repository release plan, V2.0 is intentionally narrower so it can ship cleanly:

- V2.0 focuses on team foundation, onboarding, membership lifecycle, roles, permissions, identity compatibility, planner/fairness continuity, and release hardening
- events, RSVP, posts, polls, and comments are now treated as V3.0 future scope

This means the plan below should be read in two layers:

- Phases 0-2 plus the multi-team-readiness sweep are the active V2.0 release path
- the former events and communication phases remain useful design references, but they no longer block V2.0 release

## Cross-Cutting Workstreams

These workstreams run across all phases and should be treated as ongoing engineering tracks.

### 1. Compatibility Layer

- Keep existing match schema intact
- Keep `users.player_id` working until member linking fully covers its use cases
- Add service adapters so old pages can resolve the active team and active player safely
- Backfill new tables instead of forcing a big-bang migration

### 2. Team Context

- Replace hardcoded team name and prefix usage with dynamic active-team resolution
- Keep the UI single-team by selecting one active team at login or session level
- Avoid exposing multi-team switching until the schema and services are stable

### 3. Access Model

- Expand role handling from `admin/member` to `admin/captain/player`
- Keep permissions explicit and conservative
- Separate application access from membership role where needed

### 4. Quality Gates

- Add migration rollback notes for every schema change
- Add service-level tests for identity mapping, invite acceptance, role enforcement, and onboarding rules
- Add smoke tests for dashboard, matches, player profile, planner, analytics, and validation after every phase

## Phase Plan

## Phase 0: Team and Membership Foundation

### Goal

Introduce the V2 core entities without breaking V1.

### Main Deliverables

- New tables:
  - `membership_seasons`
  - `team_members`
  - `member_links`
- New service layer for:
  - active team lookup
  - member lookup
  - member-to-user linking
  - member-to-player linking
- Backfill scripts to create initial `team_members` from current squad and user records
- Team context provider to replace hardcoded team config in the UI

### Implementation Notes

- Keep `players` as the stats anchor
- Keep `users` as the auth anchor
- Make `team_members` the operational anchor for membership lifecycle
- `member_links` should allow:
  - member -> user
  - member -> player
  - member -> both
  - member -> neither during invite/pre-link states

### Exit Criteria

- Existing V1 pages still work
- Team name is no longer hardcoded in new code paths
- Every current player can be represented as a member
- Every current user can be mapped to a member without breaking login

### Risks

- Identity duplication if one person is represented inconsistently across user, player, and member
- Over-eager migration could break analytics or validation if they stop resolving `player_id`

## Phase 1: Membership Operations and Role Management

### Goal

Make team membership manageable through the app.

### Main Deliverables

- Admin membership workspace
- CRUD for team members
- Membership status states such as:
  - active
  - inactive
  - invited
  - archived
- Role support for:
  - admin
  - captain
  - player
- Season assignment on memberships

### Implementation Notes

- Keep `users.role` temporarily for compatibility if needed
- Start reading operational permissions from membership role rules
- Add audit-friendly status transitions instead of deletes where possible
- Reuse existing squad metadata patterns where practical

### Exit Criteria

- Admin can create and manage members without touching raw tables
- Captain role exists in schema and service logic
- Membership validity can be filtered by season
- No current V1 admin flow is regressed

### Risks

- Permission drift if `users.role` and membership role disagree
- Ambiguity between a squad player record and a team member record in UI wording

## Phase 2: Invite System and Account Linking

### Goal

Allow members to exist before accounts, then link them safely.

### Main Deliverables

- Invite tokens or codes
- Invite acceptance flow
- Link existing auth user to invited member
- Link invited member to existing player record where applicable
- Pending-member states for people without accounts

### Implementation Notes

- Do not require account creation for all members
- A member should be operationally valid before a linked user exists
- Keep linking idempotent so retries do not create duplicates
- Add collision checks when a user or player is already linked elsewhere

### Exit Criteria

- Admin can invite a member without creating a user first
- A new or existing user can claim an invite
- One member cannot be accidentally linked to multiple conflicting identities
- Existing `player_id` behavior remains intact after linking

### Risks

- Duplicate acceptance or reused invite codes
- Linking flows that bypass current access protections

## V3.0 Future Scope Reference

The following phases are retained as design references from the original master spec, but they are not required for V2.0 release.

## Phase 3: Events and Team Operations

### Goal

Move planner-style coordination into a proper events model.

### Main Deliverables

- `events` table for match and practice
- RSVP model with:
  - available
  - unavailable
  - maybe
- Selection model for:
  - playing XI
  - bench
  - reserves if needed
- Event admin screens
- Event participant and selection services

### Implementation Notes

- Reuse planner heuristics where possible instead of rebuilding selection logic from scratch
- Keep uploaded attendance workbook support as a transitional input if it still adds value
- Treat events as future-facing operational objects, not replacements for historical match records
- Do not merge event selection directly into match ingestion tables

### Exit Criteria

- Team can create a match or practice event
- Members can RSVP
- Admin/Captain can select XI and bench
- Planner and event operations can coexist during transition

### Risks

- Mixing historical scorecard data with pre-match planning data
- Overloading one table to serve both events and recorded matches

## Phase 4: Communication Layer

### Goal

Add lightweight communication, not chat.

### Main Deliverables

- Posts / announcements
- Polls
- Comments on posts and polls
- Notification-ready event hooks if needed later

### Implementation Notes

- Keep the model simple and structured
- Do not implement freeform chat or real-time messaging in V2
- Restrict comments to lightweight interaction and moderation-safe scopes

### Exit Criteria

- Team admins or captains can publish announcements
- Polls can be created and voted on
- Comments work without becoming a chat thread

### Risks

- Scope creep into chat, mentions, reactions, or live feeds
- Unclear moderation and delete rules

## Phase 5: Multi-Team Readiness (Schema Only)

### Goal

Make the architecture truly multi-team capable while keeping the UI simple.

### Main Deliverables

- Remove remaining team-name hardcoding
- Ensure new tables are keyed by `team_id`
- Ensure queries resolve through active team context
- Review unique constraints and indexes for multi-team safety
- Prepare, but do not expose, multi-team switching

### Implementation Notes

- Multi-team readiness is a backend and schema milestone, not a product UX milestone
- Keep one active team in the UI until the operational model is proven
- Validate all service queries for team scoping before calling this phase complete

### Exit Criteria

- All V2 tables and service queries are team-scoped
- UI can still operate as single-team
- No module depends on a hardcoded team literal

### Risks

- Hidden assumptions in analytics, validation, dashboard, and planner queries
- Unique keys that were safe in single-team mode but unsafe across teams

## Technical Backlog by Layer

### Database

- Add membership tables and indexes
- Add invite tables or invite token storage
- Expand RLS to membership-driven access
- Add backfill and verification scripts

### Services

- `teamContextService`
- `membershipService`
- `memberLinkService`
- `inviteService`

### Frontend

- Replace static `teamConfig` assumptions
- Add membership admin UI
- Add invite acceptance UI

### QA and Data Safety

- Regression pass on upload, matches, dashboard, analytics, validation, profile, and planner
- Backfill verification reports for member/user/player relationships
- Permission matrix test pass for admin, captain, player, and unlinked user states

## Suggested Sprint Breakdown

This is the most practical sequencing for development:

1. Sprint 1:
   - active-team context
   - membership schema
   - compatibility adapters
   - backfill plan
2. Sprint 2:
   - membership admin workspace
   - season-based membership logic
   - captain role support
3. Sprint 3:
   - invite generation
   - invite claim and linking
   - duplicate-link protection
4. Sprint 4:
   - final permission convergence
   - dynamic active-team cleanup
   - onboarding hardening
5. Sprint 5:
   - final multi-team readiness sweep
   - regression and release prep

## Immediate Next Actions

These should happen before feature implementation starts:

1. Freeze a V2 schema proposal for `team_members`, `member_links`, and `membership_seasons`.
2. Design the compatibility contract between `users`, `players`, and `team_members`.
3. Replace hardcoded team config reads with an active-team service.
4. Define the permission matrix for admin, captain, player, invited member, and unlinked user.
5. Write backfill rules for current users and players into the new membership model.

## Recommendation

Start V2 with Phase 0 plus the hardcoded-team refactor as one combined foundation milestone. That gives the project the safest path: it honors the spec, protects V1 data behavior, and makes every later phase cheaper to implement.
