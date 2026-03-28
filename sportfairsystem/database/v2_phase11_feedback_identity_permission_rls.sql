-- V2 Phase 11 feedback and identity permission-aware RLS
--
-- Purpose:
-- 1. Move feedback review away from raw admin-only checks toward team workspace capability checks.
-- 2. Move player identity and user-player mapping policies toward organiser / identity permission checks.
-- 3. Keep legacy admin compatibility while the app transitions away from account-role shortcuts.

create or replace function public.can_manage_identity_workspace()
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
      where cm.team_role = 'organiser'
    )
    or exists (
      select 1
      from current_member cm
      join public.team_member_permissions tmp
        on tmp.member_id = cm.id
       and tmp.team_id = public.current_team_id()
      where tmp.permission in ('identity_manage', 'team_settings_manage')
    ),
    false
  );
$$;

comment on function public.can_manage_identity_workspace() is 'Returns true when the authenticated user can manage player identity, links, and user-player mappings for the current team.';

create or replace function public.can_manage_feedback_workspace()
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
      where cm.team_role = 'organiser'
    )
    or exists (
      select 1
      from current_member cm
      join public.team_member_permissions tmp
        on tmp.member_id = cm.id
       and tmp.team_id = public.current_team_id()
      where tmp.permission = 'team_settings_manage'
    ),
    false
  );
$$;

comment on function public.can_manage_feedback_workspace() is 'Returns true when the authenticated user can review and update team feedback for the current team.';

drop policy if exists "feedback_select_admin_team_scope" on public.feedback;
create policy "feedback_select_manage_team_scope"
on public.feedback
for select
using (
  public.can_manage_feedback_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "feedback_update_admin_team_scope" on public.feedback;
create policy "feedback_update_manage_team_scope"
on public.feedback
for update
using (
  public.can_manage_feedback_workspace()
  and team_id = public.current_team_id()
)
with check (
  public.can_manage_feedback_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "users_select_admin_team_scope" on public.users;
create policy "users_select_identity_team_scope"
on public.users
for select
using (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "users_update_admin_team_scope" on public.users;
create policy "users_update_identity_team_scope"
on public.users
for update
using (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
)
with check (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
  and (
    player_id is null
    or exists (
      select 1
      from public.players
      where public.players.id = public.users.player_id
        and public.players.team_id = public.current_team_id()
    )
  )
);

drop policy if exists "players_insert_admin_team_scope" on public.players;
create policy "players_insert_identity_team_scope"
on public.players
for insert
with check (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "players_update_admin_team_scope" on public.players;
create policy "players_update_identity_team_scope"
on public.players
for update
using (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
)
with check (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "players_delete_admin_team_scope" on public.players;
create policy "players_delete_identity_team_scope"
on public.players
for delete
using (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
);

