alter table sourcecrm.contactos
  add column if not exists es_financiador boolean not null default false,
  add column if not exists es_preescriptor boolean not null default false;
