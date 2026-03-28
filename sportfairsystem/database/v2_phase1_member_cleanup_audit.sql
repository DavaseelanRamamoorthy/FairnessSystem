-- V2 Phase 1 member cleanup audit
--
-- Review-only script.
-- This script does not modify data.
--
-- Purpose:
-- 1. Find suspicious non-person memberships
-- 2. Find likely duplicate team members
-- 3. Find player/member naming mismatches
-- 4. Find alias candidates for manual consolidation

-- ------------------------------------------------------------
-- 1. Suspicious non-person team_members
-- ------------------------------------------------------------
select
  tm.id as member_id,
  tm.team_id,
  tm.name,
  tm.status,
  tm.role
from public.team_members tm
where lower(tm.name) like 'fall of wickets%'
   or lower(tm.name) like 'fow%'
   or lower(tm.name) like 'extras%'
   or lower(tm.name) like 'total%'
   or lower(tm.name) like 'did not bat%'
   or lower(tm.name) like 'yet to bat%'
   or lower(tm.name) like 'substitute%'
   or lower(tm.name) like 'runner%'
order by tm.team_id, tm.name;

-- ------------------------------------------------------------
-- 2. Exact duplicate normalized member names within the same team
-- ------------------------------------------------------------
with normalized_members as (
  select
    tm.id,
    tm.team_id,
    tm.name,
    lower(regexp_replace(trim(tm.name), '\s+', ' ', 'g')) as normalized_name
  from public.team_members tm
  where trim(coalesce(tm.name, '')) <> ''
)
select
  team_id,
  normalized_name,
  count(*) as member_count,
  string_agg(name, ' | ' order by name) as member_names,
  string_agg(id::text, ' | ' order by name) as member_ids
from normalized_members
group by team_id, normalized_name
having count(*) > 1
order by team_id, member_count desc, normalized_name;

-- ------------------------------------------------------------
-- 3. Likely duplicate members by compressed-name heuristic
--    Example: "imaad khan" vs "imaad m khan"
-- ------------------------------------------------------------
with member_tokens as (
  select
    tm.id,
    tm.team_id,
    tm.name,
    lower(regexp_replace(trim(tm.name), '\s+', ' ', 'g')) as normalized_name,
    regexp_replace(lower(regexp_replace(trim(tm.name), '\s+', ' ', 'g')), '\b[a-z]\b', '', 'g') as no_initial_name
  from public.team_members tm
  where trim(coalesce(tm.name, '')) <> ''
),
collapsed_members as (
  select
    id,
    team_id,
    name,
    normalized_name,
    regexp_replace(no_initial_name, '\s+', ' ', 'g') as collapsed_name
  from member_tokens
)
select
  team_id,
  collapsed_name,
  count(*) as member_count,
  string_agg(name, ' | ' order by name) as member_names,
  string_agg(id::text, ' | ' order by name) as member_ids
from collapsed_members
where trim(collapsed_name) <> ''
group by team_id, collapsed_name
having count(*) > 1
order by team_id, member_count desc, collapsed_name;

-- ------------------------------------------------------------
-- 4. Player/member mismatches where linked names differ
-- ------------------------------------------------------------
select
  tm.team_id,
  tm.id as member_id,
  tm.name as member_name,
  p.id as player_id,
  p.name as player_name
from public.team_members tm
join public.players p
  on p.member_id = tm.id
where lower(regexp_replace(trim(tm.name), '\s+', ' ', 'g'))
   <> lower(regexp_replace(trim(p.name), '\s+', ' ', 'g'))
order by tm.team_id, tm.name, p.name;

-- ------------------------------------------------------------
-- 5. Members still missing user links
-- ------------------------------------------------------------
select
  tm.id as member_id,
  tm.team_id,
  tm.name,
  tm.status,
  tm.role
from public.team_members tm
where tm.user_id is null
order by tm.team_id, tm.name;

-- ------------------------------------------------------------
-- 6. Players still missing member links
-- ------------------------------------------------------------
select
  p.id as player_id,
  p.team_id,
  p.name,
  p.is_guest
from public.players p
where p.member_id is null
order by p.team_id, p.name;

-- ------------------------------------------------------------
-- 7. Existing aliases for quick inspection
-- ------------------------------------------------------------
select
  aliases.team_id,
  aliases.member_id,
  tm.name as member_name,
  aliases.alias,
  aliases.alias_type,
  aliases.is_primary
from public.team_member_aliases aliases
join public.team_members tm
  on tm.id = aliases.member_id
order by aliases.team_id, tm.name, aliases.is_primary desc, aliases.alias_type, aliases.alias;
