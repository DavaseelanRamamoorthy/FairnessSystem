-- V2 Phase 6 team join requests
--
-- Purpose:
-- 1. Let teamless users request access by entering a 6-character Team ID.
-- 2. Keep users profile-only until an organiser/admin approves the request.
-- 3. Convert approved requests into real users.team_id + team_members links.

create table if not exists public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  requester_user_id uuid not null references public.users(id) on delete cascade,
  requester_email text not null,
  requester_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  resolution_note text,
  created_member_id uuid references public.team_members(id) on delete set null,
  resolved_by_user_id uuid references public.users(id) on delete set null,
  requested_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists team_join_requests_team_status_idx
  on public.team_join_requests (team_id, status, requested_at desc);

create index if not exists team_join_requests_requester_status_idx
  on public.team_join_requests (requester_user_id, status, requested_at desc);

create unique index if not exists team_join_requests_pending_requester_unique_idx
  on public.team_join_requests (requester_user_id)
  where status = 'pending';

alter table public.team_join_requests enable row level security;

drop policy if exists "team_join_requests_select_requester" on public.team_join_requests;
create policy "team_join_requests_select_requester"
on public.team_join_requests
for select
using (requester_user_id = auth.uid());

drop policy if exists "team_join_requests_select_manager_scope" on public.team_join_requests;
create policy "team_join_requests_select_manager_scope"
on public.team_join_requests
for select
using (
  team_id = public.current_team_id()
  and public.can_manage_team_invites_for_current_team()
);

