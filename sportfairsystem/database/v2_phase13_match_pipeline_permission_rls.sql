-- V2 Phase 13 match pipeline permission-aware RLS
--
-- Purpose:
-- 1. Move scorecard and match-write tables off raw admin-only RLS.
-- 2. Align match insert/update/delete flows with organiser or scoped match-data permissions.
-- 3. Keep legacy admin compatibility while the app finishes the V2 role transition.

create or replace function public.can_manage_match_data_workspace()
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
      where tmp.permission = 'stats_manage'
    ),
    false
  );
$$;

comment on function public.can_manage_match_data_workspace() is 'Returns true when the authenticated user can insert, update, delete, or repair scorecard and match data for the current team.';

drop policy if exists "matches_insert_admin_team_scope" on public.matches;
drop policy if exists "matches_insert_manage_team_scope" on public.matches;
create policy "matches_insert_manage_team_scope"
on public.matches
for insert
with check (
  public.can_manage_match_data_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "matches_update_admin_team_scope" on public.matches;
drop policy if exists "matches_update_manage_team_scope" on public.matches;
create policy "matches_update_manage_team_scope"
on public.matches
for update
using (
  public.can_manage_match_data_workspace()
  and team_id = public.current_team_id()
)
with check (
  public.can_manage_match_data_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "matches_delete_admin_team_scope" on public.matches;
drop policy if exists "matches_delete_manage_team_scope" on public.matches;
create policy "matches_delete_manage_team_scope"
on public.matches
for delete
using (
  public.can_manage_match_data_workspace()
  and team_id = public.current_team_id()
);

drop policy if exists "innings_insert_admin_team_scope" on public.innings;
drop policy if exists "innings_insert_manage_team_scope" on public.innings;
create policy "innings_insert_manage_team_scope"
on public.innings
for insert
with check (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.innings.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "innings_update_admin_team_scope" on public.innings;
drop policy if exists "innings_update_manage_team_scope" on public.innings;
create policy "innings_update_manage_team_scope"
on public.innings
for update
using (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.innings.match_id
      and public.matches.team_id = public.current_team_id()
  )
)
with check (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.innings.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "innings_delete_admin_team_scope" on public.innings;
drop policy if exists "innings_delete_manage_team_scope" on public.innings;
create policy "innings_delete_manage_team_scope"
on public.innings
for delete
using (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.innings.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_players_insert_admin_team_scope" on public.match_players;
drop policy if exists "match_players_insert_manage_team_scope" on public.match_players;
create policy "match_players_insert_manage_team_scope"
on public.match_players
for insert
with check (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_players.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_players_update_admin_team_scope" on public.match_players;
drop policy if exists "match_players_update_manage_team_scope" on public.match_players;
create policy "match_players_update_manage_team_scope"
on public.match_players
for update
using (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_players.match_id
      and public.matches.team_id = public.current_team_id()
  )
)
with check (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_players.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_players_delete_admin_team_scope" on public.match_players;
drop policy if exists "match_players_delete_manage_team_scope" on public.match_players;
create policy "match_players_delete_manage_team_scope"
on public.match_players
for delete
using (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_players.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "batting_stats_insert_admin_team_scope" on public.batting_stats;
drop policy if exists "batting_stats_insert_manage_team_scope" on public.batting_stats;
create policy "batting_stats_insert_manage_team_scope"
on public.batting_stats
for insert
with check (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.batting_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "batting_stats_update_admin_team_scope" on public.batting_stats;
drop policy if exists "batting_stats_update_manage_team_scope" on public.batting_stats;
create policy "batting_stats_update_manage_team_scope"
on public.batting_stats
for update
using (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.batting_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
)
with check (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.batting_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "batting_stats_delete_admin_team_scope" on public.batting_stats;
drop policy if exists "batting_stats_delete_manage_team_scope" on public.batting_stats;
create policy "batting_stats_delete_manage_team_scope"
on public.batting_stats
for delete
using (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.batting_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "bowling_stats_insert_admin_team_scope" on public.bowling_stats;
drop policy if exists "bowling_stats_insert_manage_team_scope" on public.bowling_stats;
create policy "bowling_stats_insert_manage_team_scope"
on public.bowling_stats
for insert
with check (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.bowling_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "bowling_stats_update_admin_team_scope" on public.bowling_stats;
drop policy if exists "bowling_stats_update_manage_team_scope" on public.bowling_stats;
create policy "bowling_stats_update_manage_team_scope"
on public.bowling_stats
for update
using (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.bowling_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
)
with check (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.bowling_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "bowling_stats_delete_admin_team_scope" on public.bowling_stats;
drop policy if exists "bowling_stats_delete_manage_team_scope" on public.bowling_stats;
create policy "bowling_stats_delete_manage_team_scope"
on public.bowling_stats
for delete
using (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.bowling_stats.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "fall_of_wickets_insert_admin_team_scope" on public.fall_of_wickets;
drop policy if exists "fall_of_wickets_insert_manage_team_scope" on public.fall_of_wickets;
create policy "fall_of_wickets_insert_manage_team_scope"
on public.fall_of_wickets
for insert
with check (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.fall_of_wickets.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "fall_of_wickets_update_admin_team_scope" on public.fall_of_wickets;
drop policy if exists "fall_of_wickets_update_manage_team_scope" on public.fall_of_wickets;
create policy "fall_of_wickets_update_manage_team_scope"
on public.fall_of_wickets
for update
using (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.fall_of_wickets.innings_id
      and public.matches.team_id = public.current_team_id()
  )
)
with check (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.fall_of_wickets.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "fall_of_wickets_delete_admin_team_scope" on public.fall_of_wickets;
drop policy if exists "fall_of_wickets_delete_manage_team_scope" on public.fall_of_wickets;
create policy "fall_of_wickets_delete_manage_team_scope"
on public.fall_of_wickets
for delete
using (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.innings
    join public.matches on public.matches.id = public.innings.match_id
    where public.innings.id = public.fall_of_wickets.innings_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_officials_insert_admin_team_scope" on public.match_officials;
drop policy if exists "match_officials_insert_manage_team_scope" on public.match_officials;
create policy "match_officials_insert_manage_team_scope"
on public.match_officials
for insert
with check (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_officials.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_officials_update_admin_team_scope" on public.match_officials;
drop policy if exists "match_officials_update_manage_team_scope" on public.match_officials;
create policy "match_officials_update_manage_team_scope"
on public.match_officials
for update
using (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_officials.match_id
      and public.matches.team_id = public.current_team_id()
  )
)
with check (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_officials.match_id
      and public.matches.team_id = public.current_team_id()
  )
);

drop policy if exists "match_officials_delete_admin_team_scope" on public.match_officials;
drop policy if exists "match_officials_delete_manage_team_scope" on public.match_officials;
create policy "match_officials_delete_manage_team_scope"
on public.match_officials
for delete
using (
  public.can_manage_match_data_workspace()
  and exists (
    select 1
    from public.matches
    where public.matches.id = public.match_officials.match_id
      and public.matches.team_id = public.current_team_id()
  )
);
