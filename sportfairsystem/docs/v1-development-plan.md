# SportFairSystem V1 Development Plan

## Source

This plan is based on the current V1 repository state, the implemented modules in this codebase, and the existing release-readiness guidance in `README.md`.

## Planning Intent

V1 establishes SportFairSystem as a stable single-team operating application for scorecard ingestion, squad identity management, planner support, validation, and analytics.

The implementation and hardening order below is centered on five V1 constraints:

- Preserve parsing correctness and data integrity
- Keep `player_id` as the primary identity anchor where identity matters
- Support one active team in the product experience
- Separate parsing, services, and UI responsibilities cleanly
- Favor release safety over feature expansion

## V1 Product Scope

V1 covers the following operational areas:

- PDF scorecard upload and parsing
- Match preview and insertion
- Team-scoped match storage
- Squad and player identity management
- Planner-based attendance and XI support
- Admin player-user mapping
- Validation and cleanup workflows
- Dashboard, matches, players, profile, and analytics views
- Authentication, role-aware access, and team-scoped data access

## Current Baseline

The current repository already reflects a late-stage V1 system:

- Next.js App Router frontend with TypeScript and Material UI
- Supabase-backed team-scoped data model and row-level security
- PDF parsing and structured cricket match ingestion
- Existing player identity repair logic tied to `player_id`
- Planner workflow for attendance and XI suggestions
- Validation workspace for identity and data-quality cleanup
- Admin-only configuration flows for player-user linking

## Recommended V1 Delivery Strategy

V1 should be treated as a stability-first release, not a feature race.

1. Lock the core ingestion and identity model first.
2. Make team-scoped access reliable across all modules.
3. Harden squad, planner, profile, and validation workflows.
4. Run full regression across dashboard, matches, analytics, and profile surfaces.
5. Ship only after data safety and operational safety are both acceptable.

## Cross-Cutting Workstreams

These workstreams define how V1 should be developed and stabilized.

### 1. Parsing and Match Integrity

- Keep parsing logic independent from UI state
- Protect match insertion from duplicate, partial, or malformed writes
- Keep scorecard preview reviewable before save
- Preserve innings, batting, bowling, and fall-of-wickets consistency

### 2. Identity Integrity

- Use `player_id` as the canonical stats identity
- Repair missing `player_id` links safely
- Avoid duplicate-player ambiguity where names collide
- Support admin-managed mapping between auth users and players

### 3. Team-Scoped Access

- Enforce one active team per authenticated user
- Scope reads and writes by `team_id`
- Limit sensitive operations to admins
- Keep profile and planner behavior safe for partially configured users

### 4. Release Hardening

- Prioritize regressions and blocker fixes over new modules
- Add migration notes and rollout order for required database changes
- Run smoke tests after each meaningful hardening pass
- Keep copy and UI behavior aligned across the major app surfaces

## V1 Phase Plan

## Phase 0: Core Ingestion Foundation

### Goal

Establish a reliable path from uploaded scorecard to structured match data.

### Main Deliverables

- PDF upload flow
- Parsing service for cricket scorecards
- Match preview modal and verification flow
- Match insertion pipeline for:
  - matches
  - innings
  - batting stats
  - bowling stats
  - fall of wickets
  - match players
  - officials where applicable

### Exit Criteria

- A valid scorecard can be uploaded, parsed, previewed, and saved
- Parsing logic stays outside React UI concerns
- Core ingestion writes are internally consistent

### Risks

- Parser changes accidentally coupling to page state
- Partial insert failures leaving match data inconsistent

## Phase 1: Team Scope and Access Control

### Goal

Make the V1 application safe for one real operating team.

### Main Deliverables

- Team table usage and team assignment flows
- `users` profile and team linkage
- Role-aware access model for admin and member
- Team-scoped row-level security

### Exit Criteria

- Authenticated users only see their assigned team data
- Admin-only routes are protected
- Team-scoped writes are enforced consistently

### Risks

- Missing `team_id` assignment blocking users from the app
- Inconsistent route guarding between UI and backend access rules

## Phase 2: Squad Identity and Profile Linking

### Goal

Make player identity reliable across historical and current data.

### Main Deliverables

