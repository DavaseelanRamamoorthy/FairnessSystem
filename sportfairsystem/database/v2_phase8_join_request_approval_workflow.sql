-- V2 Phase 8 join request approval workflow hardening
--
-- Purpose:
-- 1. Make join-request approval require a final role and season.
-- 2. Allow organisers to link the requester to an existing unclaimed member.
-- 3. Keep Team code as the main requester flow while completing membership during approval.

drop function if exists public.approve_team_join_request(uuid);

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
  next_team_role text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to approve a team request.';
  end if;

  if next_role not in ('admin', 'captain', 'player') then
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

  next_team_role :=
    case next_role
      when 'admin' then 'organiser'
      when 'captain' then 'coordinator'
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
        role = next_role,
        team_role = next_team_role,
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
        role = next_role,
        team_role = next_team_role,
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
      next_role,
      next_team_role,
      'active',
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning id into next_member_id;
  end if;

  perform set_config('app.bypass_user_admin_fields', 'on', true);

  update public.users
  set team_id = request_row.team_id,
      role = case when next_role = 'admin' then 'admin' else 'member' end,
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

comment on function public.approve_team_join_request(uuid, text, uuid, uuid) is 'Approves a pending join request using required role and season inputs, optionally linking the requester to an existing unclaimed member.';

grant execute on function public.approve_team_join_request(uuid, text, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
