-- V2 Phase 2 attendance external names seed
--
-- Purpose:
-- Seed exact attendance-sheet names as external names for the current team
-- where the attendance name differs from the canonical member name.
--
-- Notes:
-- - This script only inserts safe, organiser-reviewed mappings.
-- - Under the current schema, these are stored with alias_type = 'legacy'
--   as a generic external-name bucket until source-specific alias types
--   like 'attendance' are introduced.
-- - Members whose attendance name already matches their member name
--   do not need an extra external-name row.

with desired_attendance_names as (
  select * from (
    values
      ('anir', 'Anir C'),
      ('davaseelan', 'Davaseelan Ramamoorthy'),
      ('jeevan s', 'Jeevan Srinivasalureddy'),
      ('ravinder', 'Ravinder Kumar'),
      ('sharath', 'Sharathkumar J')
  ) as mapping(member_name, external_name)
),
target_members as (
  select
    tm.id as member_id,
    tm.team_id,
    tm.name as member_name,
    mapping.external_name
  from public.team_members tm
  join desired_attendance_names mapping
    on lower(trim(tm.name)) = lower(trim(mapping.member_name))
  where tm.team_id = '75a06827-3365-4d1f-b34b-4919561dfb4d'
)
insert into public.team_member_aliases (
  team_id,
  member_id,
  alias,
  normalized_alias,
  alias_type,
  is_primary
)
select
  target.team_id,
  target.member_id,
  trim(target.external_name) as alias,
  lower(regexp_replace(trim(target.external_name), '\s+', ' ', 'g')) as normalized_alias,
  'legacy',
  false
from target_members target
where not exists (
  select 1
  from public.team_member_aliases aliases
  where aliases.member_id = target.member_id
    and aliases.is_primary = false
)
  and lower(regexp_replace(trim(target.external_name), '\s+', ' ', 'g'))
      <> lower(regexp_replace(trim(target.member_name), '\s+', ' ', 'g'))
on conflict (team_id, normalized_alias) do nothing;

-- Suggested verification query:
--
-- select
--   tm.name as member_name,
--   a.alias as external_name,
--   a.alias_type
-- from public.team_member_aliases a
-- join public.team_members tm
--   on tm.id = a.member_id
-- where a.team_id = '75a06827-3365-4d1f-b34b-4919561dfb4d'
--   and a.is_primary = false
-- order by tm.name, a.alias;
--
-- Current attendance-sheet names that still need manual organiser review
-- because there is no clear matching member row yet:
-- - Jeevan Srinivasalureddy
-- - Imaad Khan
-- After the current seed, only this attendance-sheet name still needs review:
-- - Imaad Khan
