create extension if not exists pgcrypto;

create table if not exists sourcecrm.draft_files (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_bucket text not null default 'crm-files',
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  uploaded_by_user_id uuid references sourcecrm.users(id) on delete set null,
  uploaded_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sourcecrm_draft_files_created_at
  on sourcecrm.draft_files(created_at desc);

create index if not exists idx_sourcecrm_draft_files_uploaded_by
  on sourcecrm.draft_files(uploaded_by_user_id, created_at desc);

grant select, insert, update, delete on sourcecrm.draft_files to authenticated, service_role;
