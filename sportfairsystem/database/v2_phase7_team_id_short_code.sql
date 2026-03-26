-- V2 Phase 7 short Team ID alignment
--
-- Purpose:
-- 1. Standardize public team join codes to 6-character alphanumeric Team IDs.
-- 2. Refresh existing non-compliant codes in deployed environments.
-- 3. Add join-request RPC support for Team ID lookup by code instead of raw team UUID.

create or replace function public.generate_team_join_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  next_code text;
begin
  loop
    next_code := substring(replace(upper(gen_random_uuid()::text), '-', '') from 1 for 6);

    exit when not exists (
      select 1
      from public.teams
      where join_code = next_code
    );
  end loop;

  return next_code;
end;
$$;

comment on function public.generate_team_join_code() is 'Generates a unique 6-character uppercase alphanumeric Team ID for a team.';

update public.teams
set join_code = public.generate_team_join_code()
where join_code is null
   or join_code = ''
   or join_code <> public.normalize_team_join_code(join_code)
   or char_length(join_code) <> 6;

alter table public.teams
  alter column join_code set default public.generate_team_join_code();

alter table public.teams
  alter column join_code set not null;

alter table public.teams
  drop constraint if exists teams_join_code_format_check;

alter table public.teams
  add constraint teams_join_code_format_check
  check (
    join_code = public.normalize_team_join_code(join_code)
    and char_length(join_code) = 6
  );

comment on column public.teams.join_code is 'Human-friendly 6-character Team ID that authenticated users can use to join the team.';

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

grant execute on function public.submit_team_join_request_by_code(text, text) to authenticated;

notify pgrst, 'reload schema';
