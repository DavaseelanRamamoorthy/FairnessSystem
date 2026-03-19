# SportFairSystem

SportFairSystem is a cricket scorecard ingestion, squad management, planner, validation, and analytics platform for an internal team workflow. The product is in late V1 hardening, with the focus on release readiness, stability, identity linkage, and QA rather than new feature expansion.

## Core Principle

Parsing logic must remain independent of React state and UI concerns.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Material UI
- Supabase
- PDF.js / pdfjs-dist
- Recharts

## Current Product Workflow

1. Upload a cricket scorecard PDF.
2. Extract structured match data from the document.
3. Preview and save the parsed match to Supabase.
4. Manage squad identity, player-user mapping, and planner attendance.
5. Review validation findings for historical cleanup and release safety.
6. Surface match, player, dashboard, and analytics insights for the current team.

## Current Capabilities

- Parse cricket scorecard PDFs into structured match data
- Extract match metadata, innings summaries, batting stats, bowling stats, extras, and fall of wickets
- Preview parsed scorecards before saving
- Detect known vs new players during match import
- Bridge player identity into historical match data with player_id-first logic
- Manage planner attendance and squad identity matching
- Map auth users to squad players through an admin-only configure workspace
- Validate missing links, duplicate-name risks, guest candidates, and rulebook findings
- Show dashboard KPIs, recent matches, leaderboards, trend charts, and season analytics
- Display match detail views, player profiles, and profile assignment states

## Architecture Overview

The project is built with a separation between UI, services, and data access so the parsing and business logic can evolve without being tightly coupled to the frontend.

### Main Layers

- UI layer: Next.js pages, layout, tables, charts, scorecard views, and admin workspaces
- Service layer: PDF parsing, match insertion, identity repair, querying, formatting, validation, and stats aggregation
- Data layer: Supabase tables for matches, innings, batting stats, bowling stats, fall of wickets, match players, users, and players

## V1 Status

SportFairSystem is feature-rich and already functional. V1 scope is now locked, and current work should stay inside release hardening:

- squad identity bridge
- planner identity matching
- admin player-user mapping
- pending assignment UX
- auth and profile hardening
- player profile polish
- dashboard and analytics QA
- matches and player views consistency pass
- historical data cleanup strategy
- validation workspace final pass
- release QA sweep
- V1.0 release lock

## Required V1 Database Migrations

Run these in Supabase before final release verification:

- `database/v1_team_rls.sql`
- `database/v1_auth_access_control.sql`
- `database/v1_user_profile_fields.sql`
- `database/v1_admin_player_mapping.sql`

## Release Lock Rules

- Prefer existing architecture over introducing new patterns
- Do not hardcode team-specific values into reusable theme or preset logic
- Use player_id-first logic where identity matters
- Keep UI changes consistent across light and dark mode
- Focus on production-safe behavior, not UI-only fixes
- If a change supports the V1 checklist, do it now
- If a change is a true release blocker, do it now
- Otherwise mark it as Post-V1.0 / Future Scope

## Post-V1 / Future Scope

These items are intentionally out of scope during V1 hardening unless one becomes a true blocker:

- team creation flow
- invite flow
- join request flow
- full membership model refactor
- multi-team support
- expanded ownership hierarchy
- major auth product redesign
- new major modules
- non-blocking feature ideas
- nice-to-have UI experiments

## Summary

SportFairSystem now targets a production-safe V1 release for a single internal team workflow: ingest scorecards, manage squad identity, validate data quality, and surface team/player analytics. The longer-term platform vision remains broader, but the release branch is now locked to V1 hardening and blocker-level fixes only.
