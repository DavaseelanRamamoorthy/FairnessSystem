create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users
  where id = auth.uid()
$$;

create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id
  from public.users
  where id = auth.uid()
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.innings enable row level security;
alter table public.match_players enable row level security;
alter table public.batting_stats enable row level security;
alter table public.bowling_stats enable row level security;
alter table public.fall_of_wickets enable row level security;
alter table public.match_officials enable row level security;

drop policy if exists "teams_select_own_team" on public.teams;
create policy "teams_select_own_team"
on public.teams
for select
using (id = public.current_team_id());

drop policy if exists "players_select_team_scope" on public.players;
create policy "players_select_team_scope"
on public.players
for select
using (team_id = public.current_team_id());

drop policy if exists "players_insert_admin_team_scope" on public.players;
create policy "players_insert_admin_team_scope"
on public.players
for insert
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "players_update_admin_team_scope" on public.players;
create policy "players_update_admin_team_scope"
on public.players
for update
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
)
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "players_delete_admin_team_scope" on public.players;
create policy "players_delete_admin_team_scope"
on public.players
for delete
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "matches_select_team_scope" on public.matches;
create policy "matches_select_team_scope"
on public.matches
for select
using (team_id = public.current_team_id());

drop policy if exists "matches_insert_admin_team_scope" on public.matches;
create policy "matches_insert_admin_team_scope"
on public.matches
for insert
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "matches_update_admin_team_scope" on public.matches;
create policy "matches_update_admin_team_scope"
on public.matches
for update
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
)
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "matches_delete_admin_team_scope" on public.matches;
create policy "matches_delete_admin_team_scope"
on public.matches
for delete
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "innings_select_team_scope" on public.innings;
create policy "innings_select_team_scope"
on public.innings
for select
using (
  exists (
    select 1
    from public.matches
    where public.matches.id = public.innings.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "innings_insert_admin_team_scope" on public.innings;
create policy "innings_insert_admin_team_scope"
on public.innings
for insert
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.innings.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "innings_update_admin_team_scope" on public.innings;
create policy "innings_update_admin_team_scope"
on public.innings
for update
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.innings.match_id
      and public.matches.team_id = public.current_team_id()
  )
)
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.innings.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "innings_delete_admin_team_scope" on public.innings;
create policy "innings_delete_admin_team_scope"
on public.innings
for delete
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.innings.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_players_select_team_scope" on public.match_players;
create policy "match_players_select_team_scope"
on public.match_players
for select
using (
  exists (
    select 1
    from public.matches
    where public.matches.id = public.match_players.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_players_insert_admin_team_scope" on public.match_players;
create policy "match_players_insert_admin_team_scope"
on public.match_players
for insert
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_players.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_players_update_admin_team_scope" on public.match_players;
create policy "match_players_update_admin_team_scope"
on public.match_players
for update
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_players.match_id
      and public.matches.team_id = public.current_team_id()
  )
)
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_players.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_players_delete_admin_team_scope" on public.match_players;
create policy "match_players_delete_admin_team_scope"
on public.match_players
for delete
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_players.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "batting_stats_select_team_scope" on public.batting_stats;
create policy "batting_stats_select_team_scope"
on public.batting_stats
for select
using (
  exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.batting_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "batting_stats_insert_admin_team_scope" on public.batting_stats;
create policy "batting_stats_insert_admin_team_scope"
on public.batting_stats
for insert
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.batting_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "batting_stats_update_admin_team_scope" on public.batting_stats;
create policy "batting_stats_update_admin_team_scope"
on public.batting_stats
for update
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.batting_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
)
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.batting_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "batting_stats_delete_admin_team_scope" on public.batting_stats;
create policy "batting_stats_delete_admin_team_scope"
on public.batting_stats
for delete
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.batting_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "bowling_stats_select_team_scope" on public.bowling_stats;
create policy "bowling_stats_select_team_scope"
on public.bowling_stats
for select
using (
  exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.bowling_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "bowling_stats_insert_admin_team_scope" on public.bowling_stats;
create policy "bowling_stats_insert_admin_team_scope"
on public.bowling_stats
for insert
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.bowling_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "bowling_stats_update_admin_team_scope" on public.bowling_stats;
create policy "bowling_stats_update_admin_team_scope"
on public.bowling_stats
for update
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.bowling_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
)
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.bowling_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "bowling_stats_delete_admin_team_scope" on public.bowling_stats;
create policy "bowling_stats_delete_admin_team_scope"
on public.bowling_stats
for delete
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.bowling_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "fall_of_wickets_select_team_scope" on public.fall_of_wickets;
create policy "fall_of_wickets_select_team_scope"
on public.fall_of_wickets
for select
using (
  exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.fall_of_wickets.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "fall_of_wickets_insert_admin_team_scope" on public.fall_of_wickets;
create policy "fall_of_wickets_insert_admin_team_scope"
on public.fall_of_wickets
for insert
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.fall_of_wickets.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "fall_of_wickets_update_admin_team_scope" on public.fall_of_wickets;
create policy "fall_of_wickets_update_admin_team_scope"
on public.fall_of_wickets
for update
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.fall_of_wickets.innings_id
      and public.matches.team_id = public.current_team_id()
  )
)
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.fall_of_wickets.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "fall_of_wickets_delete_admin_team_scope" on public.fall_of_wickets;
create policy "fall_of_wickets_delete_admin_team_scope"
on public.fall_of_wickets
for delete
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.fall_of_wickets.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_officials_select_team_scope" on public.match_officials;
create policy "match_officials_select_team_scope"
on public.match_officials
for select
using (
  exists (
    select 1
    from public.matches
    where public.matches.id = public.match_officials.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_officials_insert_admin_team_scope" on public.match_officials;
create policy "match_officials_insert_admin_team_scope"
on public.match_officials
for insert
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_officials.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_officials_update_admin_team_scope" on public.match_officials;
create policy "match_officials_update_admin_team_scope"
on public.match_officials
for update
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_officials.match_id
      and public.matches.team_id = public.current_team_id()
  )
)
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_officials.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_officials_delete_admin_team_scope" on public.match_officials;
create policy "match_officials_delete_admin_team_scope"
on public.match_officials
for delete
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_officials.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

comment on function public.current_app_role() is 'Returns the authenticated application role from public.users.';
comment on function public.current_team_id() is 'Returns the authenticated user team_id from public.users.';
comment on function public.is_admin_user() is 'Returns true when the authenticated user role is admin.';
