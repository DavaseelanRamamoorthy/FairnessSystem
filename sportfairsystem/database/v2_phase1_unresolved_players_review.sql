-- V2 Phase 1 unresolved players review
--
-- Review-only script.
-- This script does not modify data.
--
-- Purpose:
-- 1. List unresolved legacy players that still have no member_id
-- 2. Separate obvious junk rows from real guest-or-alias candidates
-- 3. Help decide the next cleanup action safely

-- 1. All unresolved legacy players
select
  p.id as player_id,
  p.team_id,
  p.name as player_name,
  p.is_guest,
  case
    when lower(p.name) like 'fall of wickets%' then 'delete_bad_legacy_player'
    when lower(p.name) like 'fow%' then 'delete_bad_legacy_player'
    when lower(p.name) like 'extras%' then 'delete_bad_legacy_player'
    when lower(p.name) like 'total%' then 'delete_bad_legacy_player'
    when lower(p.name) like 'did not bat%' then 'delete_bad_legacy_player'
    when lower(p.name) like 'yet to bat%' then 'delete_bad_legacy_player'
    when lower(p.name) like 'substitute%' then 'review_guest_or_alias'
    when lower(p.name) like 'runner%' then 'review_guest_or_alias'
    when coalesce(p.is_guest, false) = true then 'review_guest_or_alias'
    else 'unexpected_non_guest_unresolved'
  end as suggested_action
from public.players p
where p.member_id is null
order by p.team_id, p.name;

-- 2. Match usage for unresolved players
select
  p.id as player_id,
  p.name as player_name,
  count(distinct mp.match_id) as match_count,
  min(m.match_date) as first_match_date,
  max(m.match_date) as last_match_date
from public.players p
left join public.match_players mp
  on mp.player_id = p.id
left join public.matches m
  on m.id = mp.match_id
where p.member_id is null
group by p.id, p.name
order by p.name;

-- 3. Candidate exact alias matches against existing team members
select
  p.id as player_id,
  p.name as player_name,
  tm.id as member_id,
  tm.name as member_name
from public.players p
join public.team_members tm
  on tm.team_id = p.team_id
 and lower(regexp_replace(trim(tm.name), '\s+', ' ', 'g'))
     = lower(regexp_replace(trim(p.name), '\s+', ' ', 'g'))
where p.member_id is null
order by p.name, tm.name;

-- 4. Existing aliases that already resemble unresolved player names
select
  p.id as player_id,
  p.name as player_name,
  a.member_id,
  tm.name as member_name,
  a.alias,
  a.alias_type
from public.players p
join public.team_member_aliases a
  on a.team_id = p.team_id
 and a.normalized_alias = lower(regexp_replace(trim(p.name), '\s+', ' ', 'g'))
join public.team_members tm
  on tm.id = a.member_id
where p.member_id is null
order by p.name, tm.name, a.alias_type;
