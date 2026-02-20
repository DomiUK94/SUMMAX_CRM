-- Fase 9: productividad CRM (vistas guardadas, auditoria, tags, duplicados, busqueda)

create table if not exists sourcecrm.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references sourcecrm.users(id) on delete cascade,
  module text not null check (module in ('contacts', 'investors', 'deals', 'activities')),
  name text not null,
  filters_json jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_views_user_module on sourcecrm.saved_views(user_id, module, updated_at desc);
create unique index if not exists ux_saved_views_user_module_name on sourcecrm.saved_views(user_id, module, lower(name));

create table if not exists sourcecrm.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('contact', 'investor', 'deal', 'activity', 'saved_view', 'tag')),
  entity_id text not null,
  action text not null check (action in ('create', 'update', 'delete', 'merge', 'assign', 'status_change')),
  field text,
  old_value text,
  new_value text,
  changed_by_user_id uuid not null references sourcecrm.users(id) on delete restrict,
  changed_by_email text not null,
  changed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_audit_log_entity on sourcecrm.audit_log(entity_type, entity_id, changed_at desc);
create index if not exists idx_audit_log_changed_by on sourcecrm.audit_log(changed_by_user_id, changed_at desc);

create table if not exists sourcecrm.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#0f97af',
  created_by_user_id uuid references sourcecrm.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_tags_name on sourcecrm.tags(lower(name));

create table if not exists sourcecrm.entity_tags (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('contact', 'investor', 'deal', 'activity')),
  entity_id text not null,
  tag_id uuid not null references sourcecrm.tags(id) on delete cascade,
  created_by_user_id uuid references sourcecrm.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists ux_entity_tags_unique on sourcecrm.entity_tags(entity_type, entity_id, tag_id);
create index if not exists idx_entity_tags_entity on sourcecrm.entity_tags(entity_type, entity_id);

create index if not exists idx_contactos_email on sourcecrm.contactos(email);
create index if not exists idx_contactos_telefono on sourcecrm.contactos(telefono);
create index if not exists idx_contactos_persona_contacto on sourcecrm.contactos(persona_contacto);
create index if not exists idx_contactos_owner_user_id on sourcecrm.contactos(owner_user_id);
create index if not exists idx_inversion_compania on sourcecrm.inversion(compania);
create index if not exists idx_activities_title on sourcecrm.activities(title);

grant select, insert, update, delete on sourcecrm.saved_views to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.audit_log to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.tags to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.entity_tags to authenticated, service_role;
