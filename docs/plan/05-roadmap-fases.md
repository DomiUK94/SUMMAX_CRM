# 05 - Roadmap por Fases

## Secuencia de implementación
1. Setup + auth/permisos.
2. Esquema de datos y migraciones.
3. Importador Excel (prioridad archivo del repo).
4. CRUD de fondos/contactos + estados + comentarios.
5. Dashboard general + dashboard personal.
6. Alta manual guiada.
7. Importador CSV asíncrono con progreso.
8. Export CSV general y detallado.
9. Hardening + QA.

## Entregables por fase
### Fase 1
- Proyecto base, auth funcional, middleware y roles.

### Fase 2
- Tablas base y relaciones validadas.

### Fase 3
- Pipeline de importación `.xlsx` robusto y trazable.

### Fase 4
- Operación CRM completa en fondos/contactos.

### Fase 5
- Vistas de seguimiento global y personal.

### Fase 6
- Formulario guiado para altas manuales.

### Fase 7
- Importación CSV canónica asíncrona.

### Fase 8
- Descarga de reportes general/detallado.

### Fase 9
- Calidad, seguridad, performance y cierre MVP.

## Dependencias clave
- Fase 3 depende de Fase 2.
- Fases 4 y 5 dependen de Fase 2 (y parcialmente de 3).
- Fase 8 depende de Fases 4 y 5.

## Change Log
- 2026-02-12: Documento inicial aprobado.

