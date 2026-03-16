alter table public.users
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists username text,
  add column if not exists phone_country_code text,
  add column if not exists phone_number text;

create unique index if not exists users_username_unique_idx
  on public.users (lower(username))
  where username is not null;

create or replace function public.handle_user_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id then
    if new.role is distinct from old.role then
      raise exception 'role is admin-managed';
    end if;

    if new.team_id is distinct from old.team_id then
      raise exception 'team assignment is admin-managed';
    end if;
  end if;

  new.first_name = nullif(trim(new.first_name), '');
  new.last_name = nullif(trim(new.last_name), '');
  new.username = nullif(trim(new.username), '');
  new.phone_country_code = nullif(trim(new.phone_country_code), '');
  new.phone_number = nullif(trim(new.phone_number), '');
  new.updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_users_profile_update on public.users;

create trigger on_users_profile_update
before update on public.users
for each row execute procedure public.handle_user_profile_update();

comment on column public.users.first_name is 'Editable first name for the signed-in application user.';
comment on column public.users.last_name is 'Editable last name for the signed-in application user.';
comment on column public.users.username is 'Editable username for the signed-in application user.';
comment on column public.users.phone_country_code is 'Editable phone country code for the signed-in application user.';
comment on column public.users.phone_number is 'Editable phone number for the signed-in application user.';
