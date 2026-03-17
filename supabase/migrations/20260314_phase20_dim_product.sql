create extension if not exists pgcrypto;

create schema if not exists dim;

create table if not exists dim.product (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('prestamo_participativo', 'franquicia')),
  name text not null unique,
  product_family text not null check (product_family in ('loan', 'franchise')),
  amount_min numeric(14, 2),
  amount_max numeric(14, 2),
  default_multiplier numeric(6, 2),
  requires_amount boolean not null default false,
  requires_multiplier boolean not null default false,
  requires_company_valuation boolean not null default false,
  requires_country boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_config_check check (
    (
      product_family = 'loan'
      and requires_amount = true
      and amount_min is not null
      and amount_max is not null
      and amount_min > 0
      and amount_max >= amount_min
      and default_multiplier is null
      and requires_multiplier = false
      and requires_company_valuation = false
      and requires_country = false
    )
    or
    (
      product_family = 'franchise'
      and requires_amount = false
      and amount_min is null
      and amount_max is null
      and default_multiplier is not null
      and default_multiplier > 0
      and requires_multiplier = true
      and requires_company_valuation = true
      and requires_country = true
    )
  )
);

insert into dim.product (
  code,
  name,
  product_family,
  amount_min,
  amount_max,
  default_multiplier,
  requires_amount,
  requires_multiplier,
  requires_company_valuation,
  requires_country
)
values
  (
    'prestamo_participativo',
    'Prestamo Participativo',
    'loan',
    100000,
    3500000,
    null,
    true,
    false,
    false,
    false
  ),
  (
    'franquicia',
    'Franquicia',
    'franchise',
    null,
    null,
    1.5,
    false,
    true,
    true,
    true
  )
on conflict (code) do update
set
  name = excluded.name,
  product_family = excluded.product_family,
  amount_min = excluded.amount_min,
  amount_max = excluded.amount_max,
  default_multiplier = excluded.default_multiplier,
  requires_amount = excluded.requires_amount,
  requires_multiplier = excluded.requires_multiplier,
  requires_company_valuation = excluded.requires_company_valuation,
  requires_country = excluded.requires_country,
  active = true,
  updated_at = now();

grant usage on schema dim to authenticated, service_role;
grant select, insert, update, delete on dim.product to authenticated, service_role;

drop table if exists sourcecrm.deals cascade;
