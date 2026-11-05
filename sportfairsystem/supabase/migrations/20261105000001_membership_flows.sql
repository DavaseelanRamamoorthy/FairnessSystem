-- Fixes and additions found while building the membership screens.

-- A claim token lets someone take over an unclaimed profile, so team members
-- must not be able to read it. Only the organiser gets it, through an RPC.
revoke select on public.members from authenticated;
grant select (
  id, team_id, user_id, display_name, primary_roles, is_wicketkeeper, bowls,
  bat_hand, bowl_hand, bowl_style, bat_pref, bowl_pref, merged_into,
  anonymised_at, created_at, updated_at
) on public.members to authenticated;

create function public.member_claim_token(p_member uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_member public.members;
begin
  select * into v_member from public.members where id = p_member;
  perform app_private.require(app_private.is_organiser(v_member.team_id), 'Only the organiser can create claim links');
  perform app_private.require(v_member.user_id is null, 'This profile already has an account');
  return v_member.claim_token;
end $$;

-- What a player says they paid, so the treasurer can match it to the bank/PayPal.
alter table public.charges add column payer_reference text;

create function public.submit_payment_reference(p_charge uuid, p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_charge public.charges;
begin
  select * into v_charge from public.charges where id = p_charge;
  perform app_private.require(
    v_charge.id is not null
    and v_charge.member_id = app_private.my_member_id(app_private.team_of_season(v_charge.season_id)),
    'You can only add a reference to your own dues');
  update public.charges set payer_reference = nullif(btrim(p_reference), '') where id = p_charge;
end $$;

drop view public.v_tournament_costs;
drop view public.v_member_dues;

create view public.v_member_dues with (security_invoker = true) as
select c.season_id, c.member_id, c.id as charge_id, c.kind, c.description, c.amount, c.currency, c.due_on,
       coalesce(sum(case when p.currency = c.currency then p.amount else p.amount_eur end), 0) as paid,
       c.amount - coalesce(sum(case when p.currency = c.currency then p.amount else p.amount_eur end), 0) as outstanding,
       c.payer_reference
from public.charges c
left join public.payments p on p.charge_id = c.id
where c.cancelled_at is null
group by c.id;

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

grant select on public.v_member_dues, public.v_tournament_costs to authenticated;
revoke all on public.v_member_dues, public.v_tournament_costs from anon;

-- array(select ...) is an empty array, never null, so the earlier versions wiped
-- primary_roles whenever the key was missing. Applicants also got every
-- responsibility they ticked, which handed out treasurer access by application;
-- ticking one is now only an expression of interest.
create or replace function public.approve_membership(
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
    primary_roles = case when v_a ? 'primary_roles'
      then array(select jsonb_array_elements_text(v_a -> 'primary_roles')) else primary_roles end,
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
    set email = coalesce(excluded.email, public.member_private.email),
        phone = coalesce(excluded.phone, public.member_private.phone),
        whatsapp = coalesce(excluded.whatsapp, public.member_private.whatsapp);

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
  insert into public.season_members (season_id, member_id, status)
  values (v_season.id, v_member, v_status)
  on conflict (season_id, member_id) do update set status = excluded.status, left_on = null;

  if v_season.membership_fee > 0 then
    insert into public.charges (season_id, member_id, kind, ref_id, description, amount, payer_reference)
    values (v_season.id, v_member, 'membership', v_season.id,
            format('Membership %s', v_season.year), v_season.membership_fee,
            nullif(btrim(v_a ->> 'payment_reference'), ''));
  end if;

  update public.membership_applications
    set status = 'approved', decided_by = (select auth.uid()), decided_at = now(), existing_member_id = v_member
  where id = p_application;
  return v_member;
end $$;

create or replace function public.update_my_profile(p_team uuid, p_profile jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid := app_private.my_member_id(p_team);
begin
  perform app_private.require(v_member is not null, 'You are not a member of this team');
  update public.members set
    display_name = coalesce(nullif(btrim(p_profile ->> 'display_name'), ''), display_name),
    primary_roles = case when p_profile ? 'primary_roles'
      then array(select jsonb_array_elements_text(p_profile -> 'primary_roles')) else primary_roles end,
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

-- Players update their own contact details through update_my_profile, and read
-- them back; the select policy already covers self.

create or replace function public.leave_team(p_member uuid, p_left_on date default current_date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid := app_private.team_of_member(p_member);
  v_season uuid := app_private.current_season(v_team);
begin
  perform app_private.require(
    p_member = app_private.my_member_id(v_team) or app_private.is_organiser(v_team),
    'You can only leave for yourself');
  perform app_private.require(
    not exists (select 1 from public.season_members
                where season_id = v_season and member_id = p_member and role = 'organiser' and status <> 'left')
    or exists (select 1 from public.season_members
               where season_id = v_season and role = 'organiser' and status <> 'left' and member_id <> p_member),
    'The team must keep at least one organiser');
  update public.season_members set status = 'left', left_on = greatest(p_left_on, joined_on)
  where member_id = p_member and season_id = v_season and status <> 'left';
end $$;

-- Adds a member to the current season, or brings back someone who left.
-- Dues decide the status: a paid (or free) membership is active straight away.
create function public.add_to_season(p_member uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid := app_private.team_of_member(p_member);
  v_season public.seasons;
  v_outstanding numeric;
  v_status text;
begin
  perform app_private.require(app_private.is_organiser(v_team), 'Only the organiser can add members to the season');
  select * into v_season from public.seasons where id = app_private.current_season(v_team);
  perform app_private.require(v_season.id is not null, 'There is no current season');

  if v_season.membership_fee > 0 and not exists (
    select 1 from public.charges
    where season_id = v_season.id and member_id = p_member and kind = 'membership' and cancelled_at is null
  ) then
    insert into public.charges (season_id, member_id, kind, ref_id, description, amount)
    values (v_season.id, p_member, 'membership', v_season.id,
            format('Membership %s', v_season.year), v_season.membership_fee);
  end if;

  select coalesce(sum(d.outstanding), 0) into v_outstanding from public.v_member_dues d
  where d.season_id = v_season.id and d.member_id = p_member and d.kind = 'membership';
  v_status := case when v_outstanding > 0 then 'pending_payment' else 'active' end;

  insert into public.season_members (season_id, member_id, status)
  values (v_season.id, p_member, v_status)
  on conflict (season_id, member_id) do update set status = excluded.status, left_on = null;
  return v_status;
end $$;

revoke all on function public.member_claim_token(uuid) from public, anon;
revoke all on function public.submit_payment_reference(uuid, text) from public, anon;
revoke all on function public.add_to_season(uuid) from public, anon;
revoke all on function public.approve_membership(uuid, uuid, jsonb) from public, anon;
revoke all on function public.update_my_profile(uuid, jsonb) from public, anon;
revoke all on function public.leave_team(uuid, date) from public, anon;
grant execute on function public.member_claim_token(uuid) to authenticated;
grant execute on function public.submit_payment_reference(uuid, text) to authenticated;
grant execute on function public.add_to_season(uuid) to authenticated;
grant execute on function public.approve_membership(uuid, uuid, jsonb) to authenticated;
grant execute on function public.update_my_profile(uuid, jsonb) to authenticated;
grant execute on function public.leave_team(uuid, date) to authenticated;
