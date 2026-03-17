create table if not exists sourcecrm.prospects (
  id uuid primary key default gen_random_uuid(),
  company_id bigint not null references sourcecrm.inversion(company_id) on delete cascade,
  contact_id bigint not null references sourcecrm.contactos(contact_id) on delete cascade,
  owner_user_id uuid references sourcecrm.users(id) on delete set null,
  owner_email text,
  status text not null default 'contactar' check (status in ('contactar', 'en_contacto')),
  resolution text not null default 'open' check (resolution in ('open', 'not_interested', 'converted')),
  created_by_user_id uuid references sourcecrm.users(id) on delete set null,
  created_by_email text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prospects_contact_updated
  on sourcecrm.prospects(contact_id, updated_at desc);

create index if not exists idx_prospects_company_updated
  on sourcecrm.prospects(company_id, updated_at desc);

create index if not exists idx_prospects_resolution_updated
  on sourcecrm.prospects(resolution, updated_at desc);

create unique index if not exists ux_prospects_open_contact
  on sourcecrm.prospects(contact_id)
  where resolution = 'open';

alter table sourcecrm.prospect_tasks
  add column if not exists prospect_id uuid references sourcecrm.prospects(id) on delete cascade;

create index if not exists idx_prospect_tasks_prospect_occurred
  on sourcecrm.prospect_tasks(prospect_id, occurred_at desc);

grant select, insert, update, delete on sourcecrm.prospects to authenticated, service_role;
