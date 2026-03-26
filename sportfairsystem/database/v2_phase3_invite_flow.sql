-- V2 Phase 3 invite flow foundation
--
-- Purpose:
-- 1. Add team invites for existing-member and new-member onboarding.
-- 2. Let permitted team leadership create and manage invites.
-- 3. Let authenticated users accept invites safely in single-team mode.

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  invite_type text not null check (invite_type in ('existing_member', 'new_member')),
  member_id uuid references public.team_members(id) on delete set null,
  invite_name text not null,
  season_id uuid references public.membership_seasons(id) on delete set null,
  invited_role text not null default 'player' check (invited_role in ('admin', 'captain', 'player')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  token_hash text not null unique,
  token_expires_at timestamptz not null,
  invited_by_user_id uuid references public.users(id) on delete set null,
  accepted_by_user_id uuid references public.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint team_invites_existing_member_requires_target
    check (
      (invite_type = 'existing_member' and member_id is not null)
      or (invite_type = 'new_member')
    )
);

create index if not exists team_invites_team_status_idx
  on public.team_invites (team_id, status, created_at desc);

create index if not exists team_invites_team_email_idx
  on public.team_invites (team_id, email, created_at desc);

create unique index if not exists team_invites_team_email_pending_unique_idx
  on public.team_invites (team_id, lower(email))
  where status = 'pending';

create unique index if not exists team_invites_member_pending_unique_idx
  on public.team_invites (member_id)
  where status = 'pending' and member_id is not null;

create or replace function public.hash_invite_token(invite_token text)
returns text
language sql
immutable
as $$
  select encode(digest(invite_token, 'sha256'), 'hex');
$$;

comment on function public.hash_invite_token(text) is 'Hashes a raw invite token using SHA-256 for secure invite storage.';

create or replace function public.can_manage_team_invites_for_current_team()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with current_user_row as (
    select u.id, u.team_id, u.role
    from public.users u
    where u.id = auth.uid()
  ),
  current_member as (
    select tm.id, tm.team_role
    from current_user_row cu
    join public.team_members tm
      on tm.user_id = cu.id
     and tm.team_id = cu.team_id
  )
  select coalesce(
    exists (
      select 1
      from current_user_row cu
      where cu.team_id = public.current_team_id()
        and cu.role = 'admin'
    )
    or exists (
      select 1
      from current_member cm
      where cm.team_role in ('organiser', 'coordinator')
    )
    or exists (
      select 1
      from current_member cm
      join public.team_member_permissions tmp
        on tmp.member_id = cm.id
       and tmp.team_id = public.current_team_id()
      where tmp.permission = 'invites_manage'
    ),
    false
  );
$$;

comment on function public.can_manage_team_invites_for_current_team() is 'Returns true when the authenticated user can manage team invites in the active team context.';

