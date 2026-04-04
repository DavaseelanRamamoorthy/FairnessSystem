# SportFairSystem V2.1 Release Spec

## Purpose

This document records the practical V2.1 release scope from the April 3, 2026 product spec so future implementation work can be tracked inside the repository.

Source reference:

- [SportFairSystem_V2_1_Spec.pdf](E:\Moonwalkers\Documents\V2.0\V2.1\SportFairSystem_V2_1_Spec.pdf)

## Release Objective

Stabilize key workflows and begin the transition away from Excel-only attendance handling toward native in-app attendance tracking.

## Product Direction

- Excel attendance is a temporary compatibility path
- native attendance tracking is the long-term operating model
- V2.1 should prioritize workflow stability before broader feature expansion
- SMTP and outbound email infrastructure can be deferred if the current release remains a small-team internal rollout

## V2.1 Scope Overview

1. Planner reset (minimal fix)
2. Membership flow simplification
3. Membership metadata save fix
4. Responsive UI improvements
5. Native Attendance Tracking (Phase 1)

## Scope Details

### 1. Planner Reset

Goal:

- reduce stale planner state and confusing carry-over between runs

Expected behavior:

- planner should expose a clear reset action
- planner state should clear after save when appropriate
- mode switches should not keep stale workbook or generated suggestion state

Notes:

- this is a minimal-fix stabilization item
- this is the safest first V2.1 slice because it improves an existing workflow without introducing new schema or infrastructure risk

### 2. Membership Flow Simplification

Goal:

- make the memberships workflow more predictable and easier to operate

Expected direction:

- reduce unnecessary branching in the member-edit flow
- keep the inline membership model consistent
- preserve the manual-first approach without adding email dependency to normal member editing

### 3. Membership Metadata Save Fix

Goal:

- make metadata changes inside memberships reliable and easier to trust

Expected direction:

- audit inline metadata save behavior
- ensure player metadata changes persist consistently from the memberships workspace
- remove edge cases where the UI appears updated but the saved record is not

### 4. Responsive UI Improvements

Goal:

- improve usability on smaller screens without redesigning the entire app

Expected scope:

- dashboard responsiveness
- memberships responsiveness
- planner responsiveness
- feedback and validation polish where needed

### 5. Native Attendance Tracking (Phase 1)

Goal:

- begin replacing Excel attendance with native in-app attendance capture

Phase 1 product model:

- organiser creates an attendance session
- organiser records availability directly in the app
- saved attendance is usable by planner without requiring Excel import

Availability states:

1. Available
2. Not Available
3. Maybe

Expected direction:

- Phase 1 should coexist with the current Excel planner input
- native attendance should be introduced incrementally, not as a hard cutover

## Testing Scope

V2.1 testing should cover:

1. Planner using both Excel attendance and native attendance
2. Membership create/edit flows
3. Authentication flows
4. Mobile and responsive behavior

## Expected Outcome

V2.1 should deliver:

- more stable planner workflows
- reduced dependency on Excel attendance sheets
- a scalable base for native attendance
- production-ready authentication support through SMTP

## Suggested Implementation Order

Recommended order for repository work:

1. Planner reset and stale-state cleanup
2. Membership flow simplification
3. Membership metadata save fix
4. Responsive UI improvements on touched surfaces
5. Native Attendance Tracking Phase 1

## Deferred Future Scope

### SMTP (Mailjet) Integration

Status:

- deferred from V2.1 active implementation

Reason for deferral:

- the current rollout is still a small-team internal usage model
- no organisational sender domain is in place yet
- mail infrastructure is better added once a stable sender identity is available

Future direction:

- configure Mailjet SMTP for Supabase authentication emails
- add app-side outbound email delivery for membership invites and approval flows
- use a proper sender domain when the team is ready for production-grade email delivery

## Current Tracking Status

Status on April 3, 2026:

- V2.1 spec imported into repository docs
- planner reset implementation started
- Mailjet SMTP moved to deferred future scope
- remaining active V2.1 items are still pending
