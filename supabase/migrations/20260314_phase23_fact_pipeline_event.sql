create extension if not exists pgcrypto;

create schema if not exists fact;

create table if not exists fact.pipeline_event (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead', 'opportunity')),
  lead_id uuid references sourcecrm.leads(id) on delete cascade,
  opportunity_id uuid references sourcecrm.opportunities(id) on delete cascade,
  company_id bigint not null references sourcecrm.inversion(company_id) on delete restrict,
  contact_id bigint not null references sourcecrm.contactos(contact_id) on delete restrict,
  product_id uuid references dim.product(id) on delete restrict,
  state_id uuid references dim.state(id) on delete restrict,
  task_id uuid references dim.task(id) on delete restrict,
  event_type text not null check (event_type in ('state_entered', 'task_logged', 'converted', 'won', 'lost', 'discarded', 'note')),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references sourcecrm.users(id) on delete set null,
  actor_email text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint pipeline_event_entity_check check (
    (
      entity_type = 'lead'
      and lead_id is not null
      and opportunity_id is null
      and product_id is null
    )
    or
    (
      entity_type = 'opportunity'
      and lead_id is null
      and opportunity_id is not null
      and product_id is not null
    )
  ),
  constraint pipeline_event_payload_check check (
    state_id is not null
    or task_id is not null
    or notes is not null
  )
);

create index if not exists idx_fact_pipeline_event_occurred_at
  on fact.pipeline_event(occurred_at desc);

create index if not exists idx_fact_pipeline_event_lead
  on fact.pipeline_event(lead_id, occurred_at desc);

create index if not exists idx_fact_pipeline_event_opportunity
  on fact.pipeline_event(opportunity_id, occurred_at desc);

create index if not exists idx_fact_pipeline_event_company
  on fact.pipeline_event(company_id, occurred_at desc);

create index if not exists idx_fact_pipeline_event_contact
  on fact.pipeline_event(contact_id, occurred_at desc);

create index if not exists idx_fact_pipeline_event_state
  on fact.pipeline_event(state_id, occurred_at desc);

create index if not exists idx_fact_pipeline_event_task
  on fact.pipeline_event(task_id, occurred_at desc);

create index if not exists idx_fact_pipeline_event_actor
  on fact.pipeline_event(actor_user_id, occurred_at desc);

grant usage on schema fact to authenticated, service_role;
grant select, insert, update, delete on fact.pipeline_event to authenticated, service_role;
