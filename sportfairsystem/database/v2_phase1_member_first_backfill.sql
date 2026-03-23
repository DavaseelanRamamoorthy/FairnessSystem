-- V2 Phase 1 member-first backfill draft
--
-- Run only after:
--   database/v2_phase1_member_first_schema.sql
--
-- Purpose:
-- 1. Populate team_members.user_id from existing bridges
-- 2. Populate players.member_id from existing bridges
-- 3. Create alias rows for team member name resolution
--
-- Safety rules:
-- - Prefer existing member_links first
-- - Only use exact normalized-name fallbacks when the match is unique
-- - Do not force ambiguous joins
-- - Keep this idempotent so it can be re-run safely

-- 1. Backfill team_members.user_id from member_links where available.
update public.team_members members
set
  user_id = links.user_id,
  updated_at = timezone('utc', now())
from public.member_links links
where links.member_id = members.id
  and links.user_id is not null
  and members.user_id is null;

-- 2. Backfill players.member_id from member_links where available.
update public.players players
set member_id = links.member_id
from public.member_links links
where links.player_id = players.id
  and links.member_id is not null
  and players.member_id is null;

-- 3. Safe exact-name fallback for team_members.user_id when:
--    - membership has no user_id
--    - there is exactly one same-team user with the same normalized name
--    - that user is not already attached to another membership
with normalized_member_names as (
  select
    members.id as member_id,
    members.team_id,
    lower(regexp_replace(trim(members.name), '\s+', ' ', 'g')) as normalized_name
  from public.team_members members
  where members.user_id is null
    and trim(coalesce(members.name, '')) <> ''
),
normalized_user_names as (
  select
    users.id as user_id,
    users.team_id,
    lower(regexp_replace(trim(
      coalesce(
        nullif(concat_ws(' ', users.first_name, users.last_name), ''),
        nullif(trim(users.username), '')
      )
    ), '\s+', ' ', 'g')) as normalized_name
  from public.users users
  where users.team_id is not null
    and coalesce(
      nullif(concat_ws(' ', users.first_name, users.last_name), ''),
      nullif(trim(users.username), '')
    ) is not null
),
unique_user_matches as (
  select
    member_names.member_id,
    (array_agg(user_names.user_id order by user_names.user_id))[1] as user_id
  from normalized_member_names member_names
  join normalized_user_names user_names
    on user_names.team_id = member_names.team_id
   and user_names.normalized_name = member_names.normalized_name
  left join public.team_members existing_members
    on existing_members.user_id = user_names.user_id
  where existing_members.id is null
  group by member_names.member_id
  having count(*) = 1
)
update public.team_members members
set
  user_id = matches.user_id,
  updated_at = timezone('utc', now())
from unique_user_matches matches
where members.id = matches.member_id
  and members.user_id is null;

-- 4. Safe exact-name fallback for players.member_id when:
--    - player has no member_id
--    - exactly one same-team member has the same normalized name
--    - that member is not already attached to another player
with normalized_player_names as (
  select
    players.id as player_id,
    players.team_id,
    lower(regexp_replace(trim(players.name), '\s+', ' ', 'g')) as normalized_name
  from public.players players
  where players.member_id is null
    and trim(coalesce(players.name, '')) <> ''
),
normalized_member_names as (
  select
    members.id as member_id,
    members.team_id,
    lower(regexp_replace(trim(members.name), '\s+', ' ', 'g')) as normalized_name
  from public.team_members members
  where trim(coalesce(members.name, '')) <> ''
),
unique_member_matches as (
  select
    player_names.player_id,
    (array_agg(member_names.member_id order by member_names.member_id))[1] as member_id
  from normalized_player_names player_names
  join normalized_member_names member_names
    on member_names.team_id = player_names.team_id
   and member_names.normalized_name = player_names.normalized_name
  left join public.players existing_players
    on existing_players.member_id = member_names.member_id
  where existing_players.id is null
  group by player_names.player_id
  having count(*) = 1
)
update public.players players
set member_id = matches.member_id
from unique_member_matches matches
where players.id = matches.player_id
  and players.member_id is null;

-- 5. If a membership is now linked to a user who already has users.player_id,
--    and that player has no member_id yet, bridge that player to the member.
update public.players players
set member_id = members.id
from public.team_members members
join public.users users
  on users.id = members.user_id
where users.player_id = players.id
  and players.member_id is null
  and members.team_id = players.team_id;

-- 6. Create primary alias rows from team_members.name.
insert into public.team_member_aliases (
  team_id,
  member_id,
  alias,
  normalized_alias,
  alias_type,
  is_primary
)
select
  members.team_id,
  members.id,
  trim(members.name) as alias,
  lower(regexp_replace(trim(members.name), '\s+', ' ', 'g')) as normalized_alias,
  'primary',
  true
from public.team_members members
where trim(coalesce(members.name, '')) <> ''
  and not exists (
    select 1
    from public.team_member_aliases aliases
    where aliases.member_id = members.id
      and aliases.is_primary = true
  )
  and not exists (
    select 1
    from public.team_member_aliases aliases
    where aliases.team_id = members.team_id
      and aliases.normalized_alias = lower(regexp_replace(trim(members.name), '\s+', ' ', 'g'))
  );

-- 7. Create legacy alias rows from linked players.name when different from the primary alias.
insert into public.team_member_aliases (
  team_id,
  member_id,
  alias,
  normalized_alias,
  alias_type,
  is_primary
)
select
  players.team_id,
  players.member_id,
  trim(players.name) as alias,
  lower(regexp_replace(trim(players.name), '\s+', ' ', 'g')) as normalized_alias,
  'legacy',
  false
from public.players players
join public.team_members members
  on members.id = players.member_id
where players.member_id is not null
  and trim(coalesce(players.name, '')) <> ''
  and lower(regexp_replace(trim(players.name), '\s+', ' ', 'g'))
      <> lower(regexp_replace(trim(members.name), '\s+', ' ', 'g'))
  and not exists (
    select 1
    from public.team_member_aliases aliases
    where aliases.team_id = players.team_id
      and aliases.normalized_alias = lower(regexp_replace(trim(players.name), '\s+', ' ', 'g'))
  );

-- 8. Keep updated_at fresh for memberships that now have either a user link or season link.
update public.team_members members
set updated_at = timezone('utc', now())
where members.updated_at is null;

-- Suggested verification queries after running this script:
--
-- select count(*) as memberships_with_user
-- from public.team_members
-- where user_id is not null;
--
-- select count(*) as players_with_member
-- from public.players
-- where member_id is not null;
--
-- select alias_type, count(*)
-- from public.team_member_aliases
-- group by alias_type
-- order by alias_type;
--
-- select tm.id, tm.name, tm.team_id
-- from public.team_members tm
-- where tm.user_id is null
-- order by tm.team_id, tm.name;
--
-- select p.id, p.name, p.team_id
-- from public.players p
-- where p.member_id is null
-- order by p.team_id, p.name;
