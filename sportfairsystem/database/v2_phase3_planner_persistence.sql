-- V2 Phase 3 planner persistence foundation
--
-- Purpose:
-- 1. Save generated planner batches for future fairness tracking.
-- 2. Save per-player, per-match planner outcomes for friendly-day history.
-- 3. Keep access team-scoped through the existing current_team_id/is_admin_user helpers.

create table if not exists public.planner_matchday_batches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  planner_mode text not null check (planner_mode in ('friendly', 'tournament')),
  season text,
  weekend_date date,
  weekend_label text not null,
  weekend_source_column text,
  attendance_workbook_name text,
  match_count integer not null check (match_count between 1 and 3),
  preferred_wicket_keeper_player_id uuid references public.players(id) on delete set null,
  generated_by_user_id uuid references public.users(id) on delete set null,
  availability_names text[] not null default '{}'::text[],
  unmatched_availability_names text[] not null default '{}'::text[],
  notes text[] not null default '{}'::text[],
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists planner_matchday_batches_team_date_idx
  on public.planner_matchday_batches (team_id, weekend_date desc, created_at desc);

create index if not exists planner_matchday_batches_team_mode_idx
  on public.planner_matchday_batches (team_id, planner_mode, created_at desc);

create table if not exists public.planner_matchday_assignments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.planner_matchday_batches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  match_number integer not null check (match_number between 1 and 3),
  player_id uuid references public.players(id) on delete cascade,
  member_id uuid references public.team_members(id) on delete set null,
  player_name text not null,
  assignment text not null check (assignment in ('xi', 'twelfth', 'bench', 'unavailable')),
  is_available boolean not null default true,
  is_captain boolean not null default false,
  is_wicket_keeper boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint planner_matchday_assignments_player_or_member_required
    check (player_id is not null or member_id is not null)
);

create unique index if not exists planner_matchday_assignments_batch_match_member_unique
  on public.planner_matchday_assignments (batch_id, match_number, member_id)
  where member_id is not null;

create unique index if not exists planner_matchday_assignments_batch_match_player_unique
  on public.planner_matchday_assignments (batch_id, match_number, player_id)
  where member_id is null and player_id is not null;

create index if not exists planner_matchday_assignments_team_player_idx
  on public.planner_matchday_assignments (team_id, player_id, created_at desc);

create index if not exists planner_matchday_assignments_team_member_idx
  on public.planner_matchday_assignments (team_id, member_id, created_at desc);

create index if not exists planner_matchday_assignments_batch_match_idx
  on public.planner_matchday_assignments (batch_id, match_number, assignment);

alter table public.planner_matchday_batches enable row level security;
alter table public.planner_matchday_assignments enable row level security;

drop policy if exists "planner_matchday_batches_select_team_scope" on public.planner_matchday_batches;
create policy "planner_matchday_batches_select_team_scope"
on public.planner_matchday_batches
for select
using (team_id = public.current_team_id());

drop policy if exists "planner_matchday_batches_insert_admin_team_scope" on public.planner_matchday_batches;
create policy "planner_matchday_batches_insert_admin_team_scope"
on public.planner_matchday_batches
for insert
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "planner_matchday_batches_update_admin_team_scope" on public.planner_matchday_batches;
create policy "planner_matchday_batches_update_admin_team_scope"
on public.planner_matchday_batches
for update
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
)
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "planner_matchday_batches_delete_admin_team_scope" on public.planner_matchday_batches;
create policy "planner_matchday_batches_delete_admin_team_scope"
on public.planner_matchday_batches
for delete
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "planner_matchday_assignments_select_team_scope" on public.planner_matchday_assignments;
create policy "planner_matchday_assignments_select_team_scope"
on public.planner_matchday_assignments
for select
using (team_id = public.current_team_id());

drop policy if exists "planner_matchday_assignments_insert_admin_team_scope" on public.planner_matchday_assignments;
create policy "planner_matchday_assignments_insert_admin_team_scope"
on public.planner_matchday_assignments
for insert
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.planner_matchday_batches
    where public.planner_matchday_batches.id = public.planner_matchday_assignments.batch_id
      and public.planner_matchday_batches.team_id = public.current_team_id()
  )
);

drop policy if exists "planner_matchday_assignments_update_admin_team_scope" on public.planner_matchday_assignments;
create policy "planner_matchday_assignments_update_admin_team_scope"
on public.planner_matchday_assignments
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
    from public.planner_matchday_batches
    where public.planner_matchday_batches.id = public.planner_matchday_assignments.batch_id
      and public.planner_matchday_batches.team_id = public.current_team_id()
  )
);

drop policy if exists "planner_matchday_assignments_delete_admin_team_scope" on public.planner_matchday_assignments;
create policy "planner_matchday_assignments_delete_admin_team_scope"
on public.planner_matchday_assignments
for delete
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

comment on table public.planner_matchday_batches is 'Saved planner batches for friendly and tournament generation history.';
comment on table public.planner_matchday_assignments is 'Per-player, per-match planner outcomes used for fairness tracking across weeks.';
