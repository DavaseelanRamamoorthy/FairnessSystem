alter table public.players
  add column if not exists is_captain boolean not null default false,
  add column if not exists is_wicket_keeper boolean not null default false,
  add column if not exists role_tags text[] not null default '{}'::text[];

comment on column public.players.is_captain is 'Admin-managed squad flag for the current team captain.';
comment on column public.players.is_wicket_keeper is 'Admin-managed squad flag for the designated wicket keeper.';
comment on column public.players.role_tags is 'Admin-managed squad role tags such as Batter, Bowler, or All-Rounder.';

update public.players
set is_captain = true
where id in (
  select distinct player_id
  from public.match_players
  where player_id is not null
    and is_captain = true
);

update public.players
set is_wicket_keeper = true
where id in (
  select distinct player_id
  from public.match_players
  where player_id is not null
    and is_wicket_keeper = true
);
