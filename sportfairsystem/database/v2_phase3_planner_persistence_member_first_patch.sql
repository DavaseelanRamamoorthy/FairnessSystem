-- Patch existing planner persistence tables to support member-first planner saving.
--
-- Run this if you already applied v2_phase3_planner_persistence.sql before the
-- member-first planner save fix landed.

alter table public.planner_matchday_assignments
  alter column player_id drop not null;

alter table public.planner_matchday_assignments
  drop constraint if exists planner_matchday_assignments_batch_match_player_unique;

alter table public.planner_matchday_assignments
  drop constraint if exists planner_matchday_assignments_player_or_member_required;

alter table public.planner_matchday_assignments
  add constraint planner_matchday_assignments_player_or_member_required
  check (player_id is not null or member_id is not null);

drop index if exists public.planner_matchday_assignments_batch_match_member_unique;
create unique index if not exists planner_matchday_assignments_batch_match_member_unique
  on public.planner_matchday_assignments (batch_id, match_number, member_id)
  where member_id is not null;

drop index if exists public.planner_matchday_assignments_batch_match_player_unique;
create unique index if not exists planner_matchday_assignments_batch_match_player_unique
  on public.planner_matchday_assignments (batch_id, match_number, player_id)
  where member_id is null and player_id is not null;

create index if not exists planner_matchday_assignments_team_member_idx
  on public.planner_matchday_assignments (team_id, member_id, created_at desc);
