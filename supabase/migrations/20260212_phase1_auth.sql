-- Fase 1: base auth/permisos y tablas core.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  role text not null check (role in ('admin', 'manager', 'user')),
  can_view_global_dashboard boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.status_catalog (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('investor', 'contact')),
  name text not null,
  sort_order integer not null,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scope, name)
);

insert into public.status_catalog (scope, name, sort_order, color)
values
  ('investor', 'Nuevo', 1, '#6b7280'),
  ('investor', 'Investigando', 2, '#2563eb'),
  ('investor', 'Pendiente contacto', 3, '#f59e0b'),
  ('investor', 'Contactado', 4, '#0ea5e9'),
  ('investor', 'Reply', 5, '#8b5cf6'),
  ('investor', 'Reunion agendada', 6, '#06b6d4'),
  ('investor', 'Reunion realizada', 7, '#0891b2'),
  ('investor', 'Evaluacion interna', 8, '#84cc16'),
  ('investor', 'Negociacion', 9, '#22c55e'),
  ('investor', 'Ganado', 10, '#15803d'),
  ('investor', 'Perdido', 11, '#dc2626'),
  ('investor', 'En pausa', 12, '#9ca3af'),
  ('contact', 'Nuevo', 1, '#6b7280'),
  ('contact', 'Investigando', 2, '#2563eb'),
  ('contact', 'Pendiente contacto', 3, '#f59e0b'),
  ('contact', 'Contactado', 4, '#0ea5e9'),
  ('contact', 'Reply', 5, '#8b5cf6'),
  ('contact', 'Reunion agendada', 6, '#06b6d4'),
  ('contact', 'Reunion realizada', 7, '#0891b2'),
  ('contact', 'Evaluacion interna', 8, '#84cc16'),
  ('contact', 'Negociacion', 9, '#22c55e'),
  ('contact', 'Ganado', 10, '#15803d'),
  ('contact', 'Perdido', 11, '#dc2626'),
  ('contact', 'En pausa', 12, '#9ca3af')
on conflict (scope, name) do nothing;
