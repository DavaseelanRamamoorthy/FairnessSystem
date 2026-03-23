-- V2 Phase 4 planner actual reconciliation
--
-- Purpose:
-- 1. Link each saved friendly planner match slot to the real saved scorecard.
-- 2. Allow organiser/captain fairness workspace users to manage reconciliation links.
-- 3. Keep fairness tracking ready for planned-vs-actual comparisons.

create or replace function public.can_access_fairness_workspace()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with current_user_row as (
    select u.id, u.team_id, u.role
    from public.users u
    where u.id = auth.uid()
  ),
  current_member as (
    select tm.id, tm.team_role
    from current_user_row cu
    join public.team_members tm
      on tm.user_id = cu.id
     and tm.team_id = cu.team_id
  )
  select coalesce(
    exists (
      select 1
      from current_user_row cu
      where cu.team_id = public.current_team_id()
        and cu.role = 'admin'
    )
    or exists (
      select 1
      from current_member cm
      where cm.team_role in ('organiser', 'coordinator')
    )
    or exists (
      select 1
      from current_member cm
      join public.team_member_permissions tmp
        on tmp.member_id = cm.id
       and tmp.team_id = public.current_team_id()
      where tmp.permission = 'planner_manage'
    ),
    false
  );
$$;

comment on function public.can_access_fairness_workspace() is 'Returns true when the authenticated user can access organiser/captain fairness workflows.';

create table if not exists public.planner_matchday_actual_links (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.planner_matchday_batches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  match_number integer not null check (match_number between 1 and 3),
  match_id uuid not null references public.matches(id) on delete cascade,
  linked_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint planner_matchday_actual_links_batch_match_unique unique (batch_id, match_number),
  constraint planner_matchday_actual_links_match_unique unique (match_id)
);

create index if not exists planner_matchday_actual_links_team_batch_idx
  on public.planner_matchday_actual_links (team_id, batch_id, match_number);

create index if not exists planner_matchday_actual_links_team_match_idx
  on public.planner_matchday_actual_links (team_id, match_id);

alter table public.planner_matchday_actual_links enable row level security;

drop policy if exists "planner_matchday_actual_links_select_team_scope" on public.planner_matchday_actual_links;
create policy "planner_matchday_actual_links_select_team_scope"
on public.planner_matchday_actual_links
for select
using (team_id = public.current_team_id());

drop policy if exists "planner_matchday_actual_links_insert_fairness_team_scope" on public.planner_matchday_actual_links;
create policy "planner_matchday_actual_links_insert_fairness_team_scope"
on public.planner_matchday_actual_links
for insert
with check (
  public.can_access_fairness_workspace()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.planner_matchday_batches
    where public.planner_matchday_batches.id = public.planner_matchday_actual_links.batch_id
      and public.planner_matchday_batches.team_id = public.current_team_id()
  )
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.planner_matchday_actual_links.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "planner_matchday_actual_links_update_fairness_team_scope" on public.planner_matchday_actual_links;
create policy "planner_matchday_actual_links_update_fairness_team_scope"
on public.planner_matchday_actual_links
for update
using (
  public.can_access_fairness_workspace()
  and team_id = public.current_team_id()
)
with check (
  public.can_access_fairness_workspace()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.planner_matchday_batches
    where public.planner_matchday_batches.id = public.planner_matchday_actual_links.batch_id
      and public.planner_matchday_batches.team_id = public.current_team_id()
  )
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.planner_matchday_actual_links.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "planner_matchday_actual_links_delete_fairness_team_scope" on public.planner_matchday_actual_links;
create policy "planner_matchday_actual_links_delete_fairness_team_scope"
on public.planner_matchday_actual_links
for delete
using (
  public.can_access_fairness_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "planner_matchday_batches_update_admin_team_scope" on public.planner_matchday_batches;
create policy "planner_matchday_batches_update_fairness_team_scope"
on public.planner_matchday_batches
for update
using (
  public.can_access_fairness_workspace()
  and team_id = public.current_team_id()
)
with check (
  public.can_access_fairness_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "planner_matchday_batches_delete_admin_team_scope" on public.planner_matchday_batches;
create policy "planner_matchday_batches_delete_fairness_team_scope"
on public.planner_matchday_batches
for delete
using (
  public.can_access_fairness_workspace()
  and team_id = public.current_team_id()
);

comment on table public.planner_matchday_actual_links is 'Links each saved planner match slot to the actual saved match scorecard used for authentic fairness reconciliation.';
