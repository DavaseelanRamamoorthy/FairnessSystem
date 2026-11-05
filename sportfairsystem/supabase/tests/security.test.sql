-- Run with: npm run db:test   (needs `npm run db:start` first)
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- Two people: organiser Olga and player Pete.
insert into auth.users (id, email, instance_id, aud, role)
values ('00000000-0000-0000-0000-00000000000a', 'olga@example.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000000b', 'pete@example.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

create function pg_temp.act_as(p_user text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- ---------------------------------------------------------------- anon
set local role anon;
select throws_ok($$ select * from public.members $$, '42501', null, 'anon cannot read members');
select throws_ok($$ select * from public.transactions $$, '42501', null, 'anon cannot read money');
select throws_ok($$ select public.bootstrap_team('X', 2027, '2027-04-01', '2027-10-31', 40, 'X') $$,
  '42501', null, 'anon cannot call RPCs');
reset role;

-- ---------------------------------------------------------------- bootstrap
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.bootstrap_team('Moonwalkers', 2027, '2027-04-01', '2027-10-31', 40, 'Olga') $$,
  'first user can create the team');
select throws_ok($$ select public.bootstrap_team('Again', 2027, '2027-04-01', '2027-10-31', 40, 'Olga') $$,
  '42501', 'The team already exists', 'bootstrap only works once');
update public.seasons set registration_open = true;
reset role;

-- ---------------------------------------------------------------- registration
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ select public.submit_membership((select id from public.seasons), 'new', '{"display_name":"Pete"}'::jsonb) $$,
  '42501', 'You must accept the club terms and data notice', 'consent is required');
select lives_ok(
  $$ select public.submit_membership((select id from public.seasons), 'new',
       '{"display_name":"Pete","consent":true,"phone":"+49 1","bowls":true,"bat_pref":"lower"}'::jsonb) $$,
  'player can apply');
select is((select count(*)::int from public.members), 0, 'applicant cannot see members yet');
select throws_ok(
  $$ select public.approve_membership((select id from public.membership_applications)) $$,
  '42501', 'Only the organiser can approve members', 'player cannot approve themselves');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$ select public.approve_membership((select id from public.membership_applications),
       null, '[{"source":"spond","display_name":"Pete S"},{"source":"cricheroes","external_id":"999","display_name":"Pete"}]'::jsonb) $$,
  'organiser approves');
select is((select status from public.season_members sm join public.members m on m.id = sm.member_id where m.display_name = 'Pete'),
  'pending_payment', 'approved member waits for payment');
select is((select count(*)::int from public.member_identities where name_key = 'pete s' and source = 'spond'), 1,
  'Spond name stored as an identity');
reset role;

-- ---------------------------------------------------------------- what a pending player sees
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.members), 2, 'member sees the squad');
select is((select count(*)::int from public.member_private), 1, 'player sees only their own contact data');
select is((select count(*)::int from public.charges), 1, 'player sees their own dues');
select throws_ok(
  $$ select public.record_payment((select id from public.charges), 40, 'EUR', 40, 'paypal', 'x', current_date, null) $$,
  '42501', 'Only the treasurer can record payments', 'player cannot mark themselves paid');
select throws_ok(
  $$ select public.set_member_role((select id from public.season_members limit 1), 'organiser', '{}') $$,
  '42501', 'Only the organiser can assign roles', 'player cannot promote themselves');
select is((select count(*)::int from public.audit_log), 0, 'player cannot read the audit log');
reset role;

-- ---------------------------------------------------------------- payment activates
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$ select public.record_payment((select id from public.charges), 40, 'EUR', 40, 'paypal', 'REF1', current_date, null) $$,
  'treasurer/organiser records payment');
select is((select status from public.season_members sm join public.members m on m.id = sm.member_id where m.display_name = 'Pete'),
  'active', 'full payment activates membership');
select is((select count(*)::int from public.transactions where category = 'membership'), 1, 'payment posted to the cash book');
select throws_ok(
  $$ select public.set_member_role((select sm.id from public.season_members sm join public.members m on m.id = sm.member_id
                                   where m.display_name = 'Olga'), 'player', '{}') $$,
  '42501', 'The team must keep at least one organiser', 'last organiser cannot be demoted');
reset role;

-- ---------------------------------------------------------------- players cannot run matchday
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ insert into public.competitions (season_id, name, kind) values ((select id from public.seasons), 'X', 'tournament') $$,
  '42501', null, 'player cannot create competitions');
select is((select count(*)::int from public.transactions), 0, 'player cannot see the cash book');

-- claim tokens would let a teammate take over an unclaimed profile
select throws_ok($$ select claim_token from public.members $$, '42501', null, 'player cannot read claim tokens');
select throws_ok(
  $$ select public.member_claim_token((select id from public.members limit 1)) $$,
  '42501', 'Only the organiser can create claim links', 'player cannot create claim links');
select lives_ok(
  $$ select public.submit_payment_reference((select id from public.charges), 'PAYPAL-1') $$,
  'player can add a reference to their own dues');
select lives_ok(
  $$ select public.update_my_profile((select id from public.teams), '{"bat_pref":"middle"}'::jsonb) $$,
  'player can update their own profile');
select is((select bowls from public.members where display_name = 'Pete'), true, 'a partial profile update keeps other fields');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$ select public.add_member((select id from public.teams), 'Quinn',
       '[{"source":"spond","display_name":"Quinn Q"}]'::jsonb) $$,
  'organiser can add a member without an account');
select isnt(public.member_claim_token((select id from public.members where display_name = 'Quinn')), null,
  'organiser gets a claim token');
select throws_ok(
  $$ select public.link_identity((select id from public.members where display_name = 'Olga'), 'spond', null, 'Quinn Q') $$,
  'P0001', 'The spond name "Quinn Q" already belongs to another member', 'one Spond name cannot point at two people');
select is(public.add_to_season((select id from public.members where display_name = 'Quinn')), 'pending_payment',
  'adding to a paid season waits for payment');
select throws_ok(
  $$ select public.leave_team((select id from public.members where display_name = 'Olga')) $$,
  '42501', 'The team must keep at least one organiser', 'the last organiser cannot leave');
select lives_ok($$ select public.leave_team((select id from public.members where display_name = 'Pete')) $$,
  'organiser can mark a player as left');
select is(public.add_to_season((select id from public.members where display_name = 'Pete')), 'active',
  'a paid member comes back active');
reset role;

-- ticking "treasurer" on the form must not grant treasurer access
insert into auth.users (id, email, instance_id, aud, role)
values ('00000000-0000-0000-0000-00000000000c', 'rae@example.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.submit_membership((select id from public.seasons), 'new',
  '{"display_name":"Rae","consent":true,"responsibilities_interest":["treasurer"]}'::jsonb);
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.approve_membership((select id from public.membership_applications where status = 'applied'));
select is(
  (select responsibilities from public.season_members sm join public.members m on m.id = sm.member_id where m.display_name = 'Rae'),
  '{}'::text[], 'applying as treasurer grants nothing');
reset role;

select * from finish();
rollback;
