-- Access helpers live in `app_private`, which PostgREST does not expose, so
-- none of them can be called over /rest/v1/rpc. Every helper is SECURITY
-- DEFINER with an empty search_path (fixes the old advisor warnings).

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

-- ---------------------------------------------------------------- team lookups

create function app_private.current_season(p_team uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.id from public.seasons s where s.team_id = p_team and s.is_current
$$;

create function app_private.team_of_season(p_season uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.team_id from public.seasons s where s.id = p_season
$$;

create function app_private.team_of_competition(p_competition uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.team_id from public.competitions c join public.seasons s on s.id = c.season_id
  where c.id = p_competition
$$;

create function app_private.team_of_fixture(p_fixture uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.team_id
  from public.fixtures f
  join public.competitions c on c.id = f.competition_id
  join public.seasons s on s.id = c.season_id
  where f.id = p_fixture
$$;

create function app_private.team_of_innings(p_innings uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select app_private.team_of_fixture(i.fixture_id) from public.innings i where i.id = p_innings
$$;

create function app_private.team_of_member(p_member uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.team_id from public.members m where m.id = p_member
$$;

-- ---------------------------------------------------------------- who am I

create function app_private.my_member_id(p_team uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.id from public.members m
  where m.team_id = p_team and m.user_id = (select auth.uid()) and m.merged_into is null
$$;

create function app_private.my_season_row(p_team uuid)
returns public.season_members language sql stable security definer set search_path = '' as $$
  select sm.*
  from public.season_members sm
  where sm.season_id = app_private.current_season(p_team)
    and sm.member_id = app_private.my_member_id(p_team)
    and sm.status <> 'left'
$$;

create function app_private.is_member(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (app_private.my_season_row(p_team)).id is not null
$$;

create function app_private.has_role(p_team uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((app_private.my_season_row(p_team)).role = any (p_roles), false)
$$;

create function app_private.is_organiser(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.has_role(p_team, array['organiser'])
$$;

create function app_private.can_manage_matches(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.has_role(p_team, array['organiser', 'captain', 'vice_captain'])
$$;

create function app_private.has_responsibility(p_team uuid, p_resp text)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_organiser(p_team)
      or coalesce(p_resp = any ((app_private.my_season_row(p_team)).responsibilities), false)
$$;

create function app_private.can_manage_money(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.has_responsibility(p_team, 'treasurer')
$$;

create function app_private.can_manage_kit(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.has_responsibility(p_team, 'kit_manager')
$$;

revoke all on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated;

-- ---------------------------------------------------------------- audit + timestamps

create function app_private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_team uuid;
begin
  v_team := coalesce(
    (v_row ->> 'team_id')::uuid,
    app_private.team_of_season((v_row ->> 'season_id')::uuid),
    app_private.team_of_member((v_row ->> 'member_id')::uuid)
  );
  insert into public.audit_log (team_id, actor, action, target_table, target_id, before, after)
  values (
    v_team,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'member_id'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger audit_season_members after insert or update or delete on public.season_members
  for each row execute function app_private.audit_row();
create trigger audit_payments after insert or update or delete on public.payments
  for each row execute function app_private.audit_row();
create trigger audit_charges after insert or update or delete on public.charges
  for each row execute function app_private.audit_row();
create trigger audit_transactions after insert or update or delete on public.transactions
  for each row execute function app_private.audit_row();
create trigger audit_member_identities after insert or update or delete on public.member_identities
  for each row execute function app_private.audit_row();
create trigger audit_members after update or delete on public.members
  for each row execute function app_private.audit_row();

create function app_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger members_touch before update on public.members
  for each row execute function app_private.touch_updated_at();
create trigger member_private_touch before update on public.member_private
  for each row execute function app_private.touch_updated_at();
create trigger inventory_touch before update on public.inventory_items
  for each row execute function app_private.touch_updated_at();

-- ---------------------------------------------------------------- grants

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.audit_log from authenticated;

-- ---------------------------------------------------------------- row-level security

alter table public.teams enable row level security;
alter table public.seasons enable row level security;
alter table public.members enable row level security;
alter table public.member_private enable row level security;
alter table public.member_identities enable row level security;
alter table public.season_members enable row level security;
alter table public.membership_applications enable row level security;
alter table public.unavailability enable row level security;
alter table public.audit_log enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_squad enable row level security;
alter table public.fixtures enable row level security;
alter table public.availability enable row level security;
alter table public.selections enable row level security;
alter table public.innings enable row level security;
alter table public.batting enable row level security;
alter table public.bowling enable row level security;
alter table public.import_runs enable row level security;
alter table public.charges enable row level security;
alter table public.transactions enable row level security;
alter table public.payments enable row level security;
alter table public.jersey_numbers enable row level security;
alter table public.kit_orders enable row level security;
alter table public.inventory_items enable row level security;

-- teams / seasons: any signed-in user can see open registration; members see all.
create policy teams_select on public.teams for select to authenticated
  using (true);
create policy teams_update on public.teams for update to authenticated
  using (app_private.is_organiser(id)) with check (app_private.is_organiser(id));

create policy seasons_select on public.seasons for select to authenticated
  using (registration_open or app_private.is_member(team_id));
create policy seasons_write on public.seasons for all to authenticated
  using (app_private.is_organiser(team_id)) with check (app_private.is_organiser(team_id));

-- members: team can read; organiser writes (players edit themselves via RPC).
create policy members_select on public.members for select to authenticated
  using (app_private.is_member(team_id) or user_id = (select auth.uid()));
create policy members_write on public.members for all to authenticated
  using (app_private.is_organiser(team_id)) with check (app_private.is_organiser(team_id));

-- contact data: self, organiser, captain/vice-captain (matchday phone calls).
create policy member_private_select on public.member_private for select to authenticated
  using (
    member_id = app_private.my_member_id(app_private.team_of_member(member_id))
    or app_private.can_manage_matches(app_private.team_of_member(member_id))
  );
create policy member_private_write on public.member_private for all to authenticated
  using (app_private.is_organiser(app_private.team_of_member(member_id)))
  with check (app_private.is_organiser(app_private.team_of_member(member_id)));

create policy member_identities_select on public.member_identities for select to authenticated
  using (app_private.is_member(team_id));
create policy member_identities_write on public.member_identities for all to authenticated
  using (app_private.can_manage_matches(team_id)) with check (app_private.can_manage_matches(team_id));

create policy season_members_select on public.season_members for select to authenticated
  using (
    app_private.is_member(app_private.team_of_season(season_id))
    or member_id = app_private.my_member_id(app_private.team_of_season(season_id))
  );
-- writes only through set_member_role / approve_membership / record_payment RPCs

create policy applications_select on public.membership_applications for select to authenticated
  using (user_id = (select auth.uid()) or app_private.is_organiser(app_private.team_of_season(season_id)));
-- writes only through submit_membership / approve_membership RPCs

create policy unavailability_select on public.unavailability for select to authenticated
  using (app_private.is_member(app_private.team_of_member(member_id)));
create policy unavailability_write on public.unavailability for all to authenticated
  using (
    member_id = app_private.my_member_id(app_private.team_of_member(member_id))
    or app_private.can_manage_matches(app_private.team_of_member(member_id))
  )
  with check (
    member_id = app_private.my_member_id(app_private.team_of_member(member_id))
    or app_private.can_manage_matches(app_private.team_of_member(member_id))
  );

create policy audit_log_select on public.audit_log for select to authenticated
  using (app_private.is_organiser(team_id));

-- cricket
create policy competitions_select on public.competitions for select to authenticated
  using (app_private.is_member(app_private.team_of_season(season_id)));
create policy competitions_write on public.competitions for all to authenticated
  using (app_private.can_manage_matches(app_private.team_of_season(season_id)))
  with check (app_private.can_manage_matches(app_private.team_of_season(season_id)));

create policy competition_squad_select on public.competition_squad for select to authenticated
  using (app_private.is_member(app_private.team_of_competition(competition_id)));
create policy competition_squad_write on public.competition_squad for all to authenticated
  using (
    member_id = app_private.my_member_id(app_private.team_of_competition(competition_id))
    or app_private.can_manage_matches(app_private.team_of_competition(competition_id))
  )
  with check (
    member_id = app_private.my_member_id(app_private.team_of_competition(competition_id))
    or app_private.can_manage_matches(app_private.team_of_competition(competition_id))
  );

create policy fixtures_select on public.fixtures for select to authenticated
  using (app_private.is_member(app_private.team_of_competition(competition_id)));
create policy fixtures_write on public.fixtures for all to authenticated
  using (app_private.can_manage_matches(app_private.team_of_competition(competition_id)))
  with check (app_private.can_manage_matches(app_private.team_of_competition(competition_id)));

create policy availability_select on public.availability for select to authenticated
  using (app_private.is_member(app_private.team_of_fixture(fixture_id)));
create policy availability_write on public.availability for all to authenticated
  using (app_private.can_manage_matches(app_private.team_of_fixture(fixture_id)))
  with check (app_private.can_manage_matches(app_private.team_of_fixture(fixture_id)));

-- players only see a selection once it is published
create policy selections_select on public.selections for select to authenticated
  using (
    (published_at is not null and app_private.is_member(app_private.team_of_fixture(fixture_id)))
    or app_private.can_manage_matches(app_private.team_of_fixture(fixture_id))
  );
create policy selections_write on public.selections for all to authenticated
  using (app_private.can_manage_matches(app_private.team_of_fixture(fixture_id)))
  with check (app_private.can_manage_matches(app_private.team_of_fixture(fixture_id)));

create policy innings_select on public.innings for select to authenticated
  using (app_private.is_member(app_private.team_of_fixture(fixture_id)));
create policy innings_write on public.innings for all to authenticated
  using (app_private.can_manage_matches(app_private.team_of_fixture(fixture_id)))
  with check (app_private.can_manage_matches(app_private.team_of_fixture(fixture_id)));

create policy batting_select on public.batting for select to authenticated
  using (app_private.is_member(app_private.team_of_innings(innings_id)));
create policy batting_write on public.batting for all to authenticated
  using (app_private.can_manage_matches(app_private.team_of_innings(innings_id)))
  with check (app_private.can_manage_matches(app_private.team_of_innings(innings_id)));

create policy bowling_select on public.bowling for select to authenticated
  using (app_private.is_member(app_private.team_of_innings(innings_id)));
create policy bowling_write on public.bowling for all to authenticated
  using (app_private.can_manage_matches(app_private.team_of_innings(innings_id)))
  with check (app_private.can_manage_matches(app_private.team_of_innings(innings_id)));

create policy import_runs_select on public.import_runs for select to authenticated
  using (app_private.can_manage_matches(app_private.team_of_fixture(fixture_id)));

-- money: treasurer/organiser manage; members see only their own dues
create policy charges_select on public.charges for select to authenticated
  using (
    member_id = app_private.my_member_id(app_private.team_of_season(season_id))
    or app_private.can_manage_money(app_private.team_of_season(season_id))
  );
create policy charges_write on public.charges for all to authenticated
  using (app_private.can_manage_money(app_private.team_of_season(season_id)))
  with check (app_private.can_manage_money(app_private.team_of_season(season_id)));

create policy payments_select on public.payments for select to authenticated
  using (
    member_id = app_private.my_member_id(app_private.team_of_member(member_id))
    or app_private.can_manage_money(app_private.team_of_member(member_id))
  );
-- payment writes only through record_payment RPC

create policy transactions_select on public.transactions for select to authenticated
  using (app_private.can_manage_money(app_private.team_of_season(season_id)));
create policy transactions_write on public.transactions for all to authenticated
  using (app_private.can_manage_money(app_private.team_of_season(season_id)))
  with check (app_private.can_manage_money(app_private.team_of_season(season_id)));

-- kit & inventory: everyone sees jersey numbers and stock; managers write
create policy jersey_numbers_select on public.jersey_numbers for select to authenticated
  using (app_private.is_member(team_id));
create policy jersey_numbers_write on public.jersey_numbers for all to authenticated
  using (app_private.can_manage_kit(team_id)) with check (app_private.can_manage_kit(team_id));

create policy kit_orders_select on public.kit_orders for select to authenticated
  using (app_private.is_member(team_id));
create policy kit_orders_write on public.kit_orders for all to authenticated
  using (app_private.can_manage_kit(team_id)) with check (app_private.can_manage_kit(team_id));
-- players place orders through place_kit_order RPC

create policy inventory_select on public.inventory_items for select to authenticated
  using (app_private.is_member(app_private.team_of_season(season_id)));
create policy inventory_write on public.inventory_items for all to authenticated
  using (app_private.can_manage_kit(app_private.team_of_season(season_id)))
  with check (app_private.can_manage_kit(app_private.team_of_season(season_id)));
