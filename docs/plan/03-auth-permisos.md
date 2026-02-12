# 03 - Auth y Permisos

## Autenticación
- Login por `email + contraseña` para todos los usuarios.
- Recuperación de contraseña.
- Sesión obligatoria para acceder al CRM.

## Roles
- `admin`: gestión de usuarios y permisos, acceso total.
- `manager`: operación avanzada según permisos asignados.
- `user`: operación diaria sobre su scope.

## Flag de visibilidad global
- Campo: `can_view_global_dashboard` (boolean).
- `true`: acceso a dashboard general.
- `false`: sin acceso al dashboard general, solo dashboard personal.

## Matriz de permisos UI/API
### Dashboard
- General: requiere sesión + `can_view_global_dashboard=true`.
- Personal: requiere sesión.

### Operación CRM
- Listar/editar fondos y contactos: según rol.
- Cambios de permisos: solo `admin`.

### Import/Export
- Importación: usuarios operativos permitidos.
- Exportación: usuarios permitidos por rol/política.

## Auditoría
Registrar en `audit_logs`:
- Cambio de rol.
- Cambio de `can_view_global_dashboard`.
- Activación/desactivación de usuarios.

## Reglas de seguridad
- Validar autorización en backend (no solo UI).
- Middleware para proteger rutas.
- Registro de intentos de acceso denegado en logs operativos.

## Change Log
- 2026-02-12: Documento inicial aprobado.

