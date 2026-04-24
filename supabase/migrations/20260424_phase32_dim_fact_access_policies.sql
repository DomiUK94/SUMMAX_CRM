create schema if not exists sourcecrm;

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

grant execute on function sourcecrm.current_user_is_active() to authenticated, service_role;

grant usage on schema dim to authenticated, service_role;
grant usage on schema fact to authenticated, service_role;

grant select on dim.product to authenticated, service_role;
grant select on dim.state to authenticated, service_role;
grant select on dim.task to authenticated, service_role;
grant select, insert on fact.pipeline_event to authenticated, service_role;

alter table dim.product enable row level security;
alter table dim.state enable row level security;
alter table dim.task enable row level security;
alter table fact.pipeline_event enable row level security;

drop policy if exists "active users read products" on dim.product;
create policy "active users read products"
  on dim.product
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users read states" on dim.state;
create policy "active users read states"
  on dim.state
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users read tasks" on dim.task;
create policy "active users read tasks"
  on dim.task
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users read pipeline events" on fact.pipeline_event;
create policy "active users read pipeline events"
  on fact.pipeline_event
  for select
  to authenticated
  using (sourcecrm.current_user_is_active());

drop policy if exists "active users insert pipeline events" on fact.pipeline_event;
create policy "active users insert pipeline events"
  on fact.pipeline_event
  for insert
  to authenticated
  with check (sourcecrm.current_user_is_active());

create or replace function sourcecrm.current_user_can_view_global_dashboard()
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
      and can_view_global_dashboard = true
  );
$$;

grant execute on function sourcecrm.current_user_can_view_global_dashboard() to authenticated, service_role;

grant select on public.users to authenticated, service_role;

drop policy if exists "global dashboard users read public users" on public.users;
create policy "global dashboard users read public users"
  on public.users
  for select
  to authenticated
  using (sourcecrm.current_user_can_view_global_dashboard());

do $$
begin
  if to_regclass('public.nda_progress') is not null then
    grant select on public.nda_progress to authenticated, service_role;

    drop policy if exists "global dashboard users read nda progress" on public.nda_progress;
    create policy "global dashboard users read nda progress"
      on public.nda_progress
      for select
      to authenticated
      using (sourcecrm.current_user_can_view_global_dashboard());
  end if;

  if to_regclass('public.card_progress') is not null then
    grant select on public.card_progress to authenticated, service_role;

    drop policy if exists "global dashboard users read card progress" on public.card_progress;
    create policy "global dashboard users read card progress"
      on public.card_progress
      for select
      to authenticated
      using (sourcecrm.current_user_can_view_global_dashboard());
  end if;
end
$$;
