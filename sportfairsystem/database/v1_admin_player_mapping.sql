alter table public.users
  add column if not exists player_id uuid references public.players(id) on delete set null;

create unique index if not exists users_player_id_unique_idx
  on public.users (player_id)
  where player_id is not null;

drop policy if exists "users_select_admin_team_scope" on public.users;
create policy "users_select_admin_team_scope"
on public.users
for select
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "users_update_admin_team_scope" on public.users;
create policy "users_update_admin_team_scope"
on public.users
for update
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
)
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
  and (
    player_id is null
    or exists (
      select 1
      from public.players
      where public.players.id = public.users.player_id
        and public.players.team_id = public.current_team_id()
    )
  )
);

comment on column public.users.player_id is 'Admin-managed link from an authenticated workspace user to the matching team player record.';
