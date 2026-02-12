# SUMMAX CRM

CRM interno para gestion de fondos/inversores y contactos.

## Estado implementado
- Auth con email/password (Supabase) y perfil de usuario interno.
- Permisos con rol y flag `can_view_global_dashboard`.
- Dashboard personal y dashboard general (restringido por flag).
- CRUD base de fondos/contactos.
- Comentarios por fondo/contacto.
- Cambio de estado en contacto con historial.
- Importacion de `.xlsx` (prioridad) y `.csv` canonico.
- Export CSV general y detallado.
- UX desktop-only (`>=1280px`).
- Plan funcional documentado en `docs/plan/`.

## Setup local
1. Instala Node.js 20+.
2. Ejecuta `npm install`.
3. Copia `.env.example` a `.env.local` y completa:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (si la usas en admin scripts)
4. Aplica migraciones SQL:
   - `supabase/migrations/20260212_phase1_auth.sql`
   - `supabase/migrations/20260212_phase2_core.sql`
5. Arranca desarrollo con `npm run dev`.

## Notas
- El primer usuario que haga login se promueve automaticamente a `admin` y obtiene acceso al dashboard general.
- Si no hay sesion, las rutas protegidas redirigen a `/login`.

