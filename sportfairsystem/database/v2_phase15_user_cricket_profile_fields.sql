alter table public.users
  add column if not exists primary_role text,
  add column if not exists batting_style text,
  add column if not exists bowling_style text,
  add column if not exists batter_preference text,
  add column if not exists bowler_preference text,
  add column if not exists cricheroes_name text;

create or replace function public.handle_user_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and current_setting('app.bypass_user_admin_fields', true) <> 'on' then
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
  new.primary_role = nullif(trim(new.primary_role), '');
  new.batting_style = nullif(trim(new.batting_style), '');
  new.bowling_style = nullif(trim(new.bowling_style), '');
  new.batter_preference = nullif(trim(new.batter_preference), '');
  new.bowler_preference = nullif(trim(new.bowler_preference), '');
  new.cricheroes_name = nullif(trim(new.cricheroes_name), '');
  new.updated_at = timezone('utc', now());

  return new;
end;
$$;

comment on column public.users.primary_role is 'Editable cricket role for the signed-in application user.';
comment on column public.users.batting_style is 'Editable batting style for the signed-in application user.';
comment on column public.users.bowling_style is 'Editable bowling style for the signed-in application user.';
comment on column public.users.batter_preference is 'Editable batting preference for the signed-in application user.';
comment on column public.users.bowler_preference is 'Editable bowling preference for the signed-in application user.';
comment on column public.users.cricheroes_name is 'Editable CricHeroes display name for the signed-in application user.';
