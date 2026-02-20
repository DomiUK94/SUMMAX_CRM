-- Fase 7: perfil y autorizacion CRM en sourcecrm.users (separado de public.users)

create schema if not exists sourcecrm;

create table if not exists sourcecrm.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'manager', 'user')),
  is_active boolean not null default true,
  can_view_global_dashboard boolean not null default false,
  timezone text default 'Europe/Madrid',
  locale text default 'es-ES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sourcecrm_users_active on sourcecrm.users(is_active);
create index if not exists idx_sourcecrm_users_role on sourcecrm.users(role);

grant select, insert, update, delete on sourcecrm.users to authenticated, service_role;
