-- V2 Phase 2 roles and permissions foundation
--
-- Review before applying:
-- 1. This migration is additive-first and does not remove the current role model.
-- 2. It introduces business roles on team_members without replacing current admin checks yet.
-- 3. It introduces scoped permissions for sensitive workflows such as identity management.

alter table public.team_members
  add column if not exists team_role text
  check (
    team_role is null
    or team_role in ('organiser', 'coordinator', 'financer', 'inventory_manager', 'member')
  );

create index if not exists team_members_team_role_idx
  on public.team_members (team_id, team_role, status, created_at desc);

create table if not exists public.team_member_permissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  permission text not null
    check (
      permission in (
        'team_settings_manage',
        'members_manage',
        'invites_manage',
        'identity_manage',
        'attendance_manage',
        'planner_manage',
        'stats_manage',
        'finance_manage',
        'inventory_manage',
        'events_manage'
      )
    ),
  granted_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint team_member_permissions_member_permission_unique unique (member_id, permission)
);

create index if not exists team_member_permissions_team_member_idx
  on public.team_member_permissions (team_id, member_id, permission);

create index if not exists team_member_permissions_permission_idx
  on public.team_member_permissions (team_id, permission, created_at desc);

alter table public.team_member_permissions enable row level security;

drop policy if exists "team_member_permissions_select_team_scope" on public.team_member_permissions;
create policy "team_member_permissions_select_team_scope"
on public.team_member_permissions
for select
using (team_id = public.current_team_id());

drop policy if exists "team_member_permissions_insert_admin_team_scope" on public.team_member_permissions;
create policy "team_member_permissions_insert_admin_team_scope"
on public.team_member_permissions
for insert
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.team_member_permissions.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "team_member_permissions_update_admin_team_scope" on public.team_member_permissions;
create policy "team_member_permissions_update_admin_team_scope"
on public.team_member_permissions
for update
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
)
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.team_member_permissions.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "team_member_permissions_delete_admin_team_scope" on public.team_member_permissions;
create policy "team_member_permissions_delete_admin_team_scope"
on public.team_member_permissions
for delete
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

comment on column public.team_members.team_role is 'Business role in the team: organiser, coordinator, financer, inventory_manager, or member.';

comment on table public.team_member_permissions is 'Scoped elevated permissions assigned to a team membership.';
comment on column public.team_member_permissions.permission is 'Permission slug for protected team workflows.';
comment on column public.team_member_permissions.granted_by_user_id is 'User who granted the permission, when tracked.';

-- Suggested next step after schema review:
--
-- 1. Backfill team_role from current legacy team_members.role
--    admin -> organiser
--    captain -> coordinator
--    player -> member
--
-- 2. Seed default permissions:
--    organiser -> all
--    coordinator -> members_manage, invites_manage, attendance_manage, planner_manage, stats_manage, events_manage
--    financer -> finance_manage
--    inventory_manager -> inventory_manage
--
-- 3. Move sensitive UI and service actions to permission-based checks,
--    starting with external names / identity management.
