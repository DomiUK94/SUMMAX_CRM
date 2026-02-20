-- Fase 8: modulo de sugerencias para feedback al desarrollador

create table if not exists sourcecrm.suggestions (
  id uuid primary key default gen_random_uuid(),
  suggestion_text text not null,
  status text not null default 'abierta' check (status in ('abierta', 'en_revision', 'planificada', 'en_progreso', 'resuelta', 'descartada')),
  created_by_user_id uuid not null references sourcecrm.users(id) on delete restrict,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sourcecrm.suggestion_events (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references sourcecrm.suggestions(id) on delete cascade,
  event_type text not null check (event_type in ('creacion', 'cambio_estado', 'nota', 'feedback')),
  body text not null,
  created_by_user_id uuid not null references sourcecrm.users(id) on delete restrict,
  created_by_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_suggestions_created_at on sourcecrm.suggestions(created_at desc);
create index if not exists idx_suggestions_status on sourcecrm.suggestions(status);
create index if not exists idx_suggestion_events_suggestion on sourcecrm.suggestion_events(suggestion_id, created_at desc);

grant select, insert, update, delete on sourcecrm.suggestions to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.suggestion_events to authenticated, service_role;
