-- Fase 10: permitir tipo de evento "bug" en sugerencias

alter table sourcecrm.suggestion_events
  drop constraint if exists suggestion_events_event_type_check;

alter table sourcecrm.suggestion_events
  add constraint suggestion_events_event_type_check
  check (event_type in ('creacion', 'cambio_estado', 'nota', 'feedback', 'bug'));
