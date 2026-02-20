-- Fase 4: grants para tablas public usadas por la app.

grant usage on schema public to anon, authenticated, service_role;

-- La app opera con sesiones autenticadas (sin service role en runtime),
-- por lo que necesita DML sobre tablas del schema public.
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;

-- Asegura que futuras tablas en public mantengan el mismo baseline de permisos.
alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated, service_role;