create or replace function public.accept_team_invite(invite_token text)
returns table (
  invite_id uuid,
  team_id uuid,
  member_id uuid,
  invite_type text,
  created_member boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  current_user_row public.users%rowtype;
  invite_row public.team_invites%rowtype;
  existing_member_row public.team_members%rowtype;
  linked_player_id uuid;
  next_member_id uuid;
  created_new_member boolean := false;
  next_team_role text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to accept an invite.';
  end if;

  if current_user_email = '' then
    raise exception 'Could not confirm the signed-in account email for this invite.';
  end if;

  select *
  into current_user_row
  from public.users
  where id = current_user_id;

  if not found then
    raise exception 'Your app profile is not ready yet.';
  end if;

  select *
  into invite_row
  from public.team_invites
  where token_hash = public.hash_invite_token(invite_token);

  if not found then
    raise exception 'This invite is invalid or no longer available.';
  end if;

  if lower(invite_row.email) <> current_user_email then
    raise exception 'This invite was sent to a different email address.';
  end if;

  if invite_row.status <> 'pending' then
    raise exception 'This invite is no longer pending.';
  end if;

  if invite_row.token_expires_at < timezone('utc', now()) then
    update public.team_invites
    set status = 'expired',
        updated_at = timezone('utc', now())
    where id = invite_row.id;

    raise exception 'This invite has expired.';
  end if;

  if current_user_row.team_id is not null and current_user_row.team_id <> invite_row.team_id then
    raise exception 'This account already belongs to another team in the current single-team setup.';
  end if;

  select tm.*
  into existing_member_row
  from public.team_members tm
  where tm.team_id = invite_row.team_id
    and tm.user_id = current_user_id
  limit 1;

  if found then
    if invite_row.invite_type = 'existing_member' and existing_member_row.id <> invite_row.member_id then
      raise exception 'This account is already linked to another membership in the same team.';
    end if;

    if invite_row.invite_type = 'new_member' then
      raise exception 'This account is already linked to this team.';
    end if;
  end if;

  if invite_row.invite_type = 'existing_member' then
    select *
    into existing_member_row
    from public.team_members
    where id = invite_row.member_id
      and team_id = invite_row.team_id;

    if not found then
      raise exception 'The invited member record no longer exists.';
    end if;

    if existing_member_row.user_id is not null and existing_member_row.user_id <> current_user_id then
      raise exception 'This team member has already been claimed by another account.';
    end if;

    select ml.player_id
    into linked_player_id
    from public.member_links ml
    where ml.member_id = existing_member_row.id
    limit 1;

    update public.team_members
    set user_id = current_user_id,
        status = 'active',
        joined_at = coalesce(joined_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
    where id = existing_member_row.id;

    insert into public.member_links (member_id, user_id, player_id)
    values (existing_member_row.id, current_user_id, linked_player_id)
    on conflict (member_id) do update
      set user_id = excluded.user_id;

    next_member_id := existing_member_row.id;
  else
    next_team_role :=
      case invite_row.invited_role
        when 'admin' then 'organiser'
        when 'captain' then 'coordinator'
        else 'member'
      end;

    insert into public.team_members (
      team_id,
      season_id,
      user_id,
      name,
      role,
      team_role,
      status,
      joined_at,
      invited_by_user_id,
      updated_at
    )
    values (
      invite_row.team_id,
      invite_row.season_id,
      current_user_id,
      invite_row.invite_name,
      invite_row.invited_role,
      next_team_role,
      'active',
      timezone('utc', now()),
      invite_row.invited_by_user_id,
      timezone('utc', now())
    )
    returning id into next_member_id;

    insert into public.member_links (member_id, user_id)
    values (next_member_id, current_user_id)
    on conflict (member_id) do update
      set user_id = excluded.user_id;

    created_new_member := true;
  end if;

  update public.users
  set team_id = invite_row.team_id,
      role = 'member',
      player_id = linked_player_id,
      updated_at = timezone('utc', now())
  where id = current_user_id;

  update public.team_invites
  set status = 'accepted',
      accepted_by_user_id = current_user_id,
      accepted_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = invite_row.id;

  return query
  select
    invite_row.id,
    invite_row.team_id,
    next_member_id,
    invite_row.invite_type,
    created_new_member;
end;
$$;

comment on function public.accept_team_invite(text) is 'Accepts a pending invite for the signed-in user, linking or creating the correct team membership.';

alter table public.team_invites enable row level security;

drop policy if exists "team_invites_select_manager_scope" on public.team_invites;
create policy "team_invites_select_manager_scope"
on public.team_invites
for select
using (
  team_id = public.current_team_id()
  and public.can_manage_team_invites_for_current_team()
);

drop policy if exists "team_invites_select_recipient_email" on public.team_invites;
create policy "team_invites_select_recipient_email"
on public.team_invites
for select
using (
  status = 'pending'
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "team_invites_insert_manager_scope" on public.team_invites;
create policy "team_invites_insert_manager_scope"
on public.team_invites
for insert
with check (
  team_id = public.current_team_id()
  and public.can_manage_team_invites_for_current_team()
  and (
    member_id is null
    or exists (
      select 1
      from public.team_members
      where public.team_members.id = public.team_invites.member_id
        and public.team_members.team_id = public.current_team_id()
    )
  )
  and (
    season_id is null
    or exists (
      select 1
      from public.membership_seasons
      where public.membership_seasons.id = public.team_invites.season_id
        and public.membership_seasons.team_id = public.current_team_id()
    )
  )
);

drop policy if exists "team_invites_update_manager_scope" on public.team_invites;
create policy "team_invites_update_manager_scope"
on public.team_invites
for update
using (
  team_id = public.current_team_id()
  and public.can_manage_team_invites_for_current_team()
)
with check (
  team_id = public.current_team_id()
  and public.can_manage_team_invites_for_current_team()
  and (
    member_id is null
    or exists (
      select 1
      from public.team_members
      where public.team_members.id = public.team_invites.member_id
        and public.team_members.team_id = public.current_team_id()
    )
  )
  and (
    season_id is null
    or exists (
      select 1
      from public.membership_seasons
      where public.membership_seasons.id = public.team_invites.season_id
        and public.membership_seasons.team_id = public.current_team_id()
    )
  )
);

drop policy if exists "team_invites_delete_manager_scope" on public.team_invites;
create policy "team_invites_delete_manager_scope"
on public.team_invites
for delete
using (
  team_id = public.current_team_id()
  and public.can_manage_team_invites_for_current_team()
);

comment on table public.team_invites is 'Pending, accepted, expired, or cancelled team invites for existing-member claim and new-member onboarding.';
comment on column public.team_invites.invite_type is 'Whether the invite claims an existing member or creates a new member on acceptance.';
comment on column public.team_invites.member_id is 'Existing team member targeted by this invite when invite_type is existing_member.';
comment on column public.team_invites.invite_name is 'Display name shown to the invited person and used to create a new member when invite_type is new_member.';
