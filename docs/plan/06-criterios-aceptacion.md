# 06 - Criterios de Aceptación

## Casos funcionales
- Login/logout correcto.
- CRUD de fondos/contactos funcional.
- Cambio de estado y comentarios persistidos.
- Dashboards con datos consistentes.
- Exportación general/detallada operativa.

## Casos de permisos
- Usuario sin sesión: acceso denegado.
- Usuario sin flag global: sin acceso dashboard general.
- Admin puede cambiar permisos y queda auditado.

## Validación importación Excel (archivo del repo)
- Se procesa el archivo `260211 Mapping SUMMAX lista larga FINAL CC-BR.xlsx`.
- Se conserva trazabilidad completa por fila en `import_rows_raw`.
- Errores parciales no bloquean importación total.

## Validación dedupe y trazabilidad
- Duplicados identificados según reglas definidas.
- Fusiones registradas con origen de datos.
- Posibilidad de revisar cómo se resolvió cada merge.

## Validación dashboards y pendientes
- Dashboard general muestra KPIs y pendientes críticos.
- Dashboard personal muestra cartera del usuario.
- Priorización por reglas operativas visible.

## Validación exportaciones
- CSV general: dataset consolidado y filtrable.
- CSV detallado: incluye detalle de contactos y seguimiento.

## Checklist final MVP
- [ ] Seguridad básica validada.
- [ ] Importación Excel prioritaria estable.
- [ ] Operación CRM diaria cubierta.
- [ ] Dashboard general/personal aprobados.
- [ ] Exportaciones verificadas.
- [ ] Auditoría de permisos activa.

## Change Log
- 2026-02-12: Documento inicial aprobado.

