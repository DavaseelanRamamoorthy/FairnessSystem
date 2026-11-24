-- Reporting views. security_invoker makes each view obey the caller's
-- row-level security, so a player sees the same rows the tables allow.
-- Fairness *formulas* live only in src/engine (TypeScript); v_fixture_facts
-- just gathers the raw facts per fixture x member for that engine.

create view public.v_fixture_facts with (security_invoker = true) as
with fx as (
  select f.id as fixture_id, c.season_id, f.match_date, f.slot, f.status, f.overs,
         c.fairness_weight, c.kind as competition_kind
  from public.fixtures f
  join public.competitions c on c.id = f.competition_id
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
  union select fixture_id, member_id from public.selections
),
membership_paid as (
  select c.season_id, c.member_id,
         case when sum(p.amount_eur) >= max(c.amount) then max(p.paid_on) end as paid_on
  from public.charges c join public.payments p on p.charge_id = c.id
  where c.kind = 'membership' and c.cancelled_at is null
  group by c.season_id, c.member_id
)
select
  fx.fixture_id, fx.season_id, fx.match_date, fx.slot, fx.status, fx.overs,
  fx.fairness_weight, fx.competition_kind,
  pe.member_id,
  m.bowls, m.is_wicketkeeper, m.bat_pref,
  sm.role as season_role, sm.joined_on, sm.left_on,
  (s.membership_fee = 0 or mp.paid_on <= fx.match_date) as membership_paid,
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
join public.seasons s on s.id = fx.season_id
left join public.season_members sm on sm.season_id = fx.season_id and sm.member_id = pe.member_id
left join membership_paid mp on mp.season_id = fx.season_id and mp.member_id = pe.member_id
left join public.availability a on a.fixture_id = pe.fixture_id and a.member_id = pe.member_id
left join public.selections sel on sel.fixture_id = pe.fixture_id and sel.member_id = pe.member_id
left join played pl on pl.fixture_id = pe.fixture_id and pl.member_id = pe.member_id
left join bowled bo on bo.fixture_id = pe.fixture_id and bo.member_id = pe.member_id
left join team_bowling tb on tb.fixture_id = pe.fixture_id;

-- Career/season stats with a proper batting average (runs / dismissals).
create view public.v_player_stats with (security_invoker = true) as
with bat as (
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

create view public.v_member_dues with (security_invoker = true) as
select c.season_id, c.member_id, c.id as charge_id, c.kind, c.description, c.amount, c.currency, c.due_on,
       coalesce(sum(case when p.currency = c.currency then p.amount else p.amount_eur end), 0) as paid,
       c.amount - coalesce(sum(case when p.currency = c.currency then p.amount else p.amount_eur end), 0) as outstanding
from public.charges c
left join public.payments p on p.charge_id = c.id
where c.cancelled_at is null
group by c.id;

create view public.v_balance_sheet with (security_invoker = true) as
select t.season_id, s.year, extract(month from t.txn_date)::int as month,
       sum(t.amount_eur) filter (where t.direction = 'income') as income,
       sum(t.amount_eur) filter (where t.direction = 'expense') as expenses,
       sum(case when t.direction = 'income' then t.amount_eur else -t.amount_eur end) as net
from public.transactions t join public.seasons s on s.id = t.season_id
group by t.season_id, s.year, extract(month from t.txn_date);

create view public.v_tournament_costs with (security_invoker = true) as
select comp.id as competition_id, comp.season_id, comp.name, comp.entry_fee_total,
       count(cs.member_id) filter (where cs.opted_in) as players,
       case when count(cs.member_id) filter (where cs.opted_in) > 0
            then round(comp.entry_fee_total / count(cs.member_id) filter (where cs.opted_in), 2) end as cost_per_head,
       (select coalesce(sum(d.paid), 0) from public.v_member_dues d
        where d.kind = 'tournament_fee' and d.charge_id in
          (select ch.id from public.charges ch where ch.ref_id = comp.id)) as collected
from public.competitions comp
left join public.competition_squad cs on cs.competition_id = comp.id
group by comp.id;

grant select on public.v_fixture_facts, public.v_player_stats, public.v_member_dues,
  public.v_balance_sheet, public.v_tournament_costs to authenticated;
revoke all on public.v_fixture_facts, public.v_player_stats, public.v_member_dues,
  public.v_balance_sheet, public.v_tournament_costs from anon;
