create extension if not exists pgcrypto;

create table if not exists sourcecrm.entity_files (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('contact', 'investor')),
  entity_id text not null,
  file_name text not null,
  storage_bucket text not null default 'crm-files',
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  uploaded_by_user_id uuid references sourcecrm.users(id) on delete set null,
  uploaded_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sourcecrm_entity_files_entity
  on sourcecrm.entity_files(entity_type, entity_id, created_at desc);

create index if not exists idx_sourcecrm_entity_files_uploaded_by
  on sourcecrm.entity_files(uploaded_by_user_id, created_at desc);

grant select, insert, update, delete on sourcecrm.entity_files to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-files', 'crm-files', false, 26214400)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Authenticated users can read CRM files" on storage.objects;
create policy "Authenticated users can read CRM files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'crm-files');

drop policy if exists "Authenticated users can upload CRM files" on storage.objects;
create policy "Authenticated users can upload CRM files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'crm-files');

drop policy if exists "Authenticated users can update CRM files" on storage.objects;
create policy "Authenticated users can update CRM files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'crm-files')
  with check (bucket_id = 'crm-files');

drop policy if exists "Authenticated users can delete CRM files" on storage.objects;
create policy "Authenticated users can delete CRM files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'crm-files');
