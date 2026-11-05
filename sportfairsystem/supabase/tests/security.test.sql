-- Run with: npm run db:test   (needs `npm run db:start` first)
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

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
reset role;

select * from finish();
rollback;
