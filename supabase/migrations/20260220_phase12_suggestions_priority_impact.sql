-- Fase 12: mover prioridad/impacto a columnas reales y eliminar metadata embebida en texto

alter table sourcecrm.suggestions
  add column if not exists priority_level text not null default 'media';

alter table sourcecrm.suggestions
  add column if not exists impact_scope text not null default 'equipo';

alter table sourcecrm.suggestions
  drop constraint if exists suggestions_priority_level_check;

alter table sourcecrm.suggestions
  add constraint suggestions_priority_level_check
  check (priority_level in ('baja', 'media', 'alta', 'critica'));

alter table sourcecrm.suggestions
  drop constraint if exists suggestions_impact_scope_check;

alter table sourcecrm.suggestions
  add constraint suggestions_impact_scope_check
  check (impact_scope in ('local', 'equipo', 'global'));

update sourcecrm.suggestions
set
  priority_level = case
    when lower(coalesce(substring(suggestion_text from '\[Prioridad:\s*([^\]]+)\]'), '')) in ('baja', 'media', 'alta', 'critica')
      then lower(substring(suggestion_text from '\[Prioridad:\s*([^\]]+)\]'))
    else priority_level
  end,
  impact_scope = case
    when lower(coalesce(substring(suggestion_text from '\[Impacto:\s*([^\]]+)\]'), '')) in ('local', 'equipo', 'global')
      then lower(substring(suggestion_text from '\[Impacto:\s*([^\]]+)\]'))
    else impact_scope
  end,
  suggestion_text = btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(suggestion_text, '\[Modulo:[^\]]+\]\s*', '', 'gi'),
        '\[Prioridad:[^\]]+\]\s*',
        '',
        'gi'
      ),
      '\[Impacto:[^\]]+\]\s*',
      '',
      'gi'
    )
  )
where suggestion_text ~* '\[(Modulo|Prioridad|Impacto):';

create index if not exists idx_suggestions_priority_level on sourcecrm.suggestions(priority_level);
create index if not exists idx_suggestions_impact_scope on sourcecrm.suggestions(impact_scope);
