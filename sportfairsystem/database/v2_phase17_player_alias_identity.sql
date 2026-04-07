-- V2 Phase 17 player alias identity hardening
--
-- Goal:
-- Keep Memberships as the organiser CRUD surface, but anchor external
-- scorecard aliases directly to player_id so all stat attribution flows
-- resolve against the canonical cricket identity.

alter table public.team_member_aliases
  add column if not exists player_id uuid references public.players(id) on delete set null;

create index if not exists team_member_aliases_player_idx
  on public.team_member_aliases (player_id, alias_type, created_at desc);

update public.team_member_aliases aliases
set player_id = coalesce(aliases.player_id, links.player_id, players.id)
from public.team_members members
left join public.member_links links
  on links.member_id = members.id
left join public.players players
  on players.member_id = members.id
 and players.team_id = members.team_id
where aliases.member_id = members.id
  and aliases.team_id = members.team_id
  and aliases.player_id is null;

drop policy if exists "team_member_aliases_insert_identity_team_scope" on public.team_member_aliases;
create policy "team_member_aliases_insert_identity_team_scope"
on public.team_member_aliases
for insert
with check (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.team_member_aliases.member_id
      and public.team_members.team_id = public.current_team_id()
  )
  and (
    public.team_member_aliases.player_id is null
    or exists (
      select 1
      from public.players
      where public.players.id = public.team_member_aliases.player_id
        and public.players.team_id = public.current_team_id()
    )
  )
);

drop policy if exists "team_member_aliases_update_identity_team_scope" on public.team_member_aliases;
create policy "team_member_aliases_update_identity_team_scope"
on public.team_member_aliases
for update
using (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
)
with check (
  public.can_manage_identity_workspace()
  and team_id = public.current_team_id()
  and exists (
    select 1
    from public.team_members
    where public.team_members.id = public.team_member_aliases.member_id
      and public.team_members.team_id = public.current_team_id()
  )
  and (
    public.team_member_aliases.player_id is null
    or exists (
      select 1
      from public.players
      where public.players.id = public.team_member_aliases.player_id
        and public.players.team_id = public.current_team_id()
    )
  )
);

comment on column public.team_member_aliases.player_id is 'Canonical player identity used for scorecard, planner, and stats alias resolution.';