create or replace function public.submit_team_join_request_by_code(
  raw_team_join_code text,
  preferred_member_name text default null
)
returns table (
  request_id uuid,
  team_id uuid,
  team_name text,
  requester_name text,
  status text,
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_row public.users%rowtype;
  target_team_row public.teams%rowtype;
  pending_request_row public.team_join_requests%rowtype;
  normalized_team_join_code text;
  normalized_member_name text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to request access to a team.';
  end if;

  select *
  into current_user_row
  from public.users
  where id = current_user_id;

  if not found then
    raise exception 'Your app profile is not ready yet.';
  end if;

  if current_user_row.team_id is not null then
    raise exception 'This account already belongs to a team.';
  end if;

  normalized_team_join_code := public.normalize_team_join_code(raw_team_join_code);

  if normalized_team_join_code = '' then
    raise exception 'Enter the 6-character Team ID before requesting access.';
  end if;

  select *
  into target_team_row
  from public.teams
  where join_code = normalized_team_join_code;

  if not found then
    raise exception 'That Team ID was not found.';
  end if;

  select *
  into pending_request_row
  from public.team_join_requests
  where requester_user_id = current_user_id
    and status = 'pending'
  order by requested_at desc
  limit 1;

  if found then
    if pending_request_row.team_id <> target_team_row.id then
      raise exception 'You already have another pending team request.';
    end if;

    request_id := pending_request_row.id;
    team_id := pending_request_row.team_id;
    team_name := target_team_row.name;
    requester_name := pending_request_row.requester_name;
    status := pending_request_row.status;
    requested_at := pending_request_row.requested_at;

    return next;
  end if;

  normalized_member_name := public.resolve_onboarding_member_name(preferred_member_name);

  insert into public.team_join_requests (
    team_id,
    requester_user_id,
    requester_email,
    requester_name,
    status,
    updated_at
  )
  values (
    target_team_row.id,
    current_user_id,
    coalesce(current_user_row.email, ''),
    normalized_member_name,
    'pending',
    timezone('utc', now())
  )
  returning
    id,
    team_id,
    requester_name,
    status,
    requested_at
  into request_id, team_id, requester_name, status, requested_at;

  team_name := target_team_row.name;

  return next;
end;
$$;

comment on function public.submit_team_join_request_by_code(text, text) is 'Creates or reuses a pending team join request for the authenticated teamless user using a 6-character Team ID.';

create or replace function public.approve_team_join_request(
  target_request_id uuid
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
  active_season_id uuid;
  next_member_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to approve a team request.';
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

  select *
  into existing_member_row
  from public.team_members
  where team_id = request_row.team_id
    and user_id = request_row.requester_user_id
  limit 1;

  if found then
    next_member_id := existing_member_row.id;
  else
  select ms.id
  into active_season_id
    from public.membership_seasons ms
  where ms.team_id = request_row.team_id
  order by ms.is_active desc, ms.start_date desc, ms.created_at desc
  limit 1;

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
      active_season_id,
      request_row.requester_user_id,
      request_row.requester_name,
      'player',
      'member',
      'active',
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning id into next_member_id;
  end if;

  perform set_config('app.bypass_user_admin_fields', 'on', true);

  update public.users
  set team_id = request_row.team_id,
      role = 'member',
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

comment on function public.approve_team_join_request(uuid) is 'Approves a pending join request and creates the real membership + team assignment.';

create or replace function public.reject_team_join_request(
  target_request_id uuid,
  next_resolution_note text default null
)
returns table (
  request_id uuid,
  team_id uuid,
  requester_user_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  request_row public.team_join_requests%rowtype;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to reject a team request.';
  end if;

  select *
  into request_row
  from public.team_join_requests
  where id = target_request_id;

  if not found then
    raise exception 'The selected join request no longer exists.';
  end if;

  if request_row.status <> 'pending' then
    raise exception 'Only pending join requests can be rejected.';
  end if;

  if request_row.team_id <> public.current_team_id() or not public.can_manage_team_invites_for_current_team() then
    raise exception 'You do not have permission to reject this team request.';
  end if;

  update public.team_join_requests
  set status = 'rejected',
      resolution_note = nullif(trim(coalesce(next_resolution_note, '')), ''),
      resolved_by_user_id = current_user_id,
      resolved_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = request_row.id;

  request_id := request_row.id;
  team_id := request_row.team_id;
  requester_user_id := request_row.requester_user_id;
  status := 'rejected';

  return next;
end;
$$;

comment on function public.reject_team_join_request(uuid, text) is 'Rejects a pending join request without assigning the user to the team.';

create or replace function public.cancel_my_team_join_request(
  target_request_id uuid
)
returns table (
  request_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  request_row public.team_join_requests%rowtype;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to cancel a join request.';
  end if;

  select *
  into request_row
  from public.team_join_requests
  where id = target_request_id
    and requester_user_id = current_user_id;

  if not found then
    raise exception 'The selected join request no longer exists.';
  end if;

  if request_row.status <> 'pending' then
    raise exception 'Only pending join requests can be cancelled.';
  end if;

  update public.team_join_requests
  set status = 'cancelled',
      resolved_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = request_row.id;

  request_id := request_row.id;
  status := 'cancelled';

  return next;
end;
$$;

comment on function public.cancel_my_team_join_request(uuid) is 'Lets the requesting user cancel their own pending team join request.';

create or replace function public.create_team_workspace(
  next_team_name text,
  preferred_member_name text default null
)
returns table (
  team_id uuid,
  member_id uuid,
  team_name text,
  join_code text,
  created_team boolean,
  created_member boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_row public.users%rowtype;
  normalized_team_name text;
  normalized_member_name text;
  next_team_id uuid;
  next_member_id uuid;
  next_join_code text;
  next_team_name_value text;
  next_join_code_value text;
  current_year integer := extract(year from timezone('utc', now()));
  created_season_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create a team.';
  end if;

  select *
  into current_user_row
  from public.users
  where id = current_user_id;

  if not found then
    raise exception 'Your app profile is not ready yet.';
  end if;

  if current_user_row.team_id is not null then
    raise exception 'This account already belongs to a team.';
  end if;

  if exists (
    select 1
    from public.team_join_requests
    where requester_user_id = current_user_id
      and status = 'pending'
  ) then
    raise exception 'Cancel or resolve your pending join request before creating a new team.';
  end if;

  normalized_team_name := nullif(
    regexp_replace(trim(coalesce(next_team_name, '')), '\s+', ' ', 'g'),
    ''
  );

  if normalized_team_name is null then
    raise exception 'Enter a team name before creating the team.';
  end if;

  normalized_member_name := public.resolve_onboarding_member_name(preferred_member_name);
  next_join_code := public.generate_team_join_code();

  insert into public.teams as created_team_row (name, join_code)
  values (normalized_team_name, next_join_code)
  returning created_team_row.id, created_team_row.name, created_team_row.join_code
  into next_team_id, next_team_name_value, next_join_code_value;

  insert into public.membership_seasons (
    team_id,
    name,
    start_date,
    end_date,
    is_active
  )
  values (
    next_team_id,
    current_year::text,
    make_date(current_year, 1, 1),
    make_date(current_year, 12, 31),
    true
  )
  returning id into created_season_id;

  perform set_config('app.bypass_user_admin_fields', 'on', true);

  update public.users
  set team_id = next_team_id,
      role = 'admin',
      updated_at = timezone('utc', now())
  where id = current_user_id;

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
    next_team_id,
    created_season_id,
    current_user_id,
    normalized_member_name,
    'admin',
    'organiser',
    'active',
    timezone('utc', now()),
    timezone('utc', now())
  )
  returning id into next_member_id;

  insert into public.member_links (member_id, user_id)
  values (next_member_id, current_user_id)
  on conflict on constraint member_links_member_unique do update
    set user_id = excluded.user_id;

  team_id := next_team_id;
  member_id := next_member_id;
  team_name := next_team_name_value;
  join_code := next_join_code_value;
  created_team := true;
  created_member := true;

  return next;
end;
$$;

grant execute on function public.submit_team_join_request_by_code(text, text) to authenticated;
grant execute on function public.approve_team_join_request(uuid) to authenticated;
grant execute on function public.reject_team_join_request(uuid, text) to authenticated;
grant execute on function public.cancel_my_team_join_request(uuid) to authenticated;
grant execute on function public.create_team_workspace(text, text) to authenticated;

comment on table public.team_join_requests is 'Pending, approved, rejected, or cancelled requests from teamless users who want to join a specific team by 6-character Team ID.';
comment on column public.team_join_requests.requester_name is 'Display name proposed for the eventual team_members record.';
comment on column public.team_join_requests.created_member_id is 'Team member created or linked when the request is approved.';

notify pgrst, 'reload schema';
