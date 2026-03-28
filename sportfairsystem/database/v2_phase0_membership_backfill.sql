-- V2 Phase 0 membership backfill
--
-- Purpose:
-- 1. Create season rows for existing teams
-- 2. Create initial team_members from current players and users
-- 3. Link backfilled members to users and players through member_links
--
-- This script is designed to be idempotent and conservative:
-- - It reuses exact-name matches where possible
-- - It prefers existing player-linked members before creating new ones
-- - It skips ambiguous exact-name matches instead of guessing

with match_season_source as (
  select
    m.team_id,
    extract(year from m.match_date)::int as season_year,
    max(extract(year from m.match_date)::int) over (partition by m.team_id) as latest_season_year
  from public.matches m
  where m.team_id is not null
    and m.match_date is not null
  group by m.team_id, extract(year from m.match_date)
)
insert into public.membership_seasons (
  team_id,
  name,
  start_date,
  end_date,
  is_active
)
select
  source.team_id,
  source.season_year::text,
  make_date(source.season_year, 1, 1),
  make_date(source.season_year, 12, 31),
  false
from match_season_source source
where not exists (
  select 1
  from public.membership_seasons seasons
  where seasons.team_id = source.team_id
    and seasons.name = source.season_year::text
);

with team_backfill_scope as (
  select t.id as team_id
  from public.teams t
  where exists (
    select 1
    from public.players p
    where p.team_id = t.id
  )
  or exists (
    select 1
    from public.users u
    where u.team_id = t.id
  )
)
insert into public.membership_seasons (
  team_id,
  name,
  start_date,
  end_date,
  is_active
)
select
  scope.team_id,
  extract(year from current_date)::text,
  make_date(extract(year from current_date)::int, 1, 1),
  make_date(extract(year from current_date)::int, 12, 31),
  true
from team_backfill_scope scope
where not exists (
  select 1
  from public.membership_seasons seasons
  where seasons.team_id = scope.team_id
);

with active_season_teams as (
  select distinct seasons.team_id
  from public.membership_seasons seasons
  where seasons.is_active = true
),
ranked_seasons as (
  select
    seasons.id,
    seasons.team_id,
    row_number() over (
      partition by seasons.team_id
      order by seasons.end_date desc, seasons.start_date desc, seasons.created_at desc
    ) as season_rank
  from public.membership_seasons seasons
)
update public.membership_seasons seasons
set is_active = true
from ranked_seasons ranked
where seasons.id = ranked.id
  and ranked.season_rank = 1
  and not exists (
    select 1
    from active_season_teams active
    where active.team_id = ranked.team_id
  );

with preferred_seasons as (
  select distinct on (seasons.team_id)
    seasons.team_id,
    seasons.id as season_id
  from public.membership_seasons seasons
  order by seasons.team_id, seasons.is_active desc, seasons.end_date desc, seasons.start_date desc
),
player_member_source as (
  select
    p.id as player_id,
    p.team_id,
    trim(p.name) as member_name,
    preferred.season_id
  from public.players p
  left join preferred_seasons preferred
    on preferred.team_id = p.team_id
  where p.team_id is not null
    and coalesce(p.is_guest, false) = false
    and trim(coalesce(p.name, '')) <> ''
    and not exists (
      select 1
      from public.member_links links
      where links.player_id = p.id
    )
    and not exists (
      select 1
      from public.team_members members
      where members.team_id = p.team_id
        and lower(trim(members.name)) = lower(trim(p.name))
    )
)
insert into public.team_members (
  team_id,
  season_id,
  name,
  role,
  status
)
select
  source.team_id,
  source.season_id,
  source.member_name,
  'player',
  'active'
from player_member_source source;

with player_link_targets as (
  select
    p.id as player_id,
    (array_agg(members.id order by members.id))[1] as member_id
  from public.players p
  join public.team_members members
    on members.team_id = p.team_id
   and lower(trim(members.name)) = lower(trim(p.name))
  left join public.member_links existing_member_link
    on existing_member_link.member_id = members.id
  where p.team_id is not null
    and coalesce(p.is_guest, false) = false
    and trim(coalesce(p.name, '')) <> ''
    and not exists (
      select 1
      from public.member_links links
      where links.player_id = p.id
    )
    and existing_member_link.member_id is null
  group by p.id
  having count(*) = 1
)
insert into public.member_links (
  member_id,
  player_id
)
select
  target.member_id,
  target.player_id
