create table if not exists sourcecrm.prospect_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id bigint not null references sourcecrm.inversion(company_id) on delete cascade,
  contact_id bigint not null references sourcecrm.contactos(contact_id) on delete cascade,
  task_id uuid not null references dim.task(id) on delete restrict,
  task_name text not null,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references sourcecrm.users(id) on delete set null,
  actor_email text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_prospect_tasks_contact_occurred
  on sourcecrm.prospect_tasks(contact_id, occurred_at desc);

create index if not exists idx_prospect_tasks_company_occurred
  on sourcecrm.prospect_tasks(company_id, occurred_at desc);

grant select, insert, update, delete on sourcecrm.prospect_tasks to authenticated, service_role;
