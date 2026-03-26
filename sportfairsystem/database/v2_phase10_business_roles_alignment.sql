-- V2 Phase 10 business role alignment
--
-- Purpose:
-- 1. Align team business roles with the V2.0 model:
--    organiser, captain, finance, coordinator, inventory_manager, player.
-- 2. Re-seed default scoped permissions for the new role bundles.
-- 3. Update invite and join-request approval flows to accept the new role names.

alter table public.team_members
  drop constraint if exists team_members_team_role_check;

update public.team_members
set team_role = case
  when team_role = 'organiser' then 'organiser'
  when team_role = 'captain' then 'captain'
  when team_role = 'coordinator' and role = 'captain' then 'captain'
  when team_role = 'coordinator' then 'coordinator'
  when team_role = 'financer' then 'finance'
  when team_role = 'finance' then 'finance'
  when team_role = 'inventory_manager' then 'inventory_manager'
  when team_role = 'member' then 'player'
  when team_role = 'player' then 'player'
  when role = 'admin' then 'organiser'
  when role = 'captain' then 'captain'
  else 'player'
end;

alter table public.team_members
  add constraint team_members_team_role_check
  check (
    team_role is null
    or team_role in ('organiser', 'captain', 'finance', 'coordinator', 'inventory_manager', 'player')
  );

comment on column public.team_members.team_role is 'Business role in the team: organiser, captain, finance, coordinator, inventory_manager, or player.';

alter table public.team_invites
  drop constraint if exists team_invites_invited_role_check;

update public.team_invites
set invited_role = case
  when invited_role = 'admin' then 'organiser'
  when invited_role = 'captain' then 'captain'
  when invited_role = 'financer' then 'finance'
  when invited_role = 'member' then 'player'
  when invited_role in ('organiser', 'finance', 'coordinator', 'inventory_manager', 'player') then invited_role
  else 'player'
end;

alter table public.team_invites
  add constraint team_invites_invited_role_check
  check (invited_role in ('organiser', 'captain', 'finance', 'coordinator', 'inventory_manager', 'player'));

delete from public.team_member_permissions;

insert into public.team_member_permissions (team_id, member_id, permission)
select
  members.team_id,
  members.id,
  permission_map.permission
from public.team_members members
cross join (
  values
    ('team_settings_manage'),
    ('members_manage'),
    ('invites_manage'),
    ('identity_manage'),
    ('attendance_manage'),
    ('planner_manage'),
    ('stats_manage'),
    ('finance_manage'),
    ('inventory_manage'),
    ('events_manage')
) as permission_map(permission)
where members.team_role = 'organiser'
on conflict (member_id, permission) do nothing;

insert into public.team_member_permissions (team_id, member_id, permission)
select
  members.team_id,
  members.id,
  permission_map.permission
from public.team_members members
cross join (
  values
    ('members_manage'),
    ('invites_manage'),
    ('attendance_manage'),
    ('planner_manage')
) as permission_map(permission)
where members.team_role = 'coordinator'
on conflict (member_id, permission) do nothing;

insert into public.team_member_permissions (team_id, member_id, permission)
select
  members.team_id,
  members.id,
  'finance_manage'
from public.team_members members
where members.team_role = 'finance'
on conflict (member_id, permission) do nothing;

insert into public.team_member_permissions (team_id, member_id, permission)
select
  members.team_id,
  members.id,
  'inventory_manage'
from public.team_members members
where members.team_role = 'inventory_manager'
on conflict (member_id, permission) do nothing;

drop function if exists public.approve_team_join_request(uuid, text, uuid, uuid);

