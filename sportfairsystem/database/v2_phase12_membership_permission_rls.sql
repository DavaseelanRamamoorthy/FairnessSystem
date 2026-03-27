-- V2 Phase 12 membership permission-aware RLS
--
-- Purpose:
-- 1. Move membership foundation tables off raw admin-only RLS.
-- 2. Align membership writes with the V2 organiser / scoped-permission access model.
-- 3. Keep legacy admin compatibility while the app completes the transition.

create or replace function public.can_manage_membership_records_for_current_team()
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
      where tmp.permission = 'members_manage'
    ),
    false
  );
$$;

comment on function public.can_manage_membership_records_for_current_team() is 'Returns true when the authenticated user can update team member status/season records for the current team.';

create or replace function public.can_manage_membership_structure_for_current_team()
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

comment on function public.can_manage_membership_structure_for_current_team() is 'Returns true when the authenticated user can manage seasons, team-member roles, and scoped membership permissions for the current team.';

drop policy if exists "membership_seasons_insert_admin_team_scope" on public.membership_seasons;
create policy "membership_seasons_insert_manage_team_scope"
on public.membership_seasons
for insert
with check (
  public.can_manage_membership_structure_for_current_team()
  and team_id = public.current_team_id()
);

drop policy if exists "membership_seasons_update_admin_team_scope" on public.membership_seasons;
create policy "membership_seasons_update_manage_team_scope"
on public.membership_seasons
for update
using (
  public.can_manage_membership_structure_for_current_team()
  and team_id = public.current_team_id()
)
with check (
  public.can_manage_membership_structure_for_current_team()
  and team_id = public.current_team_id()
);

drop policy if exists "membership_seasons_delete_admin_team_scope" on public.membership_seasons;
create policy "membership_seasons_delete_manage_team_scope"
on public.membership_seasons
for delete
using (
  public.can_manage_membership_structure_for_current_team()
  and team_id = public.current_team_id()
);

drop policy if exists "team_members_insert_admin_team_scope" on public.team_members;
create policy "team_members_insert_manage_team_scope"
on public.team_members
for insert
with check (
  (
    public.can_manage_membership_structure_for_current_team()
    or public.can_manage_membership_records_for_current_team()
    or public.can_manage_identity_workspace()
  )
  and team_id = public.current_team_id()
  and (
    season_id is null
    or exists (
      select 1
      from public.membership_seasons
      where public.membership_seasons.id = public.team_members.season_id
        and public.membership_seasons.team_id = public.current_team_id()
    )
  )
  and (
    user_id is null
    or exists (
      select 1
      from public.users
      where public.users.id = public.team_members.user_id
        and public.users.team_id = public.current_team_id()
    )
  )
);

drop policy if exists "team_members_update_admin_team_scope" on public.team_members;
create policy "team_members_update_manage_team_scope"
on public.team_members
for update
using (
  (
    public.can_manage_membership_structure_for_current_team()
    or public.can_manage_membership_records_for_current_team()
    or public.can_manage_identity_workspace()
  )
  and team_id = public.current_team_id()
)
with check (
  (
    public.can_manage_membership_structure_for_current_team()
    or public.can_manage_membership_records_for_current_team()
    or public.can_manage_identity_workspace()
  )
  and team_id = public.current_team_id()
  and (
    season_id is null
    or exists (
      select 1
      from public.membership_seasons
      where public.membership_seasons.id = public.team_members.season_id
        and public.membership_seasons.team_id = public.current_team_id()
    )
  )
  and (
    user_id is null
    or exists (
      select 1
      from public.users
      where public.users.id = public.team_members.user_id
        and public.users.team_id = public.current_team_id()
    )
  )
);

drop policy if exists "team_members_delete_admin_team_scope" on public.team_members;
create policy "team_members_delete_manage_team_scope"
on public.team_members
for delete
using (
  public.can_manage_membership_structure_for_current_team()
  and team_id = public.current_team_id()
);

drop policy if exists "member_links_insert_admin_team_scope" on public.member_links;
create policy "member_links_insert_identity_team_scope"
on public.member_links
for insert
with check (
  public.can_manage_identity_workspace()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.member_links.member_id
      and public.team_members.team_id = public.current_team_id()
  )
  and (
    user_id is null
    or exists (
      select 1
      from public.users
      where public.users.id = public.member_links.user_id
        and public.users.team_id = public.current_team_id()
    )
  )
  and (
    player_id is null
    or exists (
      select 1
      from public.players
      where public.players.id = public.member_links.player_id
        and public.players.team_id = public.current_team_id()
    )
  )
);

drop policy if exists "member_links_update_admin_team_scope" on public.member_links;
create policy "member_links_update_identity_team_scope"
on public.member_links
for update
using (
  public.can_manage_identity_workspace()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.member_links.member_id
      and public.team_members.team_id = public.current_team_id()
  )
)
with check (
  public.can_manage_identity_workspace()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.member_links.member_id
      and public.team_members.team_id = public.current_team_id()
  )
  and (
    user_id is null
    or exists (
      select 1
      from public.users
      where public.users.id = public.member_links.user_id
        and public.users.team_id = public.current_team_id()
    )
  )
  and (
    player_id is null
    or exists (
      select 1
      from public.players
      where public.players.id = public.member_links.player_id
        and public.players.team_id = public.current_team_id()
    )
  )
);

drop policy if exists "member_links_delete_admin_team_scope" on public.member_links;
create policy "member_links_delete_identity_team_scope"
on public.member_links
for delete
using (
  public.can_manage_identity_workspace()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.member_links.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "team_member_aliases_insert_admin_team_scope" on public.team_member_aliases;
create policy "team_member_aliases_insert_identity_team_scope"
on public.team_member_aliases
for insert
with check (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.team_member_aliases.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "team_member_aliases_update_admin_team_scope" on public.team_member_aliases;
create policy "team_member_aliases_update_identity_team_scope"
on public.team_member_aliases
for update
using (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
)
with check (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.team_member_aliases.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "team_member_aliases_delete_admin_team_scope" on public.team_member_aliases;
create policy "team_member_aliases_delete_identity_team_scope"
on public.team_member_aliases
for delete
using (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "team_member_permissions_insert_admin_team_scope" on public.team_member_permissions;
create policy "team_member_permissions_insert_manage_team_scope"
on public.team_member_permissions
for insert
with check (
  public.can_manage_membership_structure_for_current_team()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.team_member_permissions.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "team_member_permissions_update_admin_team_scope" on public.team_member_permissions;
create policy "team_member_permissions_update_manage_team_scope"
on public.team_member_permissions
for update
using (
  public.can_manage_membership_structure_for_current_team()
  and team_id = public.current_team_id()
)
with check (
  public.can_manage_membership_structure_for_current_team()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.team_member_permissions.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "team_member_permissions_delete_admin_team_scope" on public.team_member_permissions;
create policy "team_member_permissions_delete_manage_team_scope"
on public.team_member_permissions
for delete
using (
  public.can_manage_membership_structure_for_current_team()
  and team_id = public.current_team_id()
);

