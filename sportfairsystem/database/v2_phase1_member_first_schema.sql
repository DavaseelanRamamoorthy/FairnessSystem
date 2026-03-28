-- V2 Phase 1 member-first schema draft
--
-- Review before applying:
-- 1. This migration is additive-only
-- 2. It does not remove players, member_links, or users.player_id
-- 3. It prepares the schema for alias-driven scorecard resolution

alter table public.team_members
  add column if not exists user_id uuid references public.users(id) on delete cascade,
  add column if not exists joined_at timestamptz,
  add column if not exists left_at timestamptz,
  add column if not exists invited_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists team_members_team_user_unique_idx
  on public.team_members (team_id, user_id)
  where user_id is not null;

create table if not exists public.team_member_aliases (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  alias_type text not null default 'scorecard' check (alias_type in ('primary', 'scorecard', 'short', 'legacy')),
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists team_member_aliases_team_normalized_alias_unique_idx
  on public.team_member_aliases (team_id, normalized_alias);

create unique index if not exists team_member_aliases_primary_member_unique_idx
  on public.team_member_aliases (member_id)
  where is_primary = true;

create index if not exists team_member_aliases_member_idx
  on public.team_member_aliases (member_id, alias_type, created_at desc);

alter table public.players
  add column if not exists member_id uuid references public.team_members(id) on delete set null;

create unique index if not exists players_member_id_unique_idx
  on public.players (member_id)
  where member_id is not null;

alter table public.team_member_aliases enable row level security;

drop policy if exists "team_member_aliases_select_team_scope" on public.team_member_aliases;
create policy "team_member_aliases_select_team_scope"
on public.team_member_aliases
for select
using (team_id = public.current_team_id());

drop policy if exists "team_member_aliases_insert_admin_team_scope" on public.team_member_aliases;
create policy "team_member_aliases_insert_admin_team_scope"
on public.team_member_aliases
for insert
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.team_member_aliases.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "team_member_aliases_update_admin_team_scope" on public.team_member_aliases;
create policy "team_member_aliases_update_admin_team_scope"
on public.team_member_aliases
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
    where public.team_members.id = public.team_member_aliases.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "team_member_aliases_delete_admin_team_scope" on public.team_member_aliases;
create policy "team_member_aliases_delete_admin_team_scope"
on public.team_member_aliases
for delete
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

comment on column public.team_members.user_id is 'Primary app user identity for this team membership.';
comment on column public.team_members.joined_at is 'When the user became an active member of the team.';
comment on column public.team_members.left_at is 'When the member left or became inactive.';
comment on column public.team_members.invited_by_user_id is 'App user who invited this membership, when available.';
comment on column public.team_members.updated_at is 'Last update timestamp for the membership record.';

comment on table public.team_member_aliases is 'Alias names used to resolve scorecard identities and legacy naming variants for team members.';
comment on column public.team_member_aliases.alias is 'Display form of a team member alias.';
comment on column public.team_member_aliases.normalized_alias is 'Normalized alias used for exact scorecard resolution inside a team.';
comment on column public.team_member_aliases.alias_type is 'Alias source or intent: primary, scorecard, short, or legacy.';
comment on column public.team_member_aliases.is_primary is 'Marks the main alias displayed for the member.';

comment on column public.players.member_id is 'Compatibility link from legacy stats player identity to the owning V2 team membership.';
