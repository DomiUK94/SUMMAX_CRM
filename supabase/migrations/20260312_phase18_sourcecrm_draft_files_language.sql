alter table sourcecrm.draft_files
  add column if not exists language text not null default 'es';

alter table sourcecrm.draft_files
  drop constraint if exists draft_files_language_check;

alter table sourcecrm.draft_files
  add constraint draft_files_language_check
  check (language in ('es', 'en'));

create index if not exists idx_sourcecrm_draft_files_language
  on sourcecrm.draft_files(language, created_at desc);
