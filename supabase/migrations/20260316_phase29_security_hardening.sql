create extension if not exists pgcrypto;

create or replace function sourcecrm.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = sourcecrm, auth, public
as $$
  select exists (
    select 1
    from sourcecrm.users
    where id = auth.uid()
      and is_active = true
  );
$$;

create or replace function sourcecrm.current_user_role()
returns text
language sql
stable
security definer
set search_path = sourcecrm, auth, public
as $$
  select role
    from sourcecrm.users
   where id = auth.uid()
     and is_active = true
   limit 1;
$$;

create or replace function sourcecrm.current_user_is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = sourcecrm, auth, public
as $$
  select sourcecrm.current_user_role() in ('admin', 'manager');
$$;

grant execute on function sourcecrm.current_user_is_active() to authenticated, service_role;
grant execute on function sourcecrm.current_user_role() to authenticated, service_role;
grant execute on function sourcecrm.current_user_is_manager_or_admin() to authenticated, service_role;

revoke usage on schema sourcecrm from anon;
revoke usage on schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all tables in schema sourcecrm from authenticated;
revoke all on all tables in schema dim from authenticated;
revoke all on all tables in schema fact from authenticated;

grant usage on schema public to authenticated, service_role;
grant usage on schema sourcecrm to authenticated, service_role;
grant usage on schema dim to authenticated, service_role;
grant usage on schema fact to authenticated, service_role;

grant select on dim.product to authenticated, service_role;
grant select on dim.state to authenticated, service_role;
grant select on dim.task to authenticated, service_role;

grant select, insert on sourcecrm.pipeline_event to authenticated, service_role;
grant execute on function sourcecrm.pipeline_convert_lead_to_opportunity(uuid, uuid, uuid, text, uuid, text, uuid, text, numeric, text, timestamptz) to authenticated, service_role;
grant execute on function sourcecrm.pipeline_complete_task(text, uuid, uuid, uuid, uuid, text, text, timestamptz) to authenticated, service_role;
grant execute on function sourcecrm.pipeline_change_state(text, uuid, uuid, uuid, uuid, text, text, timestamptz) to authenticated, service_role;

grant select on sourcecrm.users to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.inversion to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.contactos to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.saved_views to authenticated, service_role;
grant select, insert on sourcecrm.audit_log to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.tags to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.entity_tags to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.suggestions to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.suggestion_events to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.deals to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.leads to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.opportunities to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.entity_files to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.draft_files to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.prospect_tasks to authenticated, service_role;
grant select, insert, update, delete on sourcecrm.prospects to authenticated, service_role;

alter table sourcecrm.users enable row level security;
alter table sourcecrm.inversion enable row level security;
alter table sourcecrm.contactos enable row level security;
alter table sourcecrm.saved_views enable row level security;
alter table sourcecrm.audit_log enable row level security;
alter table sourcecrm.tags enable row level security;
alter table sourcecrm.entity_tags enable row level security;
alter table sourcecrm.suggestions enable row level security;
alter table sourcecrm.suggestion_events enable row level security;
alter table sourcecrm.deals enable row level security;
alter table sourcecrm.leads enable row level security;
alter table sourcecrm.opportunities enable row level security;
alter table sourcecrm.entity_files enable row level security;
alter table sourcecrm.draft_files enable row level security;
alter table sourcecrm.prospect_tasks enable row level security;
alter table sourcecrm.prospects enable row level security;

drop policy if exists "crm users can read users" on sourcecrm.users;
create policy "crm users can read users"
  on sourcecrm.users
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users manage inversion" on sourcecrm.inversion;
create policy "active users manage inversion"
  on sourcecrm.inversion
  for all
  to authenticated
  using (sourcecrm.current_user_is_active())
  with check (sourcecrm.current_user_is_active());

drop policy if exists "active users manage contactos" on sourcecrm.contactos;
create policy "active users manage contactos"
  on sourcecrm.contactos
  for all
  to authenticated
  using (sourcecrm.current_user_is_active())
  with check (sourcecrm.current_user_is_active());

drop policy if exists "active users manage own saved views" on sourcecrm.saved_views;
create policy "active users manage own saved views"
  on sourcecrm.saved_views
  for all
  to authenticated
  using (sourcecrm.current_user_is_active() and user_id = auth.uid())
  with check (sourcecrm.current_user_is_active() and user_id = auth.uid());

drop policy if exists "active users read audit log" on sourcecrm.audit_log;
create policy "active users read audit log"
  on sourcecrm.audit_log
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users insert audit log" on sourcecrm.audit_log;
create policy "active users insert audit log"
  on sourcecrm.audit_log
  for insert
  to authenticated
  with check (sourcecrm.current_user_is_active() and changed_by_user_id = auth.uid());

drop policy if exists "active users manage tags" on sourcecrm.tags;
create policy "active users manage tags"
  on sourcecrm.tags
  for all
  to authenticated
  using (sourcecrm.current_user_is_active())
  with check (sourcecrm.current_user_is_active());

