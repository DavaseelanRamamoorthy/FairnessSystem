-- v_fixture_facts was a security-invoker view, so every batting and bowling
-- row ran its own row-level-security check (~1 ms each). With real history
-- (thousands of scorecard rows) that took >5 s and hit the API timeout.
-- It now runs as the view owner and checks the viewer once per season:
--   * only seasons of a team the viewer belongs to are returned;
--   * draft (unpublished) team selections are only included for captains,
--     vice-captains and the organiser, exactly as the selections policy did.
-- Contact details and money are not part of this view.

create or replace view public.v_fixture_facts with (security_invoker = false) as
with viewer as (
  -- Checked once per season (not once per scorecard row): the viewer must be
  -- in the team; managers also see draft teams.
  select s.id as season_id, app_private.can_manage_matches(s.team_id) as manages
  from public.seasons s
  where app_private.is_member(s.team_id) or app_private.can_manage_matches(s.team_id)
),
fx as (
  select f.id as fixture_id, c.season_id, f.match_date, f.slot, f.status, f.overs,
         c.fairness_weight, c.kind as competition_kind
  from public.fixtures f
  join public.competitions c on c.id = f.competition_id
  join viewer v on v.season_id = c.season_id
),
visible_selections as (
  select sel.* from public.selections sel
  join public.fixtures f on f.id = sel.fixture_id
  join public.competitions c on c.id = f.competition_id
  join viewer v on v.season_id = c.season_id
  where sel.published_at is not null or v.manages
),
played as (
  select i.fixture_id, b.member_id,
         min(case when b.did_bat then b.position end) as bat_position,
         bool_or(true) as listed
  from public.batting b join public.innings i on i.id = b.innings_id
  where i.ours and b.member_id is not null
  group by i.fixture_id, b.member_id
),
bowled as (
  select i.fixture_id, bw.member_id, sum(bw.balls)::int as balls_bowled
  from public.bowling bw join public.innings i on i.id = bw.innings_id
  where not i.ours and bw.member_id is not null
  group by i.fixture_id, bw.member_id
),
team_bowling as (
  select i.fixture_id, sum(bw.balls)::int as team_balls_bowled
  from public.bowling bw join public.innings i on i.id = bw.innings_id
  where not i.ours
  group by i.fixture_id
),
people as (
  select fixture_id, member_id from public.availability
  union select fixture_id, member_id from played
  union select fixture_id, member_id from bowled
  union select fixture_id, member_id from visible_selections
)
select
  fx.fixture_id, fx.season_id, fx.match_date, fx.slot, fx.status, fx.overs,
  fx.fairness_weight, fx.competition_kind,
  pe.member_id,
  m.bowls, m.is_wicketkeeper, m.bat_pref,
  sm.role as season_role, sm.joined_on, sm.left_on,
  app_private.membership_paid_on(fx.season_id, pe.member_id, fx.match_date) as membership_paid,
  exists (select 1 from public.unavailability u
          where u.member_id = pe.member_id and fx.match_date between u.from_date and u.to_date) as unavailable,
  a.answer, coalesce(a.on_time, false) as on_time,
  sel.slot as selected_slot, sel.planned_bat_pos, sel.planned_overs,
  coalesce(pl.listed, false) or coalesce(bo.balls_bowled, 0) > 0 as played,
  pl.bat_position,
  coalesce(bo.balls_bowled, 0) as balls_bowled,
  coalesce(tb.team_balls_bowled, 0) as team_balls_bowled
from people pe
join fx on fx.fixture_id = pe.fixture_id
join public.members m on m.id = pe.member_id
left join public.season_members sm on sm.season_id = fx.season_id and sm.member_id = pe.member_id
left join public.availability a on a.fixture_id = pe.fixture_id and a.member_id = pe.member_id
left join visible_selections sel on sel.fixture_id = pe.fixture_id and sel.member_id = pe.member_id
left join played pl on pl.fixture_id = pe.fixture_id and pl.member_id = pe.member_id
left join bowled bo on bo.fixture_id = pe.fixture_id and bo.member_id = pe.member_id
left join team_bowling tb on tb.fixture_id = pe.fixture_id;

revoke all on public.v_fixture_facts from anon, public;
grant select on public.v_fixture_facts to authenticated;

-- Same once-per-season check for the season stats (it also reads v_fixture_facts).
create or replace view public.v_player_stats with (security_invoker = false) as
with viewer as (
  select s.id as season_id from public.seasons s
  where app_private.is_member(s.team_id) or app_private.can_manage_matches(s.team_id)
),
bat as (
  select c.season_id, b.member_id,
         count(*) filter (where b.did_bat) as innings,
         count(*) filter (where b.did_bat and b.not_out) as not_outs,
         sum(b.runs) as runs, sum(b.balls) as balls_faced,
         max(b.runs) as high_score,
         count(*) filter (where b.runs >= 50) as fifties,
         sum(b.fours) as fours, sum(b.sixes) as sixes
  from public.batting b
  join public.innings i on i.id = b.innings_id and i.ours
  join public.fixtures f on f.id = i.fixture_id
  join public.competitions c on c.id = f.competition_id
  join viewer vw on vw.season_id = c.season_id
  where b.member_id is not null
  group by c.season_id, b.member_id
),
bowl as (
  select c.season_id, bw.member_id,
         sum(bw.balls) as balls_bowled, sum(bw.runs) as runs_conceded,
         sum(bw.wickets) as wickets, sum(bw.maidens) as maidens
  from public.bowling bw
  join public.innings i on i.id = bw.innings_id and not i.ours
  join public.fixtures f on f.id = i.fixture_id
  join public.competitions c on c.id = f.competition_id
  join viewer vw on vw.season_id = c.season_id
  where bw.member_id is not null
  group by c.season_id, bw.member_id
),
apps as (
  select season_id, member_id, count(*) filter (where played) as matches
  from public.v_fixture_facts group by season_id, member_id
)
select
  coalesce(bat.season_id, bowl.season_id) as season_id,
  coalesce(bat.member_id, bowl.member_id) as member_id,
  coalesce(apps.matches, 0) as matches,
  coalesce(bat.innings, 0) as innings, coalesce(bat.not_outs, 0) as not_outs,
  coalesce(bat.runs, 0) as runs, coalesce(bat.balls_faced, 0) as balls_faced,
  bat.high_score, coalesce(bat.fifties, 0) as fifties,
  coalesce(bat.fours, 0) as fours, coalesce(bat.sixes, 0) as sixes,
  case when bat.innings - bat.not_outs > 0
       then round(bat.runs::numeric / (bat.innings - bat.not_outs), 2) end as batting_average,
  case when bat.balls_faced > 0 then round(bat.runs::numeric * 100 / bat.balls_faced, 2) end as strike_rate,
  coalesce(bowl.balls_bowled, 0) as balls_bowled, coalesce(bowl.runs_conceded, 0) as runs_conceded,
  coalesce(bowl.wickets, 0) as wickets, coalesce(bowl.maidens, 0) as maidens,
  case when bowl.balls_bowled > 0 then round(bowl.runs_conceded::numeric * 6 / bowl.balls_bowled, 2) end as economy,
  case when bowl.wickets > 0 then round(bowl.runs_conceded::numeric / bowl.wickets, 2) end as bowling_average
from bat
full join bowl on bowl.season_id = bat.season_id and bowl.member_id = bat.member_id
left join apps on apps.season_id = coalesce(bat.season_id, bowl.season_id)
              and apps.member_id = coalesce(bat.member_id, bowl.member_id);

revoke all on public.v_player_stats from anon, public;
grant select on public.v_player_stats to authenticated;