create or replace function public.approve_team_join_request(
  target_request_id uuid,
  next_role text,
  next_season_id uuid,
  existing_member_id uuid default null
)
returns table (
  request_id uuid,
  team_id uuid,
  member_id uuid,
  requester_user_id uuid,
  team_name text,
  requester_name text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  request_row public.team_join_requests%rowtype;
  requester_user_row public.users%rowtype;
  existing_member_row public.team_members%rowtype;
  selected_member_row public.team_members%rowtype;
  next_member_id uuid;
  next_legacy_role text;
  next_user_role text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to approve a team request.';
  end if;

  if next_role not in ('organiser', 'captain', 'finance', 'coordinator', 'inventory_manager', 'player') then
    raise exception 'Select a valid membership role before approving.';
  end if;

  select *
  into request_row
  from public.team_join_requests
  where id = target_request_id;

  if not found then
    raise exception 'The selected join request no longer exists.';
  end if;

  if request_row.status <> 'pending' then
    raise exception 'Only pending join requests can be approved.';
  end if;

  if request_row.team_id <> public.current_team_id() or not public.can_manage_team_invites_for_current_team() then
    raise exception 'You do not have permission to approve this team request.';
  end if;

  if next_season_id is null then
    raise exception 'Select a season before approving this request.';
  end if;

  if not exists (
    select 1
    from public.membership_seasons ms
    where ms.id = next_season_id
      and ms.team_id = request_row.team_id
  ) then
    raise exception 'The selected season is not valid for this team.';
  end if;

  select *
  into requester_user_row
  from public.users
  where id = request_row.requester_user_id;

  if not found then
    raise exception 'The requesting user account no longer exists.';
  end if;

  if requester_user_row.team_id is not null and requester_user_row.team_id <> request_row.team_id then
    raise exception 'This account already belongs to another team.';
  end if;

  next_legacy_role :=
    case next_role
      when 'organiser' then 'admin'
      when 'captain' then 'captain'
      else 'player'
    end;

  next_user_role :=
    case next_role
      when 'organiser' then 'admin'
      else 'member'
    end;

  select *
  into existing_member_row
  from public.team_members
  where team_id = request_row.team_id
    and user_id = request_row.requester_user_id
  limit 1;

  if found then
    if existing_member_id is not null and existing_member_row.id <> existing_member_id then
      raise exception 'This account is already linked to another membership in the team.';
    end if;

    update public.team_members
    set season_id = next_season_id,
        role = next_legacy_role,
        team_role = next_role,
        status = 'active',
        joined_at = coalesce(joined_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
    where id = existing_member_row.id;

    next_member_id := existing_member_row.id;
  elsif existing_member_id is not null then
    select *
    into selected_member_row
    from public.team_members
    where id = existing_member_id
      and team_id = request_row.team_id;

    if not found then
      raise exception 'The selected existing member no longer exists.';
    end if;

    if selected_member_row.user_id is not null and selected_member_row.user_id <> request_row.requester_user_id then
      raise exception 'The selected member is already linked to another account.';
    end if;

    update public.team_members
    set user_id = request_row.requester_user_id,
        season_id = next_season_id,
        role = next_legacy_role,
        team_role = next_role,
        status = 'active',
        joined_at = coalesce(joined_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
    where id = selected_member_row.id;

    next_member_id := selected_member_row.id;
  else
    insert into public.team_members (
      team_id,
      season_id,
      user_id,
      name,
      role,
      team_role,
      status,
      joined_at,
      updated_at
    )
    values (
      request_row.team_id,
      next_season_id,
      request_row.requester_user_id,
      request_row.requester_name,
      next_legacy_role,
      next_role,
      'active',
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning id into next_member_id;
  end if;

  perform set_config('app.bypass_user_admin_fields', 'on', true);

  update public.users
  set team_id = request_row.team_id,
      role = next_user_role,
      updated_at = timezone('utc', now())
  where id = request_row.requester_user_id;

  insert into public.member_links (member_id, user_id)
  values (next_member_id, request_row.requester_user_id)
  on conflict on constraint member_links_member_unique do update
    set user_id = excluded.user_id;

  update public.team_join_requests
  set status = 'approved',
      created_member_id = next_member_id,
      resolved_by_user_id = current_user_id,
      resolved_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = request_row.id;

  request_id := request_row.id;
  team_id := request_row.team_id;
  member_id := next_member_id;
  requester_user_id := request_row.requester_user_id;
  requester_name := request_row.requester_name;
  status := 'approved';

  select t.name
  into team_name
  from public.teams t
  where t.id = request_row.team_id;

  return next;
end;
$$;

comment on function public.approve_team_join_request(uuid, text, uuid, uuid) is 'Approves a pending join request using required business role and season inputs, optionally linking the requester to an existing unclaimed member.';

grant execute on function public.approve_team_join_request(uuid, text, uuid, uuid) to authenticated;

create or replace function public.accept_team_invite(invite_token text)
returns table (
  invite_id uuid,
  team_id uuid,
  member_id uuid,
  invite_type text,
  created_member boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  current_user_row public.users%rowtype;
  invite_row public.team_invites%rowtype;
  existing_member_row public.team_members%rowtype;
  linked_player_id uuid;
  next_member_id uuid;
  created_new_member boolean := false;
  next_business_role text;
  next_legacy_role text;
  next_user_role text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to accept an invite.';
  end if;

  if current_user_email = '' then
    raise exception 'Could not confirm the signed-in account email for this invite.';
  end if;

  select *
  into current_user_row
  from public.users
  where id = current_user_id;

  if not found then
    raise exception 'Your app profile is not ready yet.';
  end if;

  select *
  into invite_row
  from public.team_invites
  where token_hash = public.hash_invite_token(invite_token);

  if not found then
    raise exception 'This invite is invalid or no longer available.';
  end if;

  if lower(invite_row.email) <> current_user_email then
    raise exception 'This invite was sent to a different email address.';
  end if;

  if invite_row.status <> 'pending' then
    raise exception 'This invite is no longer pending.';
  end if;

  if invite_row.token_expires_at < timezone('utc', now()) then
    update public.team_invites
    set status = 'expired',
        updated_at = timezone('utc', now())
    where id = invite_row.id;

    raise exception 'This invite has expired.';
  end if;

  if current_user_row.team_id is not null and current_user_row.team_id <> invite_row.team_id then
    raise exception 'This account already belongs to another team in the current single-team setup.';
  end if;

  next_business_role :=
    case invite_row.invited_role
      when 'admin' then 'organiser'
      when 'captain' then 'captain'
      when 'financer' then 'finance'
      when 'member' then 'player'
      when 'organiser' then 'organiser'
      when 'finance' then 'finance'
      when 'coordinator' then 'coordinator'
      when 'inventory_manager' then 'inventory_manager'
      else 'player'
    end;

  next_legacy_role :=
    case next_business_role
      when 'organiser' then 'admin'
      when 'captain' then 'captain'
      else 'player'
    end;

  next_user_role :=
    case next_business_role
      when 'organiser' then 'admin'
      else 'member'
    end;

  select tm.*
  into existing_member_row
  from public.team_members tm
  where tm.team_id = invite_row.team_id
    and tm.user_id = current_user_id
  limit 1;

  if found then
    if invite_row.invite_type = 'existing_member' and existing_member_row.id <> invite_row.member_id then
      raise exception 'This account is already linked to another membership in the same team.';
    end if;

    if invite_row.invite_type = 'new_member' then
      raise exception 'This account is already linked to this team.';
    end if;
  end if;

  if invite_row.invite_type = 'existing_member' then
    select *
    into existing_member_row
    from public.team_members
    where id = invite_row.member_id
      and team_id = invite_row.team_id;

    if not found then
      raise exception 'The invited member record no longer exists.';
    end if;

    if existing_member_row.user_id is not null and existing_member_row.user_id <> current_user_id then
      raise exception 'This team member has already been claimed by another account.';
    end if;

    select ml.player_id
    into linked_player_id
    from public.member_links ml
    where ml.member_id = existing_member_row.id
    limit 1;

    update public.team_members
    set user_id = current_user_id,
        status = 'active',
        joined_at = coalesce(joined_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
    where id = existing_member_row.id;

    insert into public.member_links (member_id, user_id, player_id)
    values (existing_member_row.id, current_user_id, linked_player_id)
    on conflict (member_id) do update
      set user_id = excluded.user_id;

    next_member_id := existing_member_row.id;
  else
    insert into public.team_members (
      team_id,
      season_id,
      user_id,
      name,
      role,
      team_role,
      status,
      joined_at,
      invited_by_user_id,
      updated_at
    )
    values (
      invite_row.team_id,
      invite_row.season_id,
      current_user_id,
      invite_row.invite_name,
      next_legacy_role,
      next_business_role,
      'active',
      timezone('utc', now()),
      invite_row.invited_by_user_id,
      timezone('utc', now())
    )
    returning id into next_member_id;

    insert into public.member_links (member_id, user_id)
    values (next_member_id, current_user_id)
    on conflict (member_id) do update
      set user_id = excluded.user_id;

    created_new_member := true;
  end if;

  update public.users
  set team_id = invite_row.team_id,
      role = next_user_role,
      player_id = linked_player_id,
      updated_at = timezone('utc', now())
  where id = current_user_id;

  update public.team_invites
  set status = 'accepted',
      accepted_by_user_id = current_user_id,
      accepted_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = invite_row.id;

  return query
  select
    invite_row.id,
    invite_row.team_id,
    next_member_id,
    invite_row.invite_type,
    created_new_member;
end;
$$;

comment on function public.accept_team_invite(text) is 'Accepts a pending invite for the signed-in user, linking or creating the correct team membership using the aligned V2 business roles.';

grant execute on function public.accept_team_invite(text) to authenticated;

notify pgrst, 'reload schema';