- Squad browsing and player profile support
- Player metadata improvements
- Admin mapping of auth users to players
- Identity bridge and repair workflows for missing `player_id`
- Profile state handling for linked and unlinked users

### Exit Criteria

- Squad players can be browsed and resolved safely
- Auth users can be linked to player records by admins
- Historical and current-team rows can be repaired without losing identity safety

### Risks

- Duplicate-name ambiguity creating unsafe automatic links
- Profile assumptions breaking for unlinked or partially configured accounts

## Phase 3: Planner and Operational Support

### Goal

Support weekly operational planning for a single team.

### Main Deliverables

- Attendance workbook parsing
- Availability matching against squad identities
- XI, 12th-man, and bench suggestion logic
- Planner UI for weekend selection and operational review

### Exit Criteria

- Admin can upload attendance workbook data
- Planner can match available players and flag unmatched names
- XI support is useful without corrupting match history

### Risks

- Attendance names matching the wrong player
- Planner logic being treated as historical truth instead of an operational suggestion

## Phase 4: Validation and Data Cleanup

### Goal

Give admins a safe workspace to detect and fix data-quality risks.

### Main Deliverables

- Validation dashboard and season filters
- Missing-link detection
- Duplicate-name and guest-candidate review
- Rulebook-aware validation support
- Cleanup workflows for historical data issues

### Exit Criteria

- Admin can identify missing `player_id` and identity-quality issues
- Validation results help reduce release risk
- Cleanup strategy is visible before production release

### Risks

- Validation rules drifting away from actual insertion behavior
- False positives creating cleanup fatigue

## Phase 5: Analytics, Dashboard, and Release Polish

### Goal

Make V1 useful day to day and safe to release.

### Main Deliverables

- Dashboard KPIs and recent match views
- Match listing and match detail pages
- Player profiles and seasonal filtering
- Team and player analytics
- Feedback module
- Responsive and UX consistency passes
- Release QA sweep

### Exit Criteria

- Core app surfaces work reliably for the active team
- Analytics and dashboard views respect team scope and identity linkage
- Release-critical UI and data issues are resolved

### Risks

- Reporting drift if analytics code handles team identity differently from validation or match views
- Late UI fixes masking deeper service-layer issues

## Required V1 Database Work

These migrations are part of the V1 operating baseline:

- `database/v1_team_rls.sql`
- `database/v1_auth_access_control.sql`
- `database/v1_user_profile_fields.sql`
- `database/v1_admin_player_mapping.sql`
- `database/v1_feedback_module.sql`
- `database/phase4_squad_metadata.sql`

## Technical Backlog by Layer

### Database

- Finalize team-scoped RLS
- Maintain player-user mapping support
- Preserve match schema integrity
- Support feedback and squad metadata where enabled

### Services

- parser and text normalization services
- match insertion and query services
- squad and player profile services
- planner services
- analytics and stats services
- validation services
- access control and auth validation services

### Frontend

- upload workflow
- dashboard
- matches
- players and player profiles
- planner
- analytics
- configure workspace
- profile
- validation
- feedback

### QA and Data Safety

- parser smoke tests
- release regression on all major routes
- access-control verification
- identity-link verification
- validation snapshot review

## Suggested V1 Sprint Breakdown

This is the cleanest way to think about the V1 delivery journey:

1. Sprint 1:
   - parser foundation
   - upload and preview
   - match insertion
2. Sprint 2:
   - team scoping
   - auth access control
   - route protection
3. Sprint 3:
   - squad and player identity
   - admin mapping
   - profile handling
4. Sprint 4:
   - planner support
   - validation workspace
   - historical cleanup workflows
5. Sprint 5:
   - dashboard and analytics polish
   - feedback module
   - release QA and hardening

## Immediate Next Actions for V1 Maintenance

If V1 remains active while V2 starts, keep these items visible:

1. Protect the existing parser and match insertion path from regressions.
2. Keep `player_id`-first identity behavior stable.
3. Maintain team-scoped access and admin-only protections.
4. Run regression checks whenever V2 foundation work touches shared services.
5. Treat V1 as the compatibility baseline for all V2 migration work.

## Recommendation

Use V1 as the operational baseline and V2 as the expansion track. V1 should remain stable, single-team, and release-safe while V2 introduces membership, invites, events, communication, and schema-level multi-team readiness in controlled phases.
