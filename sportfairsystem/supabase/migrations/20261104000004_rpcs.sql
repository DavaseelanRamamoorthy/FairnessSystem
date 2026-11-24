-- Every multi-row write is one RPC = one transaction. Each checks the caller's
-- role itself; none is callable by anon.

-- Must stay identical to nameKey() in src/import/nameMatching.ts.
create function app_private.name_key(p_name text)
returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(
    regexp_replace(
      lower(regexp_replace(coalesce(p_name, ''), '\([^)]*\)', '', 'g')),
      '[^[:alnum:][:space:]]', '', 'g'),
    '\s+', ' ', 'g'))
$$;
grant execute on function app_private.name_key(text) to authenticated;

create function app_private.require(p_ok boolean, p_message text)
returns void language plpgsql set search_path = '' as $$
begin
  if not coalesce(p_ok, false) then
    raise exception '%', p_message using errcode = '42501';
  end if;
end $$;
grant execute on function app_private.require(boolean, text) to authenticated;

create function app_private.add_identity(
  p_team uuid, p_member uuid, p_source text, p_external text, p_display text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_key text := app_private.name_key(p_display);
  v_owner uuid;
begin
  if v_key = '' then
    return;
  end if;
  select member_id into v_owner from public.member_identities
  where team_id = p_team and source = p_source
    and (name_key = v_key or (p_external is not null and external_id = p_external))
  limit 1;
  if v_owner is not null and v_owner <> p_member then
    raise exception 'The % name "%" already belongs to another member', p_source, p_display;
  end if;
  insert into public.member_identities (team_id, member_id, source, external_id, display_name, name_key)
  values (p_team, p_member, p_source, nullif(p_external, ''), p_display, v_key)
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------- setup

-- First-run only: creates the team, the current season and makes the caller organiser.
create function public.bootstrap_team(
  p_team_name text, p_year int, p_starts_on date, p_ends_on date,
  p_membership_fee numeric, p_display_name text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid;
  v_season uuid;
  v_member uuid;
begin
  perform app_private.require((select auth.uid()) is not null, 'Sign in first');
  perform app_private.require(not exists (select 1 from public.teams), 'The team already exists');

  insert into public.teams (name) values (p_team_name) returning id into v_team;
  insert into public.seasons (team_id, year, starts_on, ends_on, membership_fee, is_current)
  values (v_team, p_year, p_starts_on, p_ends_on, p_membership_fee, true) returning id into v_season;
  insert into public.members (team_id, user_id, display_name)
  values (v_team, (select auth.uid()), p_display_name) returning id into v_member;
  insert into public.season_members (season_id, member_id, role, status)
  values (v_season, v_member, 'organiser', 'active');
  perform app_private.add_identity(v_team, v_member, 'app_account', (select auth.uid())::text, p_display_name);
  return v_team;
end $$;

-- Opens a new season; carries the previous closing balance forward.
create function public.create_season(
  p_team uuid, p_year int, p_starts_on date, p_ends_on date, p_membership_fee numeric, p_rules jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_prev uuid := app_private.current_season(p_team);
  v_season uuid;
  v_closing numeric;
  v_me uuid := app_private.my_member_id(p_team);
begin
  perform app_private.require(app_private.is_organiser(p_team), 'Only the organiser can start a season');

  select coalesce(sum(case when direction = 'income' then amount_eur else -amount_eur end), 0)
    into v_closing from public.transactions where season_id = v_prev;

  update public.seasons set is_current = false, registration_open = false,
    closed_at = coalesce(closed_at, now())
  where id = v_prev;

  insert into public.seasons (team_id, year, starts_on, ends_on, membership_fee, rules, is_current, registration_open)
  values (p_team, p_year, p_starts_on, p_ends_on, p_membership_fee, coalesce(p_rules, '{}'::jsonb), true, true)
  returning id into v_season;

  -- The organiser keeps access to run the new season.
  insert into public.season_members (season_id, member_id, role, status)
  values (v_season, v_me, 'organiser', 'active');

  if v_prev is not null then
    insert into public.transactions (season_id, txn_date, direction, category, amount_eur, notes, created_by)
    values (v_season, p_starts_on, case when v_closing >= 0 then 'income' else 'expense' end,
            'opening_balance', abs(v_closing), 'Carried forward from previous season', (select auth.uid()));
  end if;
  return v_season;
end $$;

-- ---------------------------------------------------------------- membership

create function public.submit_membership(
  p_season uuid, p_kind text, p_answers jsonb, p_existing_member uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform app_private.require((select auth.uid()) is not null, 'Sign in first');
  perform app_private.require(
    exists (select 1 from public.seasons where id = p_season and registration_open),
    'Registration is not open for this season');
  perform app_private.require(coalesce((p_answers ->> 'consent')::boolean, false),
    'You must accept the club terms and data notice');

  insert into public.membership_applications (season_id, user_id, existing_member_id, kind, answers, consent_at)
  values (p_season, (select auth.uid()), p_existing_member, p_kind, p_answers, now())
  on conflict (season_id, user_id) do update
    set answers = excluded.answers, kind = excluded.kind,
        existing_member_id = excluded.existing_member_id, status = 'applied', consent_at = now()
    where public.membership_applications.status in ('applied', 'withdrawn', 'rejected')
  returning id into v_id;

  perform app_private.require(v_id is not null, 'Your application was already approved');
  return v_id;
end $$;

-- p_identities: [{source, external_id, display_name}] confirmed by the organiser.
create function public.approve_membership(
  p_application uuid, p_member uuid default null, p_identities jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_app public.membership_applications;
  v_season public.seasons;
  v_member uuid;
  v_a jsonb;
  v_ident jsonb;
  v_gap jsonb;
  v_status text;
begin
  select * into v_app from public.membership_applications where id = p_application for update;
  perform app_private.require(v_app.id is not null, 'Application not found');
  select * into v_season from public.seasons where id = v_app.season_id;
  perform app_private.require(app_private.is_organiser(v_season.team_id), 'Only the organiser can approve members');
  perform app_private.require(v_app.status = 'applied', 'Application is not waiting for approval');
  v_a := v_app.answers;

  v_member := coalesce(p_member, v_app.existing_member_id);
  if v_member is null then
    insert into public.members (team_id, display_name)
    values (v_season.team_id, coalesce(v_a ->> 'display_name', v_a ->> 'full_name'))
    returning id into v_member;
  end if;

  perform app_private.require(
    exists (select 1 from public.members where id = v_member and team_id = v_season.team_id
            and (user_id is null or user_id = v_app.user_id) and merged_into is null),
    'That member is already linked to a different account');

  update public.members set
    user_id = v_app.user_id,
    display_name = coalesce(v_a ->> 'display_name', display_name),
    primary_roles = coalesce(array(select jsonb_array_elements_text(v_a -> 'primary_roles')), primary_roles),
    is_wicketkeeper = coalesce((v_a ->> 'is_wicketkeeper')::boolean, is_wicketkeeper),
    bowls = coalesce((v_a ->> 'bowls')::boolean, bowls),
    bat_hand = coalesce(v_a ->> 'bat_hand', bat_hand),
    bowl_hand = coalesce(v_a ->> 'bowl_hand', bowl_hand),
    bat_pref = coalesce(v_a ->> 'bat_pref', bat_pref),
    bowl_pref = coalesce(v_a ->> 'bowl_pref', bowl_pref)
  where id = v_member;

  insert into public.member_private (member_id, email, phone, whatsapp)
  values (v_member, v_a ->> 'email', v_a ->> 'phone', v_a ->> 'whatsapp')
  on conflict (member_id) do update
    set email = excluded.email, phone = excluded.phone, whatsapp = excluded.whatsapp;

  perform app_private.add_identity(v_season.team_id, v_member, 'app_account', v_app.user_id::text,
    coalesce(v_a ->> 'display_name', v_a ->> 'full_name'));
  for v_ident in select * from jsonb_array_elements(coalesce(p_identities, '[]'::jsonb)) loop
    perform app_private.add_identity(v_season.team_id, v_member, v_ident ->> 'source',
      v_ident ->> 'external_id', v_ident ->> 'display_name');
  end loop;

  for v_gap in select * from jsonb_array_elements(coalesce(v_a -> 'unavailability', '[]'::jsonb)) loop
    insert into public.unavailability (member_id, from_date, to_date, reason)
    values (v_member, (v_gap ->> 'from')::date, (v_gap ->> 'to')::date, v_gap ->> 'reason');
  end loop;

  v_status := case when v_season.membership_fee > 0 then 'pending_payment' else 'active' end;
  insert into public.season_members (season_id, member_id, responsibilities, status)
  values (v_season.id, v_member,
          coalesce(array(select jsonb_array_elements_text(v_a -> 'responsibilities_interest')
                         intersect select unnest(array['treasurer','kit_manager','ground_booking','scouting'])),
                   '{}'),
          v_status)
  on conflict (season_id, member_id) do update set status = excluded.status, left_on = null;

  if v_season.membership_fee > 0 then
    insert into public.charges (season_id, member_id, kind, ref_id, description, amount)
    values (v_season.id, v_member, 'membership', v_season.id,
            format('Membership %s', v_season.year), v_season.membership_fee);
  end if;

  update public.membership_applications
    set status = 'approved', decided_by = (select auth.uid()), decided_at = now(), existing_member_id = v_member
  where id = p_application;
  return v_member;
end $$;

create function public.reject_membership(p_application uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid;
begin
  select app_private.team_of_season(season_id) into v_team
  from public.membership_applications where id = p_application;
  perform app_private.require(app_private.is_organiser(v_team), 'Only the organiser can reject applications');
  update public.membership_applications
    set status = 'rejected', decision_note = p_note, decided_by = (select auth.uid()), decided_at = now()
  where id = p_application and status = 'applied';
end $$;

-- Organiser adds someone directly; they later claim the record with members.claim_token.
create function public.add_member(p_team uuid, p_display_name text, p_identities jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
  v_ident jsonb;
begin
  perform app_private.require(app_private.is_organiser(p_team), 'Only the organiser can add members');
  insert into public.members (team_id, display_name) values (p_team, p_display_name) returning id into v_member;
  for v_ident in select * from jsonb_array_elements(coalesce(p_identities, '[]'::jsonb)) loop
    perform app_private.add_identity(p_team, v_member, v_ident ->> 'source',
      v_ident ->> 'external_id', v_ident ->> 'display_name');
  end loop;
  return v_member;
end $$;

create function public.claim_member(p_token uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_member public.members;
begin
  perform app_private.require((select auth.uid()) is not null, 'Sign in first');
  select * into v_member from public.members where claim_token = p_token and merged_into is null for update;
  perform app_private.require(v_member.id is not null, 'This claim link is not valid');
  perform app_private.require(v_member.user_id is null, 'This profile is already claimed');
  update public.members set user_id = (select auth.uid()), claim_token = gen_random_uuid()
  where id = v_member.id;
  perform app_private.add_identity(v_member.team_id, v_member.id, 'app_account',
    (select auth.uid())::text, v_member.display_name);
  return v_member.id;
end $$;

create function public.set_member_role(p_season_member uuid, p_role text, p_responsibilities text[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_row public.season_members;
  v_team uuid;
begin
  select * into v_row from public.season_members where id = p_season_member for update;
  v_team := app_private.team_of_season(v_row.season_id);
  perform app_private.require(app_private.is_organiser(v_team), 'Only the organiser can assign roles');
  if v_row.role = 'organiser' and p_role <> 'organiser' then
    perform app_private.require(
      exists (select 1 from public.season_members
              where season_id = v_row.season_id and role = 'organiser' and status <> 'left' and id <> v_row.id),
      'The team must keep at least one organiser');
  end if;
  update public.season_members
    set role = p_role, responsibilities = coalesce(p_responsibilities, '{}')
  where id = p_season_member;
end $$;

create function public.update_my_profile(p_team uuid, p_profile jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid := app_private.my_member_id(p_team);
begin
  perform app_private.require(v_member is not null, 'You are not a member of this team');
  update public.members set
    display_name = coalesce(p_profile ->> 'display_name', display_name),
    primary_roles = coalesce(array(select jsonb_array_elements_text(p_profile -> 'primary_roles')), primary_roles),
    is_wicketkeeper = coalesce((p_profile ->> 'is_wicketkeeper')::boolean, is_wicketkeeper),
    bowls = coalesce((p_profile ->> 'bowls')::boolean, bowls),
    bat_hand = coalesce(p_profile ->> 'bat_hand', bat_hand),
    bowl_hand = coalesce(p_profile ->> 'bowl_hand', bowl_hand),
    bat_pref = coalesce(p_profile ->> 'bat_pref', bat_pref),
    bowl_pref = coalesce(p_profile ->> 'bowl_pref', bowl_pref)
  where id = v_member;
  if p_profile ? 'phone' or p_profile ? 'email' or p_profile ? 'whatsapp' then
    insert into public.member_private (member_id, email, phone, whatsapp)
    values (v_member, p_profile ->> 'email', p_profile ->> 'phone', p_profile ->> 'whatsapp')
    on conflict (member_id) do update set
      email = coalesce(excluded.email, public.member_private.email),
      phone = coalesce(excluded.phone, public.member_private.phone),
      whatsapp = coalesce(excluded.whatsapp, public.member_private.whatsapp);
  end if;
end $$;

-- Self or organiser. History stays; owed credit stops from left_on.
create function public.leave_team(p_member uuid, p_left_on date default current_date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid := app_private.team_of_member(p_member);
begin
  perform app_private.require(
    p_member = app_private.my_member_id(v_team) or app_private.is_organiser(v_team),
    'You can only leave for yourself');
  update public.season_members set status = 'left', left_on = p_left_on
  where member_id = p_member and season_id = app_private.current_season(v_team) and status <> 'left';
end $$;

-- ---------------------------------------------------------------- identities

create function public.link_identity(p_member uuid, p_source text, p_external_id text, p_display_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid := app_private.team_of_member(p_member);
begin
  perform app_private.require(app_private.can_manage_matches(v_team), 'Not allowed to link names');
  perform app_private.add_identity(v_team, p_member, p_source, p_external_id, p_display_name);
end $$;

create function public.unlink_identity(p_identity uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid;
begin
  select team_id into v_team from public.member_identities where id = p_identity;
  perform app_private.require(app_private.is_organiser(v_team), 'Only the organiser can unlink names');
  delete from public.member_identities where id = p_identity and source <> 'app_account';
end $$;

-- Moves everything from p_drop onto p_keep. Nothing is deleted.
create function public.merge_members(p_keep uuid, p_drop uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid := app_private.team_of_member(p_keep);
  v_drop_user uuid;
begin
  perform app_private.require(app_private.is_organiser(v_team), 'Only the organiser can merge members');
  perform app_private.require(p_keep <> p_drop and app_private.team_of_member(p_drop) = v_team,
    'Pick two different members of this team');
  perform app_private.require(
    (select count(user_id) from public.members where id in (p_keep, p_drop)) <= 1,
    'Both members have app accounts; unlink one first');

  select user_id into v_drop_user from public.members where id = p_drop;
  update public.members set user_id = null, merged_into = p_keep where id = p_drop;
  update public.members set user_id = coalesce(user_id, v_drop_user) where id = p_keep;

  update public.member_identities set member_id = p_keep where member_id = p_drop;
  update public.batting set member_id = p_keep where member_id = p_drop;
  update public.bowling set member_id = p_keep where member_id = p_drop;
  update public.charges set member_id = p_keep where member_id = p_drop;
  update public.payments set member_id = p_keep where member_id = p_drop;
  update public.payments set received_by_member_id = p_keep where received_by_member_id = p_drop;
  update public.unavailability set member_id = p_keep where member_id = p_drop;
  update public.kit_orders set member_id = p_keep where member_id = p_drop;
  update public.inventory_items set bought_by_member_id = p_keep where bought_by_member_id = p_drop;
  update public.inventory_items set held_by_member_id = p_keep where held_by_member_id = p_drop;
  update public.transactions set held_by_member_id = p_keep where held_by_member_id = p_drop;

  -- Rows keyed by (x, member): keep the existing one for p_keep, move the rest.
  update public.availability a set member_id = p_keep where member_id = p_drop
    and not exists (select 1 from public.availability b where b.fixture_id = a.fixture_id and b.member_id = p_keep);
  update public.selections a set member_id = p_keep where member_id = p_drop
    and not exists (select 1 from public.selections b where b.fixture_id = a.fixture_id and b.member_id = p_keep);
  update public.season_members a set member_id = p_keep where member_id = p_drop
    and not exists (select 1 from public.season_members b where b.season_id = a.season_id and b.member_id = p_keep);
  update public.competition_squad a set member_id = p_keep where member_id = p_drop
    and not exists (select 1 from public.competition_squad b
                    where b.competition_id = a.competition_id and b.member_id = p_keep);
  update public.jersey_numbers set member_id = p_keep where member_id = p_drop;
end $$;

-- ---------------------------------------------------------------- money

create function public.record_payment(
  p_charge uuid, p_amount numeric, p_currency text, p_amount_eur numeric, p_method text,
  p_reference text, p_paid_on date, p_received_by uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_charge public.charges;
  v_team uuid;
  v_txn uuid;
  v_payment uuid;
  v_paid numeric;
begin
  select * into v_charge from public.charges where id = p_charge for update;
  perform app_private.require(v_charge.id is not null and v_charge.cancelled_at is null, 'Charge not found');
  v_team := app_private.team_of_season(v_charge.season_id);
  perform app_private.require(app_private.can_manage_money(v_team), 'Only the treasurer can record payments');

  insert into public.transactions (season_id, txn_date, direction, category, amount_eur, counterparty,
                                   held_by_member_id, notes, created_by)
  values (v_charge.season_id, p_paid_on, 'income',
          case v_charge.kind when 'membership' then 'membership' when 'tournament_fee' then 'tournament'
                             when 'jersey' then 'kit' else 'other' end,
          p_amount_eur, (select display_name from public.members where id = v_charge.member_id),
          p_received_by, v_charge.description, (select auth.uid()))
  returning id into v_txn;

  insert into public.payments (charge_id, member_id, amount, currency, amount_eur, method, reference,
                               received_by_member_id, paid_on, transaction_id)
  values (p_charge, v_charge.member_id, p_amount, p_currency, p_amount_eur, p_method, p_reference,
          p_received_by, p_paid_on, v_txn)
  returning id into v_payment;

  -- Paid in full (in the charge currency) activates a pending membership.
  select coalesce(sum(case when currency = v_charge.currency then amount else amount_eur end), 0)
    into v_paid from public.payments where charge_id = p_charge;
  if v_charge.kind = 'membership' and v_paid >= v_charge.amount then
    update public.season_members set status = 'active'
    where season_id = v_charge.season_id and member_id = v_charge.member_id and status = 'pending_payment';
  end if;
  return v_payment;
end $$;

-- Splits a tournament entry fee across everyone opted in.
create function public.create_tournament_charges(p_competition uuid, p_amount_per_head numeric)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_comp public.competitions;
  v_team uuid;
  v_count int;
begin
  select * into v_comp from public.competitions where id = p_competition;
  v_team := app_private.team_of_season(v_comp.season_id);
  perform app_private.require(app_private.can_manage_money(v_team), 'Only the treasurer can create fees');
  insert into public.charges (season_id, member_id, kind, ref_id, description, amount)
  select v_comp.season_id, cs.member_id, 'tournament_fee', v_comp.id, format('%s entry', v_comp.name), p_amount_per_head
  from public.competition_squad cs
  where cs.competition_id = p_competition and cs.opted_in
    and not exists (select 1 from public.charges c
                    where c.ref_id = v_comp.id and c.member_id = cs.member_id and c.cancelled_at is null);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------- kit

create function public.place_kit_order(
  p_jersey_name text, p_jersey_number int, p_shirt_size text, p_sleeve text, p_pant_size text,
  p_cap boolean, p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid := (select id from public.teams limit 1);
  v_member uuid := app_private.my_member_id(v_team);
  v_owner uuid;
  v_id uuid;
begin
  perform app_private.require(app_private.is_member(v_team), 'Only team members can order kit');
  select member_id into v_owner from public.jersey_numbers where team_id = v_team and jersey_number = p_jersey_number;
  perform app_private.require(v_owner is null or v_owner = v_member,
    format('Jersey number %s is already taken', p_jersey_number));
  insert into public.jersey_numbers (team_id, jersey_number, member_id)
  values (v_team, p_jersey_number, v_member) on conflict do nothing;
  insert into public.kit_orders (season_id, team_id, member_id, jersey_name, jersey_number, shirt_size,
                                 sleeve, pant_size, cap, notes)
  values (app_private.current_season(v_team), v_team, v_member, p_jersey_name, p_jersey_number, p_shirt_size,
          p_sleeve, p_pant_size, p_cap, p_notes)
  returning id into v_id;
  return v_id;
end $$;

create function public.price_kit_order(p_order uuid, p_amount numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_order public.kit_orders;
  v_charge uuid;
begin
  select * into v_order from public.kit_orders where id = p_order for update;
  perform app_private.require(app_private.can_manage_kit(v_order.team_id), 'Only the kit manager can price orders');
  perform app_private.require(v_order.charge_id is null, 'This order already has a charge');
  insert into public.charges (season_id, member_id, kind, ref_id, description, amount)
  values (v_order.season_id, v_order.member_id, 'jersey', v_order.id,
          format('Jersey #%s %s', v_order.jersey_number, v_order.jersey_name), p_amount)
  returning id into v_charge;
  update public.kit_orders set charge_id = v_charge, status = 'ordered' where id = p_order;
  return v_charge;
end $$;

-- ---------------------------------------------------------------- fixtures

-- p_entries: [{member_id, answer}] already resolved through member_identities.
-- The first snapshot (fixture still open) is on time; anything later is late.
create function public.import_availability_snapshot(
  p_fixture uuid, p_entries jsonb, p_source text, p_payload jsonb
) returns int language plpgsql security definer set search_path = '' as $$
declare
  v_fixture public.fixtures;
  v_team uuid := app_private.team_of_fixture(p_fixture);
  v_on_time boolean;
  v_count int;
begin
  perform app_private.require(app_private.can_manage_matches(v_team), 'Only captains can import availability');
  select * into v_fixture from public.fixtures where id = p_fixture for update;
  perform app_private.require(v_fixture.status in ('open', 'locked', 'selected'), 'This fixture is already played');
  v_on_time := v_fixture.status = 'open';

  insert into public.availability (fixture_id, member_id, answer, on_time, source)
  select p_fixture, (e ->> 'member_id')::uuid, e ->> 'answer', v_on_time, p_source
  from jsonb_array_elements(p_entries) e
  on conflict (fixture_id, member_id) do update
    set answer = excluded.answer,
        -- a late change to "yes" does not inherit on-time status from an earlier "no"
        on_time = public.availability.on_time and (public.availability.answer = 'yes' or excluded.answer <> 'yes'),
        captured_at = now(),
        source = excluded.source;
  get diagnostics v_count = row_count;

  update public.fixtures set status = case when status = 'open' then 'locked' else status end
  where id = p_fixture;
  insert into public.import_runs (fixture_id, kind, source, payload, imported_by)
  values (p_fixture, 'availability', p_source, coalesce(p_payload, p_entries), (select auth.uid()));
  return v_count;
end $$;

-- p_picks: [{member_id, slot, planned_bat_pos, planned_overs, reason, overridden, override_note}]
create function public.save_selection(p_fixture uuid, p_picks jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid := app_private.team_of_fixture(p_fixture);
begin
  perform app_private.require(app_private.can_manage_matches(v_team), 'Only captains can pick the team');
  perform app_private.require(
    (select count(*) from jsonb_array_elements(p_picks) e where e ->> 'slot' = 'xi') <= 11,
    'An XI cannot have more than 11 players');
  delete from public.selections where fixture_id = p_fixture;
  insert into public.selections (fixture_id, member_id, slot, planned_bat_pos, planned_overs, reason,
                                 overridden, override_note)
  select p_fixture, (e ->> 'member_id')::uuid, e ->> 'slot', (e ->> 'planned_bat_pos')::int,
         (e ->> 'planned_overs')::int, e ->> 'reason', coalesce((e ->> 'overridden')::boolean, false),
         e ->> 'override_note'
  from jsonb_array_elements(p_picks) e;
end $$;

create function public.publish_selection(p_fixture uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid := app_private.team_of_fixture(p_fixture);
begin
  perform app_private.require(app_private.can_manage_matches(v_team), 'Only captains can publish the team');
  perform app_private.require(exists (select 1 from public.selections where fixture_id = p_fixture),
    'Save a selection first');
  update public.selections set published_at = now() where fixture_id = p_fixture;
  update public.fixtures set status = 'selected' where id = p_fixture and status in ('open', 'locked');
end $$;

-- p_payload follows src/import/scorecardSchema.ts with member_id already resolved.
-- Replaces any earlier scorecard for the fixture in one transaction.
create function public.import_scorecard(p_fixture uuid, p_payload jsonb, p_source text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid := app_private.team_of_fixture(p_fixture);
  v_inn jsonb;
  v_row jsonb;
  v_innings uuid;
  v_ident jsonb;
begin
  perform app_private.require(app_private.can_manage_matches(v_team), 'Only captains can import scorecards');
  perform app_private.require(
    p_payload ->> 'cricheroes_match_ref' is null
    or not exists (select 1 from public.fixtures
                   where cricheroes_match_ref = p_payload ->> 'cricheroes_match_ref' and id <> p_fixture),
    'This CricHeroes match is already imported for another fixture');

  delete from public.innings where fixture_id = p_fixture;

  for v_inn in select * from jsonb_array_elements(p_payload -> 'innings') loop
    insert into public.innings (fixture_id, innings_no, ours, team_name, runs, wickets, balls, extras)
    values (p_fixture, (v_inn ->> 'innings_no')::int, (v_inn ->> 'ours')::boolean, v_inn ->> 'team_name',
            (v_inn ->> 'runs')::int, (v_inn ->> 'wickets')::int, (v_inn ->> 'balls')::int,
            coalesce((v_inn ->> 'extras')::int, 0))
    returning id into v_innings;

    for v_row in select * from jsonb_array_elements(coalesce(v_inn -> 'batting', '[]'::jsonb)) loop
      insert into public.batting (innings_id, member_id, name_raw, position, runs, balls, fours, sixes,
                                  how_out, not_out, did_bat)
      values (v_innings, (v_row ->> 'member_id')::uuid, v_row ->> 'name', (v_row ->> 'position')::int,
              coalesce((v_row ->> 'runs')::int, 0), coalesce((v_row ->> 'balls')::int, 0),
              coalesce((v_row ->> 'fours')::int, 0), coalesce((v_row ->> 'sixes')::int, 0),
              v_row ->> 'how_out', coalesce((v_row ->> 'not_out')::boolean, false),
              coalesce((v_row ->> 'did_bat')::boolean, true));
    end loop;

    for v_row in select * from jsonb_array_elements(coalesce(v_inn -> 'bowling', '[]'::jsonb)) loop
      insert into public.bowling (innings_id, member_id, name_raw, balls, maidens, runs, wickets, wides, no_balls)
      values (v_innings, (v_row ->> 'member_id')::uuid, v_row ->> 'name', (v_row ->> 'balls')::int,
              coalesce((v_row ->> 'maidens')::int, 0), coalesce((v_row ->> 'runs')::int, 0),
              coalesce((v_row ->> 'wickets')::int, 0), coalesce((v_row ->> 'wides')::int, 0),
              coalesce((v_row ->> 'no_balls')::int, 0));
    end loop;
  end loop;

  for v_ident in select * from jsonb_array_elements(coalesce(p_payload -> 'new_identities', '[]'::jsonb)) loop
    perform app_private.add_identity(v_team, (v_ident ->> 'member_id')::uuid, v_ident ->> 'source',
      v_ident ->> 'external_id', v_ident ->> 'display_name');
  end loop;

  update public.fixtures set
    status = 'played',
    result = p_payload ->> 'result',
    result_summary = p_payload ->> 'result_summary',
    cricheroes_match_ref = coalesce(p_payload ->> 'cricheroes_match_ref', cricheroes_match_ref)
  where id = p_fixture;

  insert into public.import_runs (fixture_id, kind, source, payload, imported_by)
  values (p_fixture, 'scorecard', p_source, p_payload, (select auth.uid()));
end $$;

-- ---------------------------------------------------------------- grants

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end $$;

revoke all on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated;
