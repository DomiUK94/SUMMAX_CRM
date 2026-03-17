create extension if not exists pgcrypto;

create schema if not exists sourcecrm;

create table if not exists sourcecrm.leads (
  id uuid primary key default gen_random_uuid(),
  company_id bigint not null references sourcecrm.inversion(company_id) on delete restrict,
  contact_id bigint not null references sourcecrm.contactos(contact_id) on delete restrict,
  current_state_id uuid not null references dim.state(id) on delete restrict,
  name text,
  owner_user_id uuid references sourcecrm.users(id) on delete set null,
  owner_email text,
  created_by_user_id uuid references sourcecrm.users(id) on delete set null,
  created_by_email text,
  opened_at timestamptz not null default now(),
  converted_at timestamptz,
  closed_at timestamptz,
  resolution text not null default 'open' check (resolution in ('open', 'converted', 'discarded', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sourcecrm_leads_company
  on sourcecrm.leads(company_id, opened_at desc);

create index if not exists idx_sourcecrm_leads_contact
  on sourcecrm.leads(contact_id, opened_at desc);

create index if not exists idx_sourcecrm_leads_state
  on sourcecrm.leads(current_state_id, opened_at desc);

create index if not exists idx_sourcecrm_leads_owner
  on sourcecrm.leads(owner_user_id, opened_at desc);

create table if not exists sourcecrm.opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references sourcecrm.leads(id) on delete restrict,
  company_id bigint not null references sourcecrm.inversion(company_id) on delete restrict,
  contact_id bigint not null references sourcecrm.contactos(contact_id) on delete restrict,
  product_id uuid not null references dim.product(id) on delete restrict,
  current_state_id uuid not null references dim.state(id) on delete restrict,
  name text,
  owner_user_id uuid references sourcecrm.users(id) on delete set null,
  owner_email text,
  created_by_user_id uuid references sourcecrm.users(id) on delete set null,
  created_by_email text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  resolution text not null default 'open' check (resolution in ('open', 'won', 'lost', 'cancelled')),
  estimated_amount numeric(14, 2),
  closed_amount numeric(14, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sourcecrm_opportunities_lead
  on sourcecrm.opportunities(lead_id, opened_at desc);

create index if not exists idx_sourcecrm_opportunities_company
  on sourcecrm.opportunities(company_id, opened_at desc);

create index if not exists idx_sourcecrm_opportunities_contact
  on sourcecrm.opportunities(contact_id, opened_at desc);

create index if not exists idx_sourcecrm_opportunities_product
  on sourcecrm.opportunities(product_id, opened_at desc);

create index if not exists idx_sourcecrm_opportunities_state
  on sourcecrm.opportunities(current_state_id, opened_at desc);

create index if not exists idx_sourcecrm_opportunities_owner
  on sourcecrm.opportunities(owner_user_id, opened_at desc);

grant select, insert, update, delete on sourcecrm.leads to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.opportunities to authenticated, service_role;
