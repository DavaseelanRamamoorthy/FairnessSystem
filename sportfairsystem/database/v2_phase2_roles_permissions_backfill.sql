-- V2 Phase 2 roles and permissions backfill
--
-- Run only after:
--   database/v2_phase2_roles_permissions_schema.sql
--
-- Purpose:
-- 1. Backfill business team_role values from the current legacy team_members.role
-- 2. Seed default scoped permissions by team_role
--
-- Safety rules:
-- - This is idempotent
-- - It does not remove existing permissions
-- - It only fills missing team_role values
-- - It only inserts missing default permissions

-- 1. Backfill business roles from the current legacy role model.
update public.team_members
set team_role = case
  when role = 'admin' then 'organiser'
  when role = 'captain' then 'coordinator'
  else 'member'
end
where team_role is null;

-- 2. Seed organiser defaults: all elevated permissions.
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

-- 3. Seed coordinator defaults.
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
    ('planner_manage'),
    ('stats_manage'),
    ('events_manage')
) as permission_map(permission)
where members.team_role = 'coordinator'
on conflict (member_id, permission) do nothing;

-- 4. Seed financer defaults.
insert into public.team_member_permissions (team_id, member_id, permission)
select
  members.team_id,
  members.id,
  'finance_manage'
from public.team_members members
where members.team_role = 'financer'
on conflict (member_id, permission) do nothing;

-- 5. Seed inventory manager defaults.
insert into public.team_member_permissions (team_id, member_id, permission)
select
  members.team_id,
  members.id,
  'inventory_manage'
from public.team_members members
where members.team_role = 'inventory_manager'
on conflict (member_id, permission) do nothing;

-- Suggested verification queries after running this script:
--
-- select team_role, count(*)
-- from public.team_members
-- group by team_role
-- order by team_role;
--
-- select permission, count(*)
-- from public.team_member_permissions
-- group by permission
-- order by permission;
--
-- select tm.name, tm.team_role, string_agg(tmp.permission, ', ' order by tmp.permission) as permissions
-- from public.team_members tm
-- left join public.team_member_permissions tmp
--   on tmp.member_id = tm.id
-- where tm.team_id = public.current_team_id()
-- group by tm.name, tm.team_role
-- order by tm.team_role, tm.name;
