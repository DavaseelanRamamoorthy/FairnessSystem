# V2.0 Release Signoff Checklist

## Purpose

This document is the practical `Go / No-Go` gate for the narrowed SportFairSystem V2.0 release.

It is intentionally based on the current repository release framing, not the broader original V2 master spec.

## Release Scope

V2.0 includes:

- team foundation and active-team context
- team-code-first onboarding and join requests
- memberships and member lifecycle
- role and permission enforcement
- player and identity compatibility with the existing match pipeline
- planner and fairness continuity
- split organiser/player dashboard experience
- release hardening

V2.0 excludes:

- events and RSVP as first-class modules
- posts, polls, and comments
- broader communication workflows
- dedicated finance and inventory modules

## Release Gate

V2.0 is production-ready only if all sections below are green:

1. Schema and migration readiness
2. Build and static verification
3. Organiser smoke pass
4. Player smoke pass
5. Match pipeline verification
6. Planner and fairness verification
7. Deployment readiness
8. Post-deploy smoke verification

If any required item is red, the release is `No-Go`.

## 1. Schema And Migration Readiness

Required:

- [ ] All required V2 migrations are applied in the target environment
- [ ] Production schema matches the permission-aware RLS model used by the app
- [ ] Rollback notes exist for each production migration batch

Current expected migration floor:

- [ ] `v2_phase7_team_id_short_code.sql`
- [ ] `v2_phase8_join_request_approval_workflow.sql`
- [ ] `v2_phase9_submit_join_request_fix.sql`
- [ ] `v2_phase10_business_roles_alignment.sql`
- [ ] `v2_phase11_feedback_identity_permission_rls.sql`
- [ ] `v2_phase12_membership_permission_rls.sql`
- [ ] `v2_phase13_match_pipeline_permission_rls.sql`

Current status on March 28, 2026:

- user-confirmed locally through Phase 13
- production still needs explicit confirmation before release

## 2. Build And Static Verification

Required:

- [ ] `eslint` passes on the release branch
- [ ] `npx tsc --noEmit` passes on the release branch
- [ ] `npm run build` passes on the release branch

Current status on March 28, 2026:

- build and targeted linting passed during release hardening
- run one final full-branch verification immediately before deployment

## 3. Organiser Smoke Pass

Required organiser flows:

- [x] login
- [x] dashboard loads in `Team View`
- [x] dashboard toggle to `My View`
- [x] memberships workspace loads
- [x] inline member editing is available
- [x] planner loads
- [x] fairness loads
- [x] analytics loads
- [x] validation loads
- [x] feedback loads
- [x] matches loads
- [x] sidebar order matches V2.0 shell design

Status on March 28, 2026:

- pass in local smoke testing

## 4. Player Smoke Pass

Required player flows:

- [x] login
- [x] incomplete-profile guard redirects to profile
- [x] profile can be completed successfully
- [x] dashboard loads in `My View`
- [x] fairness loads as self fairness
- [x] restricted organiser-only workspaces remain guarded

Status on March 28, 2026:

- pass in local smoke testing

Note:

- fairness route header copy was corrected so `/fairness` is no longer described as organiser-only for a normal player

## 5. Match Pipeline Verification

Required:

- [x] upload route is wired to the real match workflow
- [x] scorecard PDF can be selected and parsed
- [x] parser preview opens successfully
- [x] duplicate detection works for already-saved scorecards
- [x] existing saved match can be verified in the matches workspace
- [ ] brand-new unseen PDF insert path is verified end to end in the release environment
- [ ] delete flow is rechecked on release branch or staging
- [ ] validation `Repair Links` is rechecked after a saved match flow

Status on March 28, 2026:

- parser and persistence lookup pass
- duplicate protection pass
- one fresh unseen PDF should still be tested for maximum release confidence

## 6. Planner And Fairness Verification

Required:

- [x] friendly planner loads
- [x] tournament planner entry loads
- [x] fairness workspace loads for organiser
- [x] self fairness loads for player
- [x] dashboard fairness sections render for organiser and player
- [x] previous actual opportunity correction rule is implemented for friendly mode
- [ ] live verification of previous actual-result correction on a real linked previous matchday

Status on March 28, 2026:

- implementation complete
- UI smoke pass is good
- one real-data validation of the correction rule is still recommended before production if available

## 7. Deployment Readiness

Required before pressing deploy:

- [ ] release commit is prepared
- [ ] final release note is written
- [ ] target deployment environment variables are confirmed
- [ ] Supabase project target is confirmed
- [ ] migration state is confirmed in that same target environment
- [ ] branch and deployment target are agreed

## 8. Post-Deploy Smoke Verification

Required after deployment:

- [ ] login works
- [ ] dashboard works for organiser
- [ ] dashboard works for player
- [ ] memberships loads
- [ ] upload parser opens
- [ ] matches list loads
- [ ] planner loads
- [ ] fairness loads
- [ ] analytics loads
- [ ] validation loads
- [ ] no critical console or network failures appear

## Current Release Call

Current call on March 28, 2026:

- `Near-Go`

Why:

- organiser flows passed
- player flows passed
- upload/parser flow passed
- duplicate scorecard detection passed
- saved match lookup passed
- permission-aware shell, memberships, dashboard, planner, and fairness flows are in place

What still prevents an unconditional final `Go`:

- final full-branch lint / typecheck / build rerun on the release branch
- confirmation that the production environment has all required migrations through Phase 13
- ideally one fresh unseen PDF insert test
- post-deploy smoke verification

## Immediate Next Actions

1. Run final branch-wide verification:
   - `npx tsc --noEmit`
   - `npm run build`
   - full release lint command set
2. Confirm production migration state through Phase 13
3. If possible, test one unsaved PDF end to end
4. Prepare the release commit and release note
5. Deploy
6. Run the post-deploy smoke checklist
