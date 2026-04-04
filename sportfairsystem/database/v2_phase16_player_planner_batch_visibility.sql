create or replace function public.can_view_planner_batch(target_batch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.planner_matchday_assignments
    where public.planner_matchday_assignments.batch_id = target_batch_id
      and public.planner_matchday_assignments.team_id = public.current_team_id()
      and public.planner_matchday_assignments.member_id = public.current_team_member_id()
  );
$$;

comment on function public.can_view_planner_batch(uuid) is 'Returns true when the signed-in member belongs to the given saved planner batch.';

drop policy if exists "planner_matchday_batches_select_team_scope" on public.planner_matchday_batches;
create policy "planner_matchday_batches_select_team_scope"
on public.planner_matchday_batches
for select
using (
  team_id = public.current_team_id()
  and (
    public.can_access_fairness_workspace()
    or public.can_view_planner_batch(id)
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
    or public.can_view_planner_batch(batch_id)
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
    or public.can_view_planner_batch(batch_id)
  )
);
