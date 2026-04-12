create or replace function sourcecrm.bootstrap_current_user_profile()
returns jsonb
language plpgsql
security definer
set search_path = sourcecrm, public, auth
as $$
declare
  auth_user_id uuid := auth.uid();
  auth_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  existing_profile sourcecrm.users%rowtype;
  legacy_profile public.users%rowtype;
begin
  if auth_user_id is null then
    return null;
  end if;

  select *
    into existing_profile
    from sourcecrm.users
   where id = auth_user_id;

  if found then
    return jsonb_build_object(
      'id', existing_profile.id,
      'email', existing_profile.email,
      'full_name', existing_profile.full_name,
      'role', existing_profile.role,
      'can_view_global_dashboard', existing_profile.can_view_global_dashboard,
      'is_active', existing_profile.is_active
    );
  end if;

  if auth_email = '' then
    return null;
  end if;

  select *
    into existing_profile
    from sourcecrm.users
   where lower(email) = auth_email
   limit 1;

  if found and existing_profile.id <> auth_user_id then
    raise exception 'CRM profile with this email is linked to a different auth user';
  end if;

  select *
    into legacy_profile
    from public.users
   where id = auth_user_id;

  if not found then
    select *
      into legacy_profile
      from public.users
     where lower(email) = auth_email
     limit 1;
  end if;

  if not found then
    return null;
  end if;

  insert into sourcecrm.users (
    id,
    email,
    full_name,
    role,
    can_view_global_dashboard,
    is_active,
    updated_at
  )
  values (
    auth_user_id,
    coalesce(nullif(auth_email, ''), lower(legacy_profile.email)),
    legacy_profile.full_name,
    legacy_profile.role,
    legacy_profile.can_view_global_dashboard,
    legacy_profile.is_active,
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        can_view_global_dashboard = excluded.can_view_global_dashboard,
        is_active = excluded.is_active,
        updated_at = now()
  returning *
    into existing_profile;

  return jsonb_build_object(
    'id', existing_profile.id,
    'email', existing_profile.email,
    'full_name', existing_profile.full_name,
    'role', existing_profile.role,
    'can_view_global_dashboard', existing_profile.can_view_global_dashboard,
    'is_active', existing_profile.is_active
  );
end;
$$;

grant execute on function sourcecrm.bootstrap_current_user_profile() to authenticated, service_role;
