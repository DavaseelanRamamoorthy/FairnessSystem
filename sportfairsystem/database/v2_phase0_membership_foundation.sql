create table if not exists public.membership_seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint membership_seasons_date_order_check check (start_date <= end_date),
  constraint membership_seasons_team_name_unique unique (team_id, name)
);

create index if not exists membership_seasons_team_idx
  on public.membership_seasons (team_id, start_date desc, end_date desc);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid references public.membership_seasons(id) on delete set null,
  name text not null,
  role text not null default 'player' check (role in ('admin', 'captain', 'player')),
  status text not null default 'active' check (status in ('active', 'inactive', 'invited', 'archived')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists team_members_team_idx
  on public.team_members (team_id, status, role, name);

create index if not exists team_members_season_idx
  on public.team_members (season_id);

create table if not exists public.member_links (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.team_members(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint member_links_member_unique unique (member_id),
  constraint member_links_link_presence_check check (
    user_id is not null or player_id is not null
  )
);

create unique index if not exists member_links_user_unique_idx
  on public.member_links (user_id)
  where user_id is not null;

create unique index if not exists member_links_player_unique_idx
  on public.member_links (player_id)
  where player_id is not null;

alter table public.membership_seasons enable row level security;
alter table public.team_members enable row level security;
alter table public.member_links enable row level security;

drop policy if exists "membership_seasons_select_team_scope" on public.membership_seasons;
create policy "membership_seasons_select_team_scope"
on public.membership_seasons
for select
using (team_id = public.current_team_id());

drop policy if exists "membership_seasons_insert_admin_team_scope" on public.membership_seasons;
create policy "membership_seasons_insert_admin_team_scope"
on public.membership_seasons
for insert
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "membership_seasons_update_admin_team_scope" on public.membership_seasons;
create policy "membership_seasons_update_admin_team_scope"
on public.membership_seasons
for update
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
)
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "membership_seasons_delete_admin_team_scope" on public.membership_seasons;
create policy "membership_seasons_delete_admin_team_scope"
on public.membership_seasons
for delete
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "team_members_select_team_scope" on public.team_members;
create policy "team_members_select_team_scope"
on public.team_members
for select
using (team_id = public.current_team_id());

drop policy if exists "team_members_insert_admin_team_scope" on public.team_members;
create policy "team_members_insert_admin_team_scope"
on public.team_members
for insert
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "team_members_update_admin_team_scope" on public.team_members;
create policy "team_members_update_admin_team_scope"
on public.team_members
for update
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
)
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "team_members_delete_admin_team_scope" on public.team_members;
create policy "team_members_delete_admin_team_scope"
on public.team_members
for delete
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "member_links_select_team_scope" on public.member_links;
create policy "member_links_select_team_scope"
on public.member_links
for select
using (
  exists (
    select 1
    from public.team_members
    where public.team_members.id = public.member_links.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "member_links_insert_admin_team_scope" on public.member_links;
create policy "member_links_insert_admin_team_scope"
on public.member_links
for insert
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.member_links.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "member_links_update_admin_team_scope" on public.member_links;
create policy "member_links_update_admin_team_scope"
on public.member_links
for update
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.member_links.member_id
      and public.team_members.team_id = public.current_team_id()
  )
)
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.member_links.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

drop policy if exists "member_links_delete_admin_team_scope" on public.member_links;
create policy "member_links_delete_admin_team_scope"
on public.member_links
for delete
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.member_links.member_id
      and public.team_members.team_id = public.current_team_id()
  )
);

comment on table public.membership_seasons is 'V2 membership validity windows for team operations.';
comment on table public.team_members is 'V2 operational team membership records, separate from auth users and stats players.';
comment on table public.member_links is 'V2 links between team membership records and optional user/player identities.';
