-- Fase 14: responsable en sugerencias para seguimiento interno

alter table sourcecrm.suggestions
  add column if not exists assigned_to_user_id uuid references sourcecrm.users(id) on delete set null,
  add column if not exists assigned_to_email text;

create index if not exists idx_suggestions_assigned_to_user_id
  on sourcecrm.suggestions(assigned_to_user_id);
