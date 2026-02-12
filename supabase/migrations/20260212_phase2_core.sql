-- Fase 2: core CRM, import/export y seguimiento.

create extension if not exists pgcrypto;

create table if not exists public.investors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  category text not null,
  website text,
  website_domain text,
  strategy text,
  sector text,
  geo_markets text,
  hq text,
  portfolio text,
  fit_summax text,
  fit_reason text,
  notes text,
  status_name text default 'Nuevo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_investors_normalized_name on public.investors(normalized_name);
create index if not exists idx_investors_status_name on public.investors(status_name);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references public.investors(id) on delete cascade,
  investor_name text,
  full_name text not null,
  normalized_full_name text not null,
  role text,
  email text,
  phone text,
  linkedin text,
  twitter text,
  address text,
  owner_user_id uuid references public.users(id) on delete set null,
  owner_email text,
  status_name text default 'Nuevo',
  next_step text,
  due_date date,
  priority_level integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contacts_investor_id on public.contacts(investor_id);
create index if not exists idx_contacts_owner_user_id on public.contacts(owner_user_id);
create index if not exists idx_contacts_status_name on public.contacts(status_name);
create index if not exists idx_contacts_due_date on public.contacts(due_date);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('investor', 'contact')),
  entity_id uuid not null,
  body text not null,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_entity on public.comments(entity_type, entity_id);

create table if not exists public.status_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('investor', 'contact')),
  entity_id uuid not null,
  from_status_name text,
  to_status_name text not null,
  note text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_status_events_entity on public.status_events(entity_type, entity_id);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('xlsx', 'csv')),
  filename text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  inserted_count integer not null default 0,
  merged_count integer not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  summary_json jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_rows_raw (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.import_batches(id) on delete cascade,
  sheet_name text,
  row_number integer,
  raw_payload_json jsonb not null default '{}'::jsonb,
  normalized_payload_json jsonb not null default '{}'::jsonb,
  dedupe_key text,
  resolution text,
  error_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_import_rows_batch on public.import_rows_raw(batch_id);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('investor', 'contact')),
  entity_id uuid not null,
  activity_type text not null,
  title text,
  body text,
  occurred_at timestamptz not null default now(),
  created_by_user_id uuid references public.users(id) on delete set null,
  created_by_email text,
  metadata_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_activities_entity on public.activities(entity_type, entity_id);
