create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'member' check (role in ('admin', 'member')),
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_app_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update
    set email = excluded.email,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sync on auth.users;

create trigger on_auth_user_created_sync
after insert or update on auth.users
for each row execute procedure public.handle_app_user_sync();

insert into public.users (id, email)
select id, coalesce(email, '')
from auth.users
on conflict (id) do update
  set email = excluded.email,
      updated_at = timezone('utc', now());

alter table public.users enable row level security;

drop policy if exists "users_can_select_own_profile" on public.users;
create policy "users_can_select_own_profile"
on public.users
for select
using (auth.uid() = id);

drop policy if exists "users_can_update_own_profile" on public.users;
create policy "users_can_update_own_profile"
on public.users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

comment on table public.users is 'Application user profiles linked to Supabase auth.users.';
comment on column public.users.role is 'Application role used for SportFairSystem access control.';
comment on column public.users.team_id is 'Current team assignment for the authenticated user.';