from player_link_targets target
where target.member_id is not null
on conflict (member_id) do nothing;

with preferred_seasons as (
  select distinct on (seasons.team_id)
    seasons.team_id,
    seasons.id as season_id
  from public.membership_seasons seasons
  order by seasons.team_id, seasons.is_active desc, seasons.end_date desc, seasons.start_date desc
),
user_member_source as (
  select
    u.id as user_id,
    u.team_id,
    coalesce(
      nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
      nullif(trim(u.username), '')
    ) as member_name,
    case
      when u.role = 'admin' then 'admin'
      else 'player'
    end as member_role,
    preferred.season_id
  from public.users u
  left join preferred_seasons preferred
    on preferred.team_id = u.team_id
  where u.team_id is not null
    and not exists (
      select 1
      from public.member_links links
      where links.user_id = u.id
    )
    and not exists (
      select 1
      from public.member_links links
      where links.player_id = u.player_id
    )
),
filtered_user_member_source as (
  select *
  from user_member_source source
  where source.member_name is not null
    and not exists (
      select 1
      from public.team_members members
      where members.team_id = source.team_id
        and lower(trim(members.name)) = lower(trim(source.member_name))
    )
)
insert into public.team_members (
  team_id,
  season_id,
  name,
  role,
  status
)
select
  source.team_id,
  source.season_id,
  source.member_name,
  source.member_role,
  'active'
from filtered_user_member_source source;

update public.member_links links
set user_id = users.id
from public.users users
where users.team_id is not null
  and users.player_id is not null
  and links.player_id = users.player_id
  and links.user_id is null
  and not exists (
    select 1
    from public.member_links existing
    where existing.user_id = users.id
  );

with user_link_source as (
  select
    u.id as user_id,
    u.team_id,
    coalesce(
      nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
      nullif(trim(u.username), '')
    ) as member_name,
    u.player_id
  from public.users u
  where u.team_id is not null
    and not exists (
      select 1
      from public.member_links links
      where links.user_id = u.id
    )
),
user_link_targets as (
  select
    source.user_id,
    source.player_id,
    (array_agg(members.id order by members.id))[1] as member_id
  from user_link_source source
  join public.team_members members
    on members.team_id = source.team_id
   and lower(trim(members.name)) = lower(trim(source.member_name))
  left join public.member_links existing_member_link
    on existing_member_link.member_id = members.id
  where source.member_name is not null
    and existing_member_link.user_id is null
  group by source.user_id, source.player_id
  having count(*) = 1
)
insert into public.member_links (
  member_id,
  user_id,
  player_id
)
select
  target.member_id,
  target.user_id,
  target.player_id
from user_link_targets target
where target.member_id is not null
  and not exists (
    select 1
    from public.member_links existing
    where existing.user_id = target.user_id
  )
on conflict (member_id) do update
set user_id = excluded.user_id
where public.member_links.user_id is null;

with linked_admin_members as (
  select distinct members.id as member_id
  from public.team_members members
  join public.member_links links
    on links.member_id = members.id
  join public.users users
    on users.id = links.user_id
  where users.role = 'admin'
)
update public.team_members members
set role = 'admin'
from linked_admin_members admins
where members.id = admins.member_id
  and members.role <> 'admin';

with preferred_seasons as (
  select distinct on (seasons.team_id)
    seasons.team_id,
    seasons.id as season_id
  from public.membership_seasons seasons
  order by seasons.team_id, seasons.is_active desc, seasons.end_date desc, seasons.start_date desc
)
update public.team_members members
set season_id = preferred.season_id
from preferred_seasons preferred
where members.team_id = preferred.team_id
  and members.season_id is null;

-- Suggested verification queries after running this script:
-- select team_id, count(*) as seasons from public.membership_seasons group by team_id order by team_id;
-- select team_id, role, status, count(*) as members from public.team_members group by team_id, role, status order by team_id, role, status;
-- select count(*) as linked_users from public.member_links where user_id is not null;
-- select count(*) as linked_players from public.member_links where player_id is not null;
