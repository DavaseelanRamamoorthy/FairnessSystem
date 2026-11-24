-- Moves every table from the v1/v2 app into a `legacy` schema so the v3
-- schema can use clean names. Safe on a fresh database (does nothing).
-- Legacy data is read by scripts/migrate-legacy.sql and can be dropped later.

create schema if not exists legacy;
revoke all on schema legacy from public, anon, authenticated;

do $$
declare
  legacy_tables text[] := array[
    'attendance_session_entries', 'attendance_sessions', 'batting_stats',
    'bowling_stats', 'fall_of_wickets', 'feedback', 'innings', 'match_officials',
    'match_players', 'matches', 'member_links', 'membership_seasons',
    'planner_matchday_actual_links', 'planner_matchday_assignments',
    'planner_matchday_batches', 'players', 'team_invites', 'team_join_requests',
    'team_member_aliases', 'team_member_permissions', 'team_members', 'teams', 'users'
  ];
  t text;
  fn record;
  trg record;
begin
  -- Old triggers on auth.users call public functions that are about to disappear.
  for trg in
    select tgname from pg_trigger
    where tgrelid = 'auth.users'::regclass and not tgisinternal
  loop
    execute format('drop trigger if exists %I on auth.users', trg.tgname);
  end loop;

  foreach t in array legacy_tables loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I set schema legacy', t);
    end if;
  end loop;

  -- Old helper/RPC functions (all SECURITY DEFINER, many callable by anon).
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'accept_team_invite', 'approve_team_join_request', 'can_access_fairness_workspace',
        'can_manage_attendance_workspace', 'can_manage_feedback_workspace',
        'can_manage_identity_workspace', 'can_manage_match_data_workspace',
        'can_manage_membership_records_for_current_team',
        'can_manage_membership_structure_for_current_team',
        'can_manage_team_invites_for_current_team', 'can_view_planner_batch',
        'cancel_my_team_join_request', 'create_team_workspace', 'current_app_role',
        'current_team_id', 'current_team_member_id', 'generate_team_join_code',
        'handle_app_user_sync', 'handle_feedback_updated_at', 'handle_user_profile_update',
        'is_admin_user', 'join_team_with_code', 'reject_team_join_request',
        'resolve_onboarding_member_name', 'submit_team_join_request',
        'submit_team_join_request_by_code', 'hash_invite_token', 'normalize_team_join_code'
      ])
  loop
    execute format('drop function if exists %s cascade', fn.signature);
  end loop;
end $$;
