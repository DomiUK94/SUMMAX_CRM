update sourcecrm.contactos
set es_financiador = true
where es_financiador is distinct from true;

alter table sourcecrm.contactos
  alter column es_financiador set default true;
