-- V2 Phase 5 self-serve team onboarding
--
-- Purpose:
-- 1. Add human-friendly 6-character Team IDs to teams.
-- 2. Let authenticated users create a team for themselves.
-- 3. Let authenticated users join an existing team with a simple code.
-- 4. Immediately create the matching team_members record and assign users.team_id.

alter table public.teams
  add column if not exists join_code text;

create or replace function public.normalize_team_join_code(raw_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(raw_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

comment on function public.normalize_team_join_code(text) is 'Normalizes a user-entered team join code into uppercase alphanumeric form.';

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
set join_code = public.normalize_team_join_code(join_code)
where join_code is not null;

update public.teams
set join_code = public.generate_team_join_code()
where join_code is null
   or join_code = '';

create unique index if not exists teams_join_code_unique_idx
  on public.teams (join_code);

alter table public.teams
  alter column join_code set default public.generate_team_join_code();

alter table public.teams
  alter column join_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teams_join_code_format_check'
  ) then
    alter table public.teams
      add constraint teams_join_code_format_check
      check (
        join_code = public.normalize_team_join_code(join_code)
        and char_length(join_code) = 6
      );
  end if;
end;
$$;

comment on column public.teams.join_code is 'Human-friendly 6-character Team ID that authenticated users can use to join the team.';

create or replace function public.resolve_onboarding_member_name(preferred_name text default null)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_row public.users%rowtype;
  normalized_preferred_name text;
  full_name text;
  username_name text;
  email_name text;
begin
  select *
  into current_user_row
  from public.users
  where id = auth.uid();

  if not found then
    raise exception 'Your app profile is not ready yet.';
  end if;

  normalized_preferred_name := nullif(regexp_replace(trim(coalesce(preferred_name, '')), '\s+', ' ', 'g'), '');

  if normalized_preferred_name is not null then
    return normalized_preferred_name;
  end if;

  full_name := nullif(
    regexp_replace(
      trim(concat_ws(' ', current_user_row.first_name, current_user_row.last_name)),
      '\s+',
      ' ',
      'g'
    ),
    ''
  );

  if full_name is not null then
    return full_name;
  end if;

  username_name := nullif(trim(coalesce(current_user_row.username, '')), '');

  if username_name is not null then
    return username_name;
  end if;

  email_name := split_part(coalesce(current_user_row.email, 'member'), '@', 1);

  return case
    when nullif(trim(email_name), '') is not null then trim(email_name)
    else 'New Member'
  end;
end;
$$;

comment on function public.resolve_onboarding_member_name(text) is 'Builds a safe team member display name from preferred input, saved profile fields, username, or email.';

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

comment on function public.create_team_workspace(text, text) is 'Creates a new team, seeds the creator as organiser/admin, and assigns users.team_id immediately.';

create or replace function public.join_team_with_code(
  raw_join_code text,
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
  target_team_row public.teams%rowtype;
  existing_member_row public.team_members%rowtype;
  normalized_join_code text;
  normalized_member_name text;
  active_season_id uuid;
  next_member_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to join a team.';
  end if;

  select *
  into current_user_row
  from public.users
  where id = current_user_id;

  if not found then
    raise exception 'Your app profile is not ready yet.';
  end if;

  normalized_join_code := public.normalize_team_join_code(raw_join_code);

  if normalized_join_code = '' then
    raise exception 'Enter a valid team code before joining.';
  end if;

  select *
  into target_team_row
  from public.teams
  where public.teams.join_code = normalized_join_code;

  if not found then
    raise exception 'That team code was not found.';
  end if;

  if current_user_row.team_id is not null and current_user_row.team_id <> target_team_row.id then
    raise exception 'This account already belongs to another team.';
  end if;

  select *
  into existing_member_row
  from public.team_members
  where team_id = target_team_row.id
    and user_id = current_user_id
  limit 1;

  if found then
    update public.users
    set team_id = target_team_row.id,
        updated_at = timezone('utc', now())
    where id = current_user_id;

    insert into public.member_links (member_id, user_id)
    values (existing_member_row.id, current_user_id)
    on conflict on constraint member_links_member_unique do update
      set user_id = excluded.user_id;

    team_id := target_team_row.id;
    member_id := existing_member_row.id;
    team_name := target_team_row.name;
    join_code := target_team_row.join_code;
    created_team := false;
    created_member := false;

    return next;
  end if;

  normalized_member_name := public.resolve_onboarding_member_name(preferred_member_name);

  select ms.id
  into active_season_id
  from public.membership_seasons ms
  where ms.team_id = target_team_row.id
  order by ms.is_active desc, ms.start_date desc, ms.created_at desc
  limit 1;

  perform set_config('app.bypass_user_admin_fields', 'on', true);

  update public.users
  set team_id = target_team_row.id,
      role = 'member',
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
    target_team_row.id,
    active_season_id,
    current_user_id,
    normalized_member_name,
    'player',
    'member',
    'active',
    timezone('utc', now()),
    timezone('utc', now())
  )
  returning id into next_member_id;

  insert into public.member_links (member_id, user_id)
  values (next_member_id, current_user_id)
  on conflict on constraint member_links_member_unique do update
    set user_id = excluded.user_id;

  team_id := target_team_row.id;
  member_id := next_member_id;
  team_name := target_team_row.name;
  join_code := target_team_row.join_code;
  created_team := false;
  created_member := true;

  return next;
end;
$$;

comment on function public.join_team_with_code(text, text) is 'Joins the authenticated user to a team by join code and creates the matching team_members record when needed.';

grant execute on function public.normalize_team_join_code(text) to authenticated;
grant execute on function public.create_team_workspace(text, text) to authenticated;
grant execute on function public.join_team_with_code(text, text) to authenticated;

notify pgrst, 'reload schema';
