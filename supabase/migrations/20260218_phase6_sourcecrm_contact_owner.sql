-- Fase 6: owner de contactos para filtros operativos en UI.

alter table sourcecrm.contactos
  add column if not exists owner_user_id uuid,
  add column if not exists owner_email text;

create index if not exists idx_sourcecrm_contactos_owner_user_id on sourcecrm.contactos(owner_user_id);
