-- V2 Phase 4 member fairness self access
--
-- Purpose:
-- 1. Keep /fairness leadership-only.
-- 2. Allow /my-fairness to read only the signed-in member's own planner fairness rows.
-- 3. Preserve organiser/captain access to the full team fairness workspace.

create or replace function public.current_team_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tm.id
  from public.users u
  join public.team_members tm
    on tm.user_id = u.id
   and tm.team_id = u.team_id
  where u.id = auth.uid()
    and u.team_id = public.current_team_id()
  limit 1;
$$;

comment on function public.current_team_member_id() is 'Returns the signed-in user''s current team member id when available.';

drop policy if exists "planner_matchday_batches_select_team_scope" on public.planner_matchday_batches;
create policy "planner_matchday_batches_select_team_scope"
on public.planner_matchday_batches
for select
using (
  team_id = public.current_team_id()
  and (
    public.can_access_fairness_workspace()
    or exists (
      select 1
      from public.planner_matchday_assignments
      where public.planner_matchday_assignments.batch_id = public.planner_matchday_batches.id
        and public.planner_matchday_assignments.team_id = public.current_team_id()
        and public.planner_matchday_assignments.member_id = public.current_team_member_id()
    )
  )
);

drop policy if exists "planner_matchday_assignments_select_team_scope" on public.planner_matchday_assignments;
create policy "planner_matchday_assignments_select_team_scope"
on public.planner_matchday_assignments
for select
using (
  team_id = public.current_team_id()
  and (
    public.can_access_fairness_workspace()
    or member_id = public.current_team_member_id()
  )
);

drop policy if exists "planner_matchday_actual_links_select_team_scope" on public.planner_matchday_actual_links;
create policy "planner_matchday_actual_links_select_team_scope"
on public.planner_matchday_actual_links
for select
using (
  team_id = public.current_team_id()
  and (
    public.can_access_fairness_workspace()
    or exists (
      select 1
      from public.planner_matchday_assignments
      where public.planner_matchday_assignments.batch_id = public.planner_matchday_actual_links.batch_id
        and public.planner_matchday_assignments.team_id = public.current_team_id()
        and public.planner_matchday_assignments.member_id = public.current_team_member_id()
    )
  )
);
