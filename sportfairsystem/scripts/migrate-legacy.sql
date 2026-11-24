-- One-time copy of the v1/v2 app's data (now in schema `legacy`) into the v3
-- tables. Run as the database owner AFTER the v3 migrations, e.g. in the
-- Supabase SQL editor. It runs in one transaction and ends with a
-- reconciliation report; nothing in `legacy` is changed.
--
-- Mapping notes
--   * legacy.team_members is the person; legacy.players.member_id links stats.
--   * Old seasons get membership_fee = 0, so everyone counts as paid.
--   * Old matches become fixtures in a "Friendlies <year>" competition.
--   * Planner assignments only carry over where a batch slot was linked to a
--     real scorecard (planner_matchday_actual_links); others had no match.

begin;

-- teams / seasons ---------------------------------------------------------
insert into public.teams (id, name, created_at)
select id, name, created_at from legacy.teams
on conflict (id) do nothing;

insert into public.seasons (id, team_id, year, starts_on, ends_on, membership_fee, is_current, created_at)
select ms.id, ms.team_id,
       coalesce(nullif(regexp_replace(ms.name, '\D', '', 'g'), '')::int, extract(year from ms.start_date)::int),
       ms.start_date, coalesce(ms.end_date, make_date(extract(year from ms.start_date)::int, 12, 31)),
       0, false, ms.created_at
from legacy.membership_seasons ms
on conflict (id) do nothing;

-- Latest season becomes current.
update public.seasons s set is_current = true
where s.id = (select id from public.seasons s2 where s2.team_id = s.team_id order by year desc limit 1);

-- members ------------------------------------------------------------------
insert into public.members (id, team_id, user_id, display_name, primary_roles, is_wicketkeeper, bowls,
                            bat_hand, bowl_style, bat_pref, bowl_pref, created_at)
select tm.id, tm.team_id,
       case when row_number() over (partition by tm.user_id order by tm.created_at) = 1 then tm.user_id end,
       tm.name,
       array(select distinct r from unnest(array[
               case when u.primary_role ilike '%all%' then 'all_rounder' end,
               case when u.primary_role ilike '%bat%' then 'batter' end,
               case when u.primary_role ilike '%bowl%' then 'bowler' end,
               case when u.primary_role ilike '%keep%' or p.is_wicket_keeper then 'wicket_keeper' end]) r
             where r is not null),
       coalesce(p.is_wicket_keeper, false) or coalesce(u.primary_role ilike '%keep%', false),
       coalesce(u.primary_role ~* 'bowl|all', false) or coalesce('bowler' = any (p.role_tags), false)
         or coalesce('all-rounder' = any (p.role_tags), false),
       case when u.batting_style ilike 'left%' then 'left' when u.batting_style ilike 'right%' then 'right' end,
       u.bowling_style,
       case when u.batter_preference ilike '%top%' or u.batter_preference ilike '%open%' then 'top'
            when u.batter_preference ilike '%middle%' then 'middle'
            when u.batter_preference ilike '%lower%' or u.batter_preference ilike '%tail%' then 'lower'
            else 'flexible' end,
       case when u.bowler_preference ilike '%power%' or u.bowler_preference ilike '%new ball%' then 'powerplay'
            when u.bowler_preference ilike '%middle%' then 'middle'
            when u.bowler_preference ilike '%death%' then 'death'
            else 'flexible' end,
       tm.created_at
from legacy.team_members tm
left join legacy.users u on u.id = tm.user_id
left join lateral (
  select bool_or(pl.is_wicket_keeper) as is_wicket_keeper, array_agg(distinct t) filter (where t is not null) as role_tags
  from legacy.players pl left join lateral unnest(pl.role_tags) t on true
  where pl.member_id = tm.id
) p on true
on conflict (id) do nothing;

insert into public.member_private (member_id, email, phone)
select m.id, u.email, nullif(concat_ws(' ', u.phone_country_code, u.phone_number), '')
from public.members m join legacy.users u on u.id = m.user_id
on conflict (member_id) do nothing;

insert into public.season_members (season_id, member_id, role, status, joined_on, left_on)
select tm.season_id, tm.id,
       case tm.team_role when 'organiser' then 'organiser' when 'captain' then 'captain'
                         else case tm.role when 'admin' then 'organiser' when 'captain' then 'captain' else 'player' end end,
       case when tm.status = 'active' then 'active' else 'left' end,
       coalesce(tm.joined_at::date, s.starts_on),
       case when tm.status <> 'active' then greatest(coalesce(tm.left_at::date, s.ends_on), coalesce(tm.joined_at::date, s.starts_on)) end
