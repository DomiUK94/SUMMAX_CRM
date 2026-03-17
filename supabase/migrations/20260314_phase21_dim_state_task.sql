create extension if not exists pgcrypto;

create schema if not exists dim;

create table if not exists dim.state (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  entity_type text not null check (entity_type in ('lead', 'opportunity', 'both')),
  previous_state_id uuid references dim.state(id) on delete restrict,
  is_terminal boolean not null default false,
  is_conversion_state boolean not null default false,
  sort_order integer not null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dim_state_entity_type
  on dim.state(entity_type, sort_order);

insert into dim.state (
  code,
  name,
  entity_type,
  is_terminal,
  is_conversion_state,
  sort_order,
  active,
  notes
)
values
  ('pendiente_contactar', 'Pendiente de contactar', 'lead', false, false, 10, true, 'Inicio del pipeline de lead'),
  ('en_contacto', 'En contacto', 'lead', false, false, 20, true, 'Seguimiento comercial inicial'),
  ('documentacion_inicial', 'Documentacion inicial', 'lead', false, false, 30, true, 'Envio y revision de documentacion'),
  ('nda', 'NDA', 'lead', false, true, 40, true, 'Ultimo estado del lead antes de convertir a opportunity'),
  ('pagina_web', 'Pagina web', 'opportunity', false, false, 50, true, 'Primer estado operativo de opportunity'),
  ('contrato', 'Contrato', 'opportunity', false, false, 60, true, 'LOI, due diligence y contrato'),
  ('ingreso_cuenta', 'Ingreso en cuenta', 'opportunity', true, false, 70, true, 'Cobro parcial o completo'),
  ('descartado', 'Descartado', 'both', true, false, 999, true, 'Estado terminal global; puede ocurrir en cualquier fase')
on conflict (code) do update
set
  name = excluded.name,
  entity_type = excluded.entity_type,
  is_terminal = excluded.is_terminal,
  is_conversion_state = excluded.is_conversion_state,
  sort_order = excluded.sort_order,
  active = excluded.active,
  notes = excluded.notes,
  updated_at = now();

update dim.state as target
set previous_state_id = previous_state.id,
    updated_at = now()
from dim.state as previous_state
where target.code = 'en_contacto'
  and previous_state.code = 'pendiente_contactar';

update dim.state as target
set previous_state_id = previous_state.id,
    updated_at = now()
from dim.state as previous_state
where target.code = 'documentacion_inicial'
  and previous_state.code = 'en_contacto';

update dim.state as target
set previous_state_id = previous_state.id,
    updated_at = now()
from dim.state as previous_state
where target.code = 'nda'
  and previous_state.code = 'documentacion_inicial';

update dim.state as target
set previous_state_id = previous_state.id,
    updated_at = now()
from dim.state as previous_state
where target.code = 'pagina_web'
  and previous_state.code = 'nda';

update dim.state as target
set previous_state_id = previous_state.id,
    updated_at = now()
from dim.state as previous_state
where target.code = 'contrato'
  and previous_state.code = 'pagina_web';

update dim.state as target
set previous_state_id = previous_state.id,
    updated_at = now()
from dim.state as previous_state
where target.code = 'ingreso_cuenta'
  and previous_state.code = 'contrato';

create table if not exists dim.task (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  entity_type text not null check (entity_type in ('lead', 'opportunity', 'both')),
  state_id uuid not null references dim.state(id) on delete restrict,
  resulting_state_id uuid references dim.state(id) on delete restrict,
  task_kind text not null check (task_kind in ('action', 'feedback')),
  sort_order integer not null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dim_task_state
  on dim.task(state_id, sort_order);

create index if not exists idx_dim_task_entity_type
  on dim.task(entity_type, task_kind, sort_order);

insert into dim.task (
  code,
  name,
  entity_type,
  state_id,
  resulting_state_id,
  task_kind,
  sort_order,
  active,
  notes
)
values
  ('contactar', 'Contactar', 'lead', (select id from dim.state where code = 'pendiente_contactar'), (select id from dim.state where code = 'pendiente_contactar'), 'action', 10, true, 'Inicio del lead'),
  ('contactado', 'Contactado', 'lead', (select id from dim.state where code = 'en_contacto'), (select id from dim.state where code = 'en_contacto'), 'feedback', 20, true, 'Cambio a En contacto'),
  ('segundo_contacto', '2ndo contacto', 'lead', (select id from dim.state where code = 'en_contacto'), (select id from dim.state where code = 'en_contacto'), 'feedback', 30, true, 'Mantiene En contacto'),
  ('interes_documentacion', 'Interes en documentacion', 'lead', (select id from dim.state where code = 'en_contacto'), (select id from dim.state where code = 'documentacion_inicial'), 'action', 40, true, 'Prepara paso a Documentacion inicial'),
  ('enviar_documentacion_inicial', 'Enviar documentacion inicial', 'lead', (select id from dim.state where code = 'documentacion_inicial'), (select id from dim.state where code = 'documentacion_inicial'), 'action', 50, true, 'Cambio a Documentacion inicial'),
  ('pendiente_feedback_documentacion', 'Pendiente feedback doc. inicial', 'lead', (select id from dim.state where code = 'documentacion_inicial'), (select id from dim.state where code = 'documentacion_inicial'), 'feedback', 60, true, 'Mantiene Documentacion inicial'),
  ('interes_firmar_nda', 'Interes en firmar NDA', 'lead', (select id from dim.state where code = 'nda'), (select id from dim.state where code = 'nda'), 'action', 70, true, 'Cambio a NDA'),
  ('realizar_nda', 'Realizar NDA', 'lead', (select id from dim.state where code = 'nda'), (select id from dim.state where code = 'nda'), 'action', 80, true, 'Mantiene NDA'),
  ('nda_enviado', 'NDA enviado', 'lead', (select id from dim.state where code = 'nda'), (select id from dim.state where code = 'nda'), 'feedback', 90, true, 'Mantiene NDA'),
  ('rehacer_nda', 'Rehacer NDA', 'lead', (select id from dim.state where code = 'nda'), (select id from dim.state where code = 'nda'), 'action', 100, true, 'Reiteracion dentro del ciclo NDA'),
  ('nda_firmado', 'NDA firmado', 'lead', (select id from dim.state where code = 'nda'), (select id from dim.state where code = 'pagina_web'), 'action', 110, true, 'Hito de conversion de Lead a Opportunity'),
  ('acceso_web_financiacion_enviado', 'Acceso web financiacion enviado', 'opportunity', (select id from dim.state where code = 'pagina_web'), (select id from dim.state where code = 'pagina_web'), 'feedback', 120, true, 'Primer paso ya en Opportunity'),
  ('cuestiones_relacionadas_web', 'Cuestiones relacionadas con la web', 'opportunity', (select id from dim.state where code = 'pagina_web'), (select id from dim.state where code = 'pagina_web'), 'action', 130, true, 'Mantiene Pagina web'),
  ('interes_financiacion_confirmado', 'Interes financiacion confirmado', 'opportunity', (select id from dim.state where code = 'pagina_web'), (select id from dim.state where code = 'contrato'), 'action', 140, true, 'Prepara Contrato'),
  ('enviar_loi', 'Enviar LOI', 'opportunity', (select id from dim.state where code = 'contrato'), (select id from dim.state where code = 'contrato'), 'action', 150, true, 'Inicio del proceso contractual'),
  ('feedback_loi', 'Feedback LOI', 'opportunity', (select id from dim.state where code = 'contrato'), (select id from dim.state where code = 'contrato'), 'feedback', 160, true, 'Mantiene Contrato'),
  ('rehacer_loi', 'Rehacer LOI', 'opportunity', (select id from dim.state where code = 'contrato'), (select id from dim.state where code = 'contrato'), 'action', 170, true, 'Reiteracion dentro de LOI'),
  ('loi_firmada', 'LOI firmada', 'opportunity', (select id from dim.state where code = 'contrato'), (select id from dim.state where code = 'contrato'), 'action', 180, true, 'Habilita Due Diligence'),
  ('due_diligence', 'Due Diligence', 'opportunity', (select id from dim.state where code = 'contrato'), (select id from dim.state where code = 'contrato'), 'action', 190, true, 'Actividad dedicada dentro de Contrato'),
  ('contrato_financiacion_enviado', 'Contrato de financiacion enviado', 'opportunity', (select id from dim.state where code = 'contrato'), (select id from dim.state where code = 'contrato'), 'feedback', 200, true, 'Inicio del ciclo contractual'),
  ('negociacion_contrato', 'Negociacion contrato', 'opportunity', (select id from dim.state where code = 'contrato'), (select id from dim.state where code = 'contrato'), 'action', 210, true, 'Mantiene Contrato'),
  ('contrato_financiacion_firmado', 'Contrato de financiacion firmado', 'opportunity', (select id from dim.state where code = 'contrato'), (select id from dim.state where code = 'ingreso_cuenta'), 'action', 220, true, 'Prepara ingreso en cuenta'),
  ('anticipo_cuenta_registrado', 'Anticipo en cuenta registrado', 'opportunity', (select id from dim.state where code = 'ingreso_cuenta'), (select id from dim.state where code = 'ingreso_cuenta'), 'action', 230, true, 'Cambio a Ingreso en cuenta'),
  ('pago_completo_cuenta_registrado', 'Pago completo en cuenta registrado', 'opportunity', (select id from dim.state where code = 'ingreso_cuenta'), (select id from dim.state where code = 'ingreso_cuenta'), 'action', 240, true, 'Cierre financiero'),
  ('no_interesado', 'No interesado', 'both', (select id from dim.state where code = 'descartado'), (select id from dim.state where code = 'descartado'), 'action', 999, true, 'Cierre perdido en cualquier fase')
on conflict (code) do update
set
  name = excluded.name,
  entity_type = excluded.entity_type,
  state_id = excluded.state_id,
  resulting_state_id = excluded.resulting_state_id,
  task_kind = excluded.task_kind,
  sort_order = excluded.sort_order,
  active = excluded.active,
  notes = excluded.notes,
  updated_at = now();

grant usage on schema dim to authenticated, service_role;
grant select, insert, update, delete on dim.state to authenticated, service_role;
grant select, insert, update, delete on dim.task to authenticated, service_role;
