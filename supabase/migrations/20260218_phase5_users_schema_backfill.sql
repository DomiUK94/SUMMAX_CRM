-- Fase 5: backfill idempotente de columnas esperadas en public.users.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null
);

alter table public.users
  add column if not exists full_name text,
  add column if not exists role text,
  add column if not exists can_view_global_dashboard boolean,
  add column if not exists is_active boolean,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.users
set
  role = coalesce(role, 'user'),
  can_view_global_dashboard = coalesce(can_view_global_dashboard, false),
  is_active = coalesce(is_active, true),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.users
  alter column role set default 'user',
  alter column role set not null,
  alter column can_view_global_dashboard set default false,
  alter column can_view_global_dashboard set not null,
  alter column is_active set default true,
  alter column is_active set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_role_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_role_check
      check (role in ('admin', 'manager', 'user'));
  end if;
end $$;