from legacy.team_members tm
join public.seasons s on s.id = tm.season_id
on conflict (season_id, member_id) do nothing;

-- identities -------------------------------------------------------------------
insert into public.member_identities (team_id, member_id, source, external_id, display_name, name_key)
select m.team_id, m.id, 'app_account', m.user_id::text, m.display_name, app_private.name_key(m.display_name)
from public.members m where m.user_id is not null
on conflict do nothing;

insert into public.member_identities (team_id, member_id, source, display_name, name_key)
select a.team_id, a.member_id, case a.alias_type when 'scorecard' then 'pdf' else 'manual' end,
       a.alias, app_private.name_key(a.alias)
from legacy.team_member_aliases a
where a.member_id is not null and app_private.name_key(a.alias) <> ''
on conflict do nothing;

insert into public.member_identities (team_id, member_id, source, display_name, name_key)
select pl.team_id, pl.member_id, 'pdf', pl.name, app_private.name_key(pl.name)
from legacy.players pl
where pl.member_id is not null and not pl.is_guest
on conflict do nothing;

insert into public.member_identities (team_id, member_id, source, display_name, name_key)
select m.team_id, m.id, 'cricheroes', u.cricheroes_name, app_private.name_key(u.cricheroes_name)
from public.members m join legacy.users u on u.id = m.user_id
where coalesce(u.cricheroes_name, '') <> ''
on conflict do nothing;

-- fixtures ---------------------------------------------------------------------
insert into public.competitions (season_id, name, kind, fairness_weight)
select distinct s.id, format('Friendlies %s', s.year), 'friendly_series', 1
from legacy.matches mt
join public.seasons s on s.team_id = mt.team_id and mt.match_date between s.starts_on and s.ends_on
on conflict (season_id, name) do nothing;

insert into public.fixtures (id, competition_id, match_date, slot, opponent, ground, overs, status, result,
                             result_summary, created_at)
select mt.id, c.id, mt.match_date,
       row_number() over (partition by mt.team_id, mt.match_date order by mt.match_code, mt.created_at),
       coalesce(case when lower(btrim(mt.team_a)) = lower(btrim(t.name)) then mt.team_b else mt.team_a end, 'Opponent'),
       mt.ground,
       coalesce(nullif(greatest(ceil(max_overs.o), 0), 0), 20)::int,
       'played',
       case lower(mt.result) when 'won' then 'won' when 'lost' then 'lost' end,
       mt.result_summary, mt.created_at
from legacy.matches mt
join legacy.teams t on t.id = mt.team_id
join public.seasons s on s.team_id = mt.team_id and mt.match_date between s.starts_on and s.ends_on
join public.competitions c on c.season_id = s.id and c.name = format('Friendlies %s', s.year)
left join lateral (select max(i.overs) o from legacy.innings i where i.match_id = mt.id) max_overs on true
on conflict (id) do nothing;

insert into public.innings (id, fixture_id, innings_no, ours, team_name, runs, wickets, balls, extras)
select i.id, i.match_id, coalesce(i.innings_number, row_number() over (partition by i.match_id order by i.created_at))::int,
       lower(btrim(i.team_name)) = lower(btrim(t.name)), i.team_name,
       coalesce(i.runs, 0), coalesce(i.wickets, 0),
       (trunc(coalesce(i.overs, 0)) * 6 + round((coalesce(i.overs, 0) - trunc(coalesce(i.overs, 0))) * 10))::int,
       coalesce(i.extras, 0)
from legacy.innings i
join legacy.matches mt on mt.id = i.match_id
join legacy.teams t on t.id = mt.team_id
on conflict (id) do nothing;

-- batting: keep the scorecard order; fall back to row order if a position repeats
insert into public.batting (id, innings_id, member_id, name_raw, position, runs, balls, fours, sixes, how_out, not_out, did_bat)
select b.id, b.innings_id, pl.member_id, b.player_name,
       row_number() over (partition by b.innings_id order by coalesce(b.batting_position, 99), b.created_at)::int,
       coalesce(b.runs, 0), coalesce(b.balls, 0), coalesce(b.fours, 0), coalesce(b.sixes, 0),
       b.dismissal, coalesce(b.dismissal ilike '%not out%', false), true