drop policy if exists "active users manage entity tags" on sourcecrm.entity_tags;
create policy "active users manage entity tags"
  on sourcecrm.entity_tags
  for all
  to authenticated
  using (sourcecrm.current_user_is_active())
  with check (sourcecrm.current_user_is_active());

drop policy if exists "active users manage suggestions" on sourcecrm.suggestions;
create policy "active users manage suggestions"
  on sourcecrm.suggestions
  for all
  to authenticated
  using (sourcecrm.current_user_is_active())
  with check (sourcecrm.current_user_is_active());

drop policy if exists "active users manage suggestion events" on sourcecrm.suggestion_events;
create policy "active users manage suggestion events"
  on sourcecrm.suggestion_events
  for all
  to authenticated
  using (sourcecrm.current_user_is_active())
  with check (sourcecrm.current_user_is_active());

drop policy if exists "active users manage deals" on sourcecrm.deals;
create policy "active users manage deals"
  on sourcecrm.deals
  for all
  to authenticated
  using (sourcecrm.current_user_is_active())
  with check (sourcecrm.current_user_is_active());

drop policy if exists "active users manage leads" on sourcecrm.leads;
create policy "active users manage leads"
  on sourcecrm.leads
  for all
  to authenticated
  using (sourcecrm.current_user_is_active())
  with check (sourcecrm.current_user_is_active());

drop policy if exists "active users manage opportunities" on sourcecrm.opportunities;
create policy "active users manage opportunities"
  on sourcecrm.opportunities
  for all
  to authenticated
  using (sourcecrm.current_user_is_active())
  with check (sourcecrm.current_user_is_active());

drop policy if exists "active users manage entity files" on sourcecrm.entity_files;
create policy "active users manage entity files"
  on sourcecrm.entity_files
  for all
  to authenticated
  using (sourcecrm.current_user_is_active())
  with check (sourcecrm.current_user_is_active());

drop policy if exists "managers manage draft files" on sourcecrm.draft_files;
create policy "managers manage draft files"
  on sourcecrm.draft_files
  for all
  to authenticated
  using (sourcecrm.current_user_is_manager_or_admin())
  with check (sourcecrm.current_user_is_manager_or_admin());

drop policy if exists "active users manage prospect tasks" on sourcecrm.prospect_tasks;
create policy "active users manage prospect tasks"
  on sourcecrm.prospect_tasks
  for all
  to authenticated
  using (sourcecrm.current_user_is_active())
  with check (sourcecrm.current_user_is_active());

drop policy if exists "active users manage prospects" on sourcecrm.prospects;
create policy "active users manage prospects"
  on sourcecrm.prospects
  for all
  to authenticated
  using (sourcecrm.current_user_is_active())
  with check (sourcecrm.current_user_is_active());

insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-drafts', 'crm-drafts', false, 26214400)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

update sourcecrm.draft_files
   set storage_bucket = 'crm-drafts'
 where storage_bucket <> 'crm-drafts';

update storage.objects
   set bucket_id = 'crm-drafts'
 where bucket_id = 'crm-files'
   and name like 'drafts/%';

drop policy if exists "Authenticated users can read CRM files" on storage.objects;
drop policy if exists "Authenticated users can upload CRM files" on storage.objects;
drop policy if exists "Authenticated users can update CRM files" on storage.objects;
drop policy if exists "Authenticated users can delete CRM files" on storage.objects;

drop policy if exists "active users can read entity files" on storage.objects;
create policy "active users can read entity files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'crm-files' and sourcecrm.current_user_is_active());

drop policy if exists "active users can upload entity files" on storage.objects;
create policy "active users can upload entity files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'crm-files' and sourcecrm.current_user_is_active());

drop policy if exists "active users can update entity files" on storage.objects;
create policy "active users can update entity files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'crm-files' and sourcecrm.current_user_is_active())
  with check (bucket_id = 'crm-files' and sourcecrm.current_user_is_active());

drop policy if exists "active users can delete entity files" on storage.objects;
create policy "active users can delete entity files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'crm-files' and sourcecrm.current_user_is_active());

drop policy if exists "managers can read draft files" on storage.objects;
create policy "managers can read draft files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'crm-drafts' and sourcecrm.current_user_is_manager_or_admin());

drop policy if exists "managers can upload draft files" on storage.objects;
create policy "managers can upload draft files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'crm-drafts' and sourcecrm.current_user_is_manager_or_admin());

drop policy if exists "managers can update draft files" on storage.objects;
create policy "managers can update draft files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'crm-drafts' and sourcecrm.current_user_is_manager_or_admin())
  with check (bucket_id = 'crm-drafts' and sourcecrm.current_user_is_manager_or_admin());

drop policy if exists "managers can delete draft files" on storage.objects;
create policy "managers can delete draft files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'crm-drafts' and sourcecrm.current_user_is_manager_or_admin());
