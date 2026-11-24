-- Fixtures step: default deadline rule, safe fixture deletion, re-opening a
-- played fixture, manual availability, and carrying date of birth / Instagram
-- from the membership form into the private profile.

-- ---------------------------------------------------------------- rules
alter table public.seasons alter column rules set default '{"deadlineDaysBefore": 2}'::jsonb;
update public.seasons set rules = rules || '{"deadlineDaysBefore": 2}'::jsonb where not rules ? 'deadlineDaysBefore';

-- ---------------------------------------------------------------- Instagram clean-up
-- "@name" or a profile link -> "name"; anything that isn't a valid handle -> null.
create function app_private.instagram_handle(p_input text)
returns text language sql immutable set search_path = '' as $$
  select case when h ~ '^[A-Za-z0-9._]{1,30}$' then h end
  from (select regexp_replace(
                 regexp_replace(btrim(coalesce(p_input, '')), '^(https?://)?(www\.)?instagram\.com/', '', 'i'),
                 '^@|/+$', '', 'g') as h) x
$$;
grant execute on function app_private.instagram_handle(text) to authenticated;

-- When an application is approved, keep the birthday and Instagram it carried.
create function app_private.copy_application_extras()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_dob date;
begin
  if new.status <> 'approved' or old.status = 'approved' or new.existing_member_id is null then
    return new;
  end if;
  begin
    v_dob := nullif(new.answers ->> 'date_of_birth', '')::date;
  exception when others then
    v_dob := null;
  end;
  if v_dob is not null and (v_dob > current_date or v_dob < date '1920-01-01') then
    v_dob := null;
  end if;
  insert into public.member_private (member_id, date_of_birth, instagram)
  values (new.existing_member_id, v_dob, app_private.instagram_handle(new.answers ->> 'instagram'))
  on conflict (member_id) do update set
    date_of_birth = coalesce(excluded.date_of_birth, public.member_private.date_of_birth),
    instagram = coalesce(excluded.instagram, public.member_private.instagram);
  return new;
end $$;

create trigger membership_applications_copy_extras
  after update of status on public.membership_applications
  for each row execute function app_private.copy_application_extras();

-- ---------------------------------------------------------------- fixtures
-- A played fixture holds history; it can only be deleted after re-opening it.
create function app_private.protect_played_fixture()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'played' then
    raise exception 'A played fixture can''t be deleted. Re-open it first if the scorecard was wrong.'
      using errcode = '42501';
  end if;
  return old;
end $$;

create trigger fixtures_protect_played before delete on public.fixtures
  for each row execute function app_private.protect_played_fixture();

-- Puts a played fixture back to "selected" so its scorecard can be imported again.
create function public.reopen_fixture(p_fixture uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid := app_private.team_of_fixture(p_fixture);
begin
  perform app_private.require(app_private.can_manage_matches(v_team), 'Only captains can re-open a fixture');
  perform app_private.require(coalesce(btrim(p_reason), '') <> '', 'Say why the fixture is being re-opened');
  update public.fixtures set status = 'selected' where id = p_fixture and status = 'played';
  insert into public.audit_log (team_id, actor, action, target_table, target_id, after)
  values (v_team, (select auth.uid()), 'reopen', 'fixtures', p_fixture::text, jsonb_build_object('reason', p_reason));
end $$;

-- A captain sets one player's answer by hand. While the fixture is still open
-- (before the deadline snapshot) it counts as on time; afterwards it is late.
create function public.set_availability(p_fixture uuid, p_member uuid, p_answer text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid := app_private.team_of_fixture(p_fixture);
  v_status text;
begin
  perform app_private.require(app_private.can_manage_matches(v_team), 'Only captains can change availability');
  perform app_private.require(app_private.team_of_member(p_member) = v_team, 'That player is not in this team');
  select status into v_status from public.fixtures where id = p_fixture;
  perform app_private.require(v_status in ('open', 'locked', 'selected'), 'This fixture is already played');
  insert into public.availability (fixture_id, member_id, answer, on_time, source)
  values (p_fixture, p_member, p_answer, v_status = 'open', 'manual')
  on conflict (fixture_id, member_id) do update
    set answer = excluded.answer,
        on_time = case when v_status = 'open' then true
                       else public.availability.on_time and (public.availability.answer = 'yes' or excluded.answer <> 'yes') end,
        source = 'manual',
        captured_at = now();
end $$;

revoke all on function public.reopen_fixture(uuid, text) from public, anon;
revoke all on function public.set_availability(uuid, uuid, text) from public, anon;
grant execute on function public.reopen_fixture(uuid, text) to authenticated;
grant execute on function public.set_availability(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------- paid status for the ledger
-- The facts view runs with the viewer's permissions, and players can only see
-- their own charges, so teammates looked unpaid to them. This helper exposes
-- only whether a membership counted as paid on a date, never amounts.
-- Paid = active (not waiting for payment) and either no fee, no fee charged
-- (e.g. the founding organiser), or the fee paid in full by that date.
create function app_private.membership_paid_on(p_season uuid, p_member uuid, p_date date)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(sm.status <> 'pending_payment', false)
     and (
       s.membership_fee = 0
       or not exists (select 1 from public.charges c
                      where c.season_id = p_season and c.member_id = p_member
                        and c.kind = 'membership' and c.cancelled_at is null)
       or exists (
         select 1 from public.charges c
         where c.season_id = p_season and c.member_id = p_member
           and c.kind = 'membership' and c.cancelled_at is null
           and (select coalesce(sum(p.amount_eur), 0) from public.payments p
                where p.charge_id = c.id and p.paid_on <= p_date) >= c.amount)
     )
  from public.seasons s
  left join public.season_members sm on sm.season_id = s.id and sm.member_id = p_member
  where s.id = p_season
$$;
revoke all on function app_private.membership_paid_on(uuid, uuid, date) from public, anon;
grant execute on function app_private.membership_paid_on(uuid, uuid, date) to authenticated;

create or replace view public.v_fixture_facts with (security_invoker = true) as
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
left join public.selections sel on sel.fixture_id = pe.fixture_id and sel.member_id = pe.member_id
left join played pl on pl.fixture_id = pe.fixture_id and pl.member_id = pe.member_id
left join bowled bo on bo.fixture_id = pe.fixture_id and bo.member_id = pe.member_id
left join team_bowling tb on tb.fixture_id = pe.fixture_id;

-- Some tournaments let 12 or more players bat (CricHeroes squads of 13).
alter table public.batting drop constraint if exists batting_position_check;
alter table public.batting add constraint batting_position_check check (position between 1 and 15);
