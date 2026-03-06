-- Fase 11: tipo de entrada en sugerencias (sugerencia, bug, nota)

alter table sourcecrm.suggestions
  add column if not exists suggestion_type text not null default 'sugerencia';

alter table sourcecrm.suggestions
  drop constraint if exists suggestions_suggestion_type_check;

alter table sourcecrm.suggestions
  add constraint suggestions_suggestion_type_check
  check (suggestion_type in ('sugerencia', 'bug', 'nota'));

create index if not exists idx_suggestions_type on sourcecrm.suggestions(suggestion_type);
