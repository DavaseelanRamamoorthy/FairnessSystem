-- V2 Phase 14 native attendance tracking foundation
--
-- Purpose:
-- 1. Introduce native in-app attendance sessions for planner workflows.
-- 2. Track per-member availability without relying on workbook upload.
-- 3. Keep access aligned with organiser or scoped attendance permissions.

create or replace function public.can_manage_attendance_workspace()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with current_user_row as (
    select u.id, u.team_id, u.role
    from public.users u
    where u.id = auth.uid()
  ),
  current_member as (
    select tm.id, tm.team_role
    from current_user_row cu
    join public.team_members tm
      on tm.user_id = cu.id
     and tm.team_id = cu.team_id
  )
  select coalesce(
    exists (
      select 1
      from current_user_row cu
      where cu.team_id = public.current_team_id()
        and cu.role = 'admin'
    )
    or exists (
      select 1
      from current_member cm
      where cm.team_role = 'organiser'
    )
    or exists (
      select 1
      from current_member cm
      join public.team_member_permissions tmp
        on tmp.member_id = cm.id
       and tmp.team_id = public.current_team_id()
      where tmp.permission = 'attendance_manage'
    ),
    false
  );
$$;

comment on function public.can_manage_attendance_workspace() is 'Returns true when the authenticated user can create or update native attendance sessions for the current team.';

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  planner_mode text not null default 'friendly' check (planner_mode in ('friendly', 'tournament')),
  season text,
  weekend_date date not null,
  weekend_label text not null,
  match_count integer not null check (match_count between 1 and 3),
  attendance_source text not null default 'native' check (attendance_source in ('native')),
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint attendance_sessions_team_weekend_unique unique (team_id, planner_mode, weekend_date)
);

create index if not exists attendance_sessions_team_weekend_idx
  on public.attendance_sessions (team_id, planner_mode, weekend_date desc, created_at desc);

create table if not exists public.attendance_session_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  availability text not null default 'not_available' check (availability in ('available', 'not_available', 'maybe')),
  notes text,
  updated_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint attendance_session_entries_session_member_unique unique (session_id, member_id)
);

create index if not exists attendance_session_entries_session_idx
  on public.attendance_session_entries (session_id, availability, updated_at desc);

create index if not exists attendance_session_entries_team_member_idx
  on public.attendance_session_entries (team_id, member_id, updated_at desc);

alter table public.planner_matchday_batches
  add column if not exists attendance_session_id uuid references public.attendance_sessions(id) on delete set null;

create index if not exists planner_matchday_batches_attendance_session_idx
  on public.planner_matchday_batches (attendance_session_id)
  where attendance_session_id is not null;

alter table public.attendance_sessions enable row level security;
alter table public.attendance_session_entries enable row level security;

drop policy if exists "attendance_sessions_select_team_scope" on public.attendance_sessions;
create policy "attendance_sessions_select_team_scope"
on public.attendance_sessions
for select
using (team_id = public.current_team_id());

drop policy if exists "attendance_sessions_insert_manage_team_scope" on public.attendance_sessions;
create policy "attendance_sessions_insert_manage_team_scope"
on public.attendance_sessions
for insert
with check (
  public.can_manage_attendance_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "attendance_sessions_update_manage_team_scope" on public.attendance_sessions;
create policy "attendance_sessions_update_manage_team_scope"
on public.attendance_sessions
for update
using (
  public.can_manage_attendance_workspace()
  and team_id = public.current_team_id()
)
with check (
  public.can_manage_attendance_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "attendance_sessions_delete_manage_team_scope" on public.attendance_sessions;
create policy "attendance_sessions_delete_manage_team_scope"
on public.attendance_sessions
for delete
using (
  public.can_manage_attendance_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "attendance_session_entries_select_team_scope" on public.attendance_session_entries;
create policy "attendance_session_entries_select_team_scope"
on public.attendance_session_entries
for select
using (team_id = public.current_team_id());

drop policy if exists "attendance_session_entries_insert_manage_team_scope" on public.attendance_session_entries;
create policy "attendance_session_entries_insert_manage_team_scope"
on public.attendance_session_entries
for insert
with check (
  public.can_manage_attendance_workspace()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.attendance_sessions
    where public.attendance_sessions.id = public.attendance_session_entries.session_id
      and public.attendance_sessions.team_id = public.current_team_id()
  )
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.attendance_session_entries.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "attendance_session_entries_update_manage_team_scope" on public.attendance_session_entries;
create policy "attendance_session_entries_update_manage_team_scope"
on public.attendance_session_entries
for update
using (
  public.can_manage_attendance_workspace()
  and team_id = public.current_team_id()
)
with check (
  public.can_manage_attendance_workspace()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.attendance_sessions
    where public.attendance_sessions.id = public.attendance_session_entries.session_id
      and public.attendance_sessions.team_id = public.current_team_id()
  )
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.attendance_session_entries.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "attendance_session_entries_delete_manage_team_scope" on public.attendance_session_entries;
create policy "attendance_session_entries_delete_manage_team_scope"
on public.attendance_session_entries
for delete
using (
  public.can_manage_attendance_workspace()
  and team_id = public.current_team_id()
);

comment on table public.attendance_sessions is 'Native planner attendance sessions captured in-app for a team matchday.';
comment on table public.attendance_session_entries is 'Per-member attendance availability recorded against a native attendance session.';
comment on column public.attendance_session_entries.availability is 'Availability state recorded by the organiser: available, not_available, or maybe.';
