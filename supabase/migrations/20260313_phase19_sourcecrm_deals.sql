create extension if not exists pgcrypto;

create table if not exists sourcecrm.deals (
  id uuid primary key default gen_random_uuid(),
  investor_id text not null,
  contact_id text,
  product_type text not null check (product_type in ('prestamo_participativo', 'franquicia')),
  stage text not null default 'Cita agendada',
  loan_amount numeric(14, 2),
  franchise_investment_input numeric(14, 2),
  franchise_multiplier numeric(6, 2),
  franchise_investment_amount numeric(14, 2),
  franchise_company_valuation numeric(14, 2),
  franchise_equity_percent numeric(5, 2),
  franchise_country text,
  created_by_user_id uuid references sourcecrm.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_product_fields_check check (
    (product_type = 'prestamo_participativo' and loan_amount is not null and loan_amount >= 100000 and loan_amount <= 3500000 and franchise_investment_input is null and franchise_multiplier is null and franchise_investment_amount is null and franchise_company_valuation is null and franchise_equity_percent is null)
    or
    (
      product_type = 'franquicia'
      and loan_amount is null
      and franchise_investment_input is not null
      and franchise_multiplier is not null
      and franchise_multiplier > 0
      and franchise_investment_amount is not null
      and franchise_company_valuation is not null
      and franchise_company_valuation > 0
      and franchise_equity_percent is not null
      and franchise_country is not null
    )
  )
);

create index if not exists idx_sourcecrm_deals_investor
  on sourcecrm.deals(investor_id, created_at desc);

create index if not exists idx_sourcecrm_deals_contact
  on sourcecrm.deals(contact_id, created_at desc);

create index if not exists idx_sourcecrm_deals_stage
  on sourcecrm.deals(stage, created_at desc);

grant select, insert, update, delete on sourcecrm.deals to authenticated, service_role;