from legacy.batting_stats b
left join legacy.players pl on pl.id = b.player_id and not pl.is_guest
where exists (select 1 from public.innings i where i.id = b.innings_id)
on conflict (id) do nothing;

-- players in the XI who did not bat (from the playing squad list)
insert into public.batting (innings_id, member_id, name_raw, position, did_bat)
select innings_id, member_id, player_name, position, false
from (
  select i.id as innings_id, pl.member_id, mp.player_name,
         (coalesce((select max(position) from public.batting x where x.innings_id = i.id), 0)
          + row_number() over (partition by i.id order by mp.player_order))::int as position
  from legacy.match_players mp
  join public.innings i on i.fixture_id = mp.match_id and i.ours
  join legacy.players pl on pl.id = mp.player_id and not pl.is_guest and pl.member_id is not null
  where lower(btrim(mp.team_name)) = lower(btrim(i.team_name))
    and not exists (select 1 from public.batting b where b.innings_id = i.id and b.member_id = pl.member_id)
    and not exists (select 1 from public.batting b where b.innings_id = i.id
                    and app_private.name_key(b.name_raw) = app_private.name_key(mp.player_name))
) dnb
where position <= 11;

insert into public.bowling (id, innings_id, member_id, name_raw, balls, maidens, runs, wickets, wides, no_balls)
select bw.id, bw.innings_id, pl.member_id, bw.player_name,
       (trunc(coalesce(bw.overs, 0)) * 6 + round((coalesce(bw.overs, 0) - trunc(coalesce(bw.overs, 0))) * 10))::int,
       coalesce(bw.maidens, 0), coalesce(bw.runs, 0), coalesce(bw.wickets, 0),
       coalesce(bw.wides, 0), coalesce(bw.no_balls, 0)
from legacy.bowling_stats bw
left join legacy.players pl on pl.id = bw.player_id and not pl.is_guest
where exists (select 1 from public.innings i where i.id = bw.innings_id)
on conflict (id) do nothing;

-- planner history -> availability + selections (linked slots only) ---------------
insert into public.availability (fixture_id, member_id, answer, on_time, source, captured_at)
select distinct on (l.match_id, a.member_id)
       l.match_id, a.member_id, case when a.is_available and a.assignment <> 'unavailable' then 'yes' else 'no' end,
       true, 'legacy', a.created_at
from legacy.planner_matchday_assignments a
join legacy.planner_matchday_actual_links l on l.batch_id = a.batch_id and l.match_number = a.match_number
where a.member_id is not null and exists (select 1 from public.members m where m.id = a.member_id)
order by l.match_id, a.member_id, a.created_at desc
on conflict (fixture_id, member_id) do nothing;

insert into public.selections (fixture_id, member_id, slot, reason, published_at)
select distinct on (l.match_id, a.member_id)
       l.match_id, a.member_id, case a.assignment when 'xi' then 'xi' when 'twelfth' then 'twelfth' else 'reserve' end,
       'Imported from the old planner', a.created_at
from legacy.planner_matchday_assignments a
join legacy.planner_matchday_actual_links l on l.batch_id = a.batch_id and l.match_number = a.match_number
where a.member_id is not null and a.assignment in ('xi', 'twelfth', 'bench')
  and exists (select 1 from public.members m where m.id = a.member_id)
order by l.match_id, a.member_id, a.created_at desc
on conflict (fixture_id, member_id) do nothing;

-- reconciliation report ------------------------------------------------------------
select 'members' as item, (select count(*) from legacy.team_members) as legacy, (select count(*) from public.members) as v3
union all select 'fixtures', (select count(*) from legacy.matches), (select count(*) from public.fixtures)
union all select 'innings', (select count(*) from legacy.innings), (select count(*) from public.innings)
union all select 'own-team batting rows (batted)',
  (select count(*) from legacy.batting_stats b join legacy.innings i on i.id = b.innings_id
     join legacy.matches mt on mt.id = i.match_id join legacy.teams t on t.id = mt.team_id
     where lower(btrim(i.team_name)) = lower(btrim(t.name))),
  (select count(*) from public.batting b join public.innings i on i.id = b.innings_id where i.ours and b.did_bat)
union all select 'bowling rows', (select count(*) from legacy.bowling_stats), (select count(*) from public.bowling)
union all select 'linked planner slots', (select count(*) from legacy.planner_matchday_actual_links),
  (select count(distinct fixture_id) from public.selections)
union all select 'identities', (select count(*) from legacy.team_member_aliases), (select count(*) from public.member_identities);

commit;
