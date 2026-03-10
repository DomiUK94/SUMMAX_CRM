create extension if not exists pgcrypto;

create table if not exists sourcecrm.entity_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('investor', 'contact')),
  entity_id text not null,
  body text not null,
  created_by_user_id uuid,
  created_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sourcecrm_entity_notes_entity
  on sourcecrm.entity_notes(entity_type, entity_id, created_at desc);
