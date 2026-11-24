-- Date of birth and Instagram handle on the player profile.
-- Both sit in member_private, so only the player, captains and the organiser
-- can see them, the same as phone and email.

alter table public.member_private
  add column date_of_birth date
    check (date_of_birth between date '1920-01-01' and current_date),
  add column instagram text
    check (instagram ~ '^[A-Za-z0-9._]{1,30}$');

-- Same as before, plus the two new fields. Unlike the other contact fields,
-- these can be cleared: sending an empty value removes them.
create or replace function public.update_my_profile(p_team uuid, p_profile jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid := app_private.my_member_id(p_team);
  v_instagram text;
begin
  perform app_private.require(v_member is not null, 'You are not a member of this team');
  update public.members set
    display_name = coalesce(nullif(btrim(p_profile ->> 'display_name'), ''), display_name),
    primary_roles = case when p_profile ? 'primary_roles'
      then array(select jsonb_array_elements_text(p_profile -> 'primary_roles')) else primary_roles end,
    is_wicketkeeper = coalesce((p_profile ->> 'is_wicketkeeper')::boolean, is_wicketkeeper),
    bowls = coalesce((p_profile ->> 'bowls')::boolean, bowls),
    bat_hand = coalesce(p_profile ->> 'bat_hand', bat_hand),
    bowl_hand = coalesce(p_profile ->> 'bowl_hand', bowl_hand),
    bat_pref = coalesce(p_profile ->> 'bat_pref', bat_pref),
    bowl_pref = coalesce(p_profile ->> 'bowl_pref', bowl_pref)
  where id = v_member;

  if p_profile ?| array['phone', 'email', 'whatsapp', 'date_of_birth', 'instagram'] then
    -- Accept "@name" or a profile link, and store just the handle.
    v_instagram := nullif(
      regexp_replace(
        regexp_replace(btrim(coalesce(p_profile ->> 'instagram', '')), '^(https?://)?(www\.)?instagram\.com/', '', 'i'),
        '^@|/+$', '', 'g'),
      '');

    insert into public.member_private (member_id, email, phone, whatsapp, date_of_birth, instagram)
    values (v_member, p_profile ->> 'email', p_profile ->> 'phone', p_profile ->> 'whatsapp',
            nullif(p_profile ->> 'date_of_birth', '')::date, v_instagram)
    on conflict (member_id) do update set
      email = coalesce(excluded.email, public.member_private.email),
      phone = coalesce(excluded.phone, public.member_private.phone),
      whatsapp = coalesce(excluded.whatsapp, public.member_private.whatsapp),
      date_of_birth = case when p_profile ? 'date_of_birth'
        then excluded.date_of_birth else public.member_private.date_of_birth end,
      instagram = case when p_profile ? 'instagram'
        then excluded.instagram else public.member_private.instagram end;
  end if;
end $$;

revoke all on function public.update_my_profile(uuid, jsonb) from public, anon;
grant execute on function public.update_my_profile(uuid, jsonb) to authenticated;
