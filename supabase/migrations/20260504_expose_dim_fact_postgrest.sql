alter role authenticator set pgrst.db_schemas = 'public, graphql_public, sourcecrm, dim, fact';

grant usage on schema sourcecrm to authenticated, service_role;
grant usage on schema dim to authenticated, service_role;
grant usage on schema fact to authenticated, service_role;

grant select on sourcecrm.inversion to authenticated, service_role;
grant select on sourcecrm.contactos to authenticated, service_role;
grant select on sourcecrm.sector to authenticated, service_role;
grant select on sourcecrm.tipo_fondo to authenticated, service_role;
grant select on sourcecrm.mapa_area_geografica to authenticated, service_role;
grant select on sourcecrm.entity_notes to authenticated, service_role;
grant select on sourcecrm.entity_files to authenticated, service_role;
grant select on sourcecrm.leads to authenticated, service_role;
grant select on sourcecrm.opportunities to authenticated, service_role;
grant select on sourcecrm.prospects to authenticated, service_role;
grant select on sourcecrm.prospect_tasks to authenticated, service_role;

grant select on dim.product to authenticated, service_role;
grant select on dim.state to authenticated, service_role;
grant select on dim.task to authenticated, service_role;
grant select on fact.pipeline_event to authenticated, service_role;

alter table sourcecrm.inversion enable row level security;
alter table sourcecrm.contactos enable row level security;
alter table sourcecrm.sector enable row level security;
alter table sourcecrm.tipo_fondo enable row level security;
alter table sourcecrm.mapa_area_geografica enable row level security;
alter table sourcecrm.entity_notes enable row level security;
alter table sourcecrm.entity_files enable row level security;
alter table sourcecrm.leads enable row level security;
alter table sourcecrm.opportunities enable row level security;
alter table sourcecrm.prospects enable row level security;
alter table sourcecrm.prospect_tasks enable row level security;

drop policy if exists "active users read inversion" on sourcecrm.inversion;
create policy "active users read inversion"
  on sourcecrm.inversion
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users read contactos" on sourcecrm.contactos;
create policy "active users read contactos"
  on sourcecrm.contactos
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users read sector" on sourcecrm.sector;
create policy "active users read sector"
  on sourcecrm.sector
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users read tipo fondo" on sourcecrm.tipo_fondo;
create policy "active users read tipo fondo"
  on sourcecrm.tipo_fondo
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users read mapa area geografica" on sourcecrm.mapa_area_geografica;
create policy "active users read mapa area geografica"
  on sourcecrm.mapa_area_geografica
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users read entity notes" on sourcecrm.entity_notes;
create policy "active users read entity notes"
  on sourcecrm.entity_notes
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users read entity files" on sourcecrm.entity_files;
create policy "active users read entity files"
  on sourcecrm.entity_files
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users read leads" on sourcecrm.leads;
create policy "active users read leads"
  on sourcecrm.leads
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users read opportunities" on sourcecrm.opportunities;
create policy "active users read opportunities"
  on sourcecrm.opportunities
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users read prospects" on sourcecrm.prospects;
create policy "active users read prospects"
  on sourcecrm.prospects
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users read prospect tasks" on sourcecrm.prospect_tasks;
create policy "active users read prospect tasks"
  on sourcecrm.prospect_tasks
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
