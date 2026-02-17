-- Fase 3: nuevo modelo CRM en schema sourcecrm basado en 260217 Mapping SUMMAX.xlsx

create schema if not exists sourcecrm;

create table if not exists sourcecrm.inversion (
  company_id bigint primary key,
  vertical text,
  compania text not null,
  direccion text,
  estrategia text,
  linkedin text,
  web text,
  portfolio text,
  comentarios text,
  encaje_summax text,
  motivo text,
  inversion_minima text,
  inversion_maxima text,
  prioridad text,
  sede text,
  tamano_empresa text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sourcecrm.contactos (
  contact_id bigint primary key,
  company_id bigint not null references sourcecrm.inversion(company_id) on delete cascade,
  compania text not null,
  persona_contacto text,
  rol text,
  otro_contacto text,
  telefono text,
  email text,
  linkedin text,
  comentarios text,
  prioritario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sourcecrm_contactos_company_id on sourcecrm.contactos(company_id);
create index if not exists idx_sourcecrm_contactos_email on sourcecrm.contactos(email);

create table if not exists sourcecrm.tipo_fondo (
  company_id bigint not null references sourcecrm.inversion(company_id) on delete cascade,
  tipo_fondo text not null,
  excepciones text,
  created_at timestamptz not null default now(),
  primary key (company_id, tipo_fondo)
);

create table if not exists sourcecrm.sector (
  company_id bigint not null references sourcecrm.inversion(company_id) on delete cascade,
  sector text not null,
  sector_consolidado text,
  created_at timestamptz not null default now(),
  primary key (company_id, sector)
);

create table if not exists sourcecrm.mapa_area_geografica (
  company_id bigint not null references sourcecrm.inversion(company_id) on delete cascade,
  area_geografica text not null,
  created_at timestamptz not null default now(),
  primary key (company_id, area_geografica)
);

grant usage on schema sourcecrm to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema sourcecrm to authenticated, service_role;

drop table if exists public.contacts cascade;
drop table if exists public.investors cascade;
