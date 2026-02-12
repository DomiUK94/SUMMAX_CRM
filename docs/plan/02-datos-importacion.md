# 02 - Datos e Importación

## Modelo de datos
Tablas principales del MVP:
- `users`
- `investors`
- `contacts`
- `status_catalog`
- `comments`
- `status_events`
- `import_batches`
- `import_rows_raw`
- `audit_logs`
- `activities` (opcional por feature flag)

## Esquema lógico resumido
- `users`: identidad, rol, flags de permisos.
- `investors`: entidad fondo/inversor.
- `contacts`: persona asociada a `investor`.
- `status_catalog`: estados configurables por scope (`investor` o `contact`).
- `status_events`: historial de cambios de estado.
- `comments`: comentarios libres por entidad.
- `import_batches`: ejecución de cada import.
- `import_rows_raw`: preservación de fila original y fila normalizada.
- `audit_logs`: trazabilidad de cambios críticos (permisos/config).
- `activities`: feed opcional de actividad operativa.

## Reglas de normalización
- Normalización textual: trim, colapso de espacios, casefold para matching.
- Normalización de URL: extraer dominio para dedupe.
- Normalización email/teléfono: formato consistente cuando sea posible.
- Campos no mapeables: conservar en `raw_payload_json` y `notes`.

## Reglas de deduplicación
### Fondos / inversores
1. Clave primaria: `normalize(name) + normalize(domain(website))`.
2. Fallback: `normalize(name) + category`.
3. En merge: conservar valor más completo y registrar fuentes (`sheet`, `row`).

### Contactos
1. Clave primaria: `normalize(email)`.
2. Fallback: `normalize(full_name) + investor_id`.
3. En conflicto: mantener dato más fiable y trazar resolución.

## Estrategia de importación `.xlsx`
- Parser flexible para hojas heterogéneas.
- Detección de cabecera real en primeras filas por matching semántico.
- Mapeo a esquema canónico.
- Guardado dual:
  - Registro consolidado (`investors`, `contacts`).
  - Registro fuente (`import_rows_raw`) sin pérdida.
- Errores parciales no bloquean batch completo.

## Estrategia de importación `.csv`
- CSV canónico con cabecera fija.
- Flujo asíncrono con progreso.
- Procesamiento en chunks para estabilidad.
- UPSERT por lotes para rendimiento y consistencia.

## Criterios de rendimiento MVP
- Volumen objetivo: hasta `10k` filas por importación CSV canónica.
- Objetivo operativo: import estable y relativamente rápida sin complejidad excesiva.
- Progreso visible con estado de job (`queued`, `processing`, `completed`, `failed`).

## Change Log
- 2026-02-12: Documento inicial aprobado.

