-- Fase 13: etiquetas para sugerencias (acciones en lote)

alter table sourcecrm.suggestions
  add column if not exists tags text[] not null default '{}';

create index if not exists idx_suggestions_tags_gin
  on sourcecrm.suggestions
  using gin (tags);
