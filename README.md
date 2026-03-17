# SUMMAX CRM

CRM interno de SUMMAX para compañías, contactos y pipeline comercial.

## Estado actual
- Auth con Supabase y perfil interno de usuario.
- Gestión de contactos y compañías.
- Pipeline de `Lead` y `Oportunidad`.
- Tareas comerciales con historial en `pipeline_event`.
- Tareas iniciales de prospección en `prospect_tasks`.
- Persistencia por usuario de columnas visibles en contactos, compañías y negocios.
- Importación desde Excel/CSV.
- Exportación CSV y búsqueda transversal.

## Setup local
1. Instala Node.js 20+.
2. Ejecuta `npm install`.
3. Crea `.env.local` con:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Aplica las migraciones de `supabase/migrations/` en orden.
5. Arranca con `npm run dev`.
6. Provisiona el primer admin CRM con `npm run security:provision-admin -- --email=tu.usuario@empresa.com`.

## Notas
- El acceso admin inicial ya no se concede en el login. Se provisiona de forma explícita con `npm run security:provision-admin`.
- Las rutas protegidas redirigen a `/login` si no hay sesión.
- La tabla `saved_views` ya no expone UI de vistas guardadas; solo conserva la preferencia técnica `__columns__` por usuario y módulo.
- Scripts SQL auxiliares:
  - `supabase/scripts/sourcecrm_truncate.sql`
  - `supabase/scripts/drop_legacy_investors_contacts.sql`
  - `supabase/scripts/load_sourcecrm_from_excel.sql`
