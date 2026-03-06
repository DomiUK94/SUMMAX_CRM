# ChangeLog

Este archivo resume los cambios de la aplicacion por dia.

## Formato recomendado

```md
## YYYY-MM-DD
- Resumen: texto corto de alto nivel.
- Modulos:
  - Modulo A: cambios clave.
  - Modulo B: cambios clave.
- Tecnico:
  - Archivos/API/migraciones afectadas.
```

## 2026-02-20
- Resumen: correccion de tildes y caracteres mal codificados (mojibake) en Contactos.
- Modulos:
  - Contactos:
    - Textos con acentos corregidos en listado y detalle (`información`, `acción`, `teléfono`, `compañía`, etc.).
    - Símbolos corruptos reemplazados (incluyendo separadores y el icono del menú de acciones).
- Tecnico:
  - `src/components/contacts-table.tsx`
  - `src/app/contacts/[id]/page.tsx`

## 2026-02-20
- Resumen: correccion del conteo/filtro `Sin web` en Cuentas.
- Modulos:
  - Cuentas:
    - El calculo de `Sin web` ahora trata como sin web valores placeholder (`-`, `--`, `n/a`, `sin web`, etc.).
    - Se unifica criterio para badge y listado filtrado.
- Tecnico:
  - `src/components/investors-table.tsx`

## 2026-02-20
- Resumen: rediseño completo de `Mi cuenta` con look de desktop app moderna.
- Modulos:
  - Mi cuenta:
    - Nueva cabecera tipo hero con estado de usuario y badges de rol/permisos.
    - Nueva composicion en grid de 2 paneles (Perfil | Seguridad y acceso).
    - Formularios y metadatos reorganizados para mejor jerarquia visual.
    - Mensajes de error y exito de password con texto mas claro.
- Tecnico:
  - `src/app/mi-cuenta/page.tsx`
  - `src/app/globals.css`

## 2026-02-20
- Resumen: reposicionamiento del boton de asignacion multiple en Contactos.
- Modulos:
  - Contactos:
    - `Asignar multiples contactos` subido a la misma linea que los filtros rapidos (`Todos`, `Requieren accion`, `Criticos +14 dias`).
    - Mantiene estilo con borde amarillo.
- Tecnico:
  - `src/components/contacts-table.tsx`

## 2026-02-20
- Resumen: ajuste fino del boton de asignacion multiple en Contactos.
- Modulos:
  - Contactos:
    - El boton `Asignar multiples contactos` mantiene estilo general y solo destaca con borde amarillo.
- Tecnico:
  - `src/app/globals.css`

## 2026-02-20
- Resumen: ajuste visual del disparador de asignacion masiva en Contactos.
- Modulos:
  - Contactos:
    - Boton `Asignar multiples contactos` movido a la derecha.
    - Nuevo estilo pequeno con tono amarillo/naranja.
- Tecnico:
  - `src/components/contacts-table.tsx`
  - `src/app/globals.css`

## 2026-02-20
- Resumen: rediseño del selector de vistas en Sugerencias, Bugs y Notas.
- Modulos:
  - Sugerencias, Bugs y Notas:
    - Eliminadas las pestañas: `Mis Sugerencias`, `Mis Sugerencias cerradas`, `Todas las Sugerencias`.
    - Nuevo botón desplegable `Vista Personalizada`.
    - Nuevas opciones:
      - Mis Sugerencias cerradas
      - Todas las Sugerencias
      - Mis Notas cerradas
      - Todas las Notas
      - Mis Bugs cerrados
      - Todos los Bugs
- Tecnico:
  - `src/app/sugerencias/page.tsx`

## 2026-02-20
- Resumen: correccion en Cuentas para que "Editar columnas" funcione tambien en vista Panel.
- Modulos:
  - Cuentas:
    - Las tarjetas del modo Panel ahora renderizan segun las columnas activadas.
    - Si se desactiva una columna, deja de mostrarse en la tarjeta.
- Tecnico:
  - `src/components/investors-table.tsx`

## 2026-02-20
- Resumen: el bloque de acciones de vista pasa a menu desplegable de engranaje en la misma linea del buscador.
- Modulos:
  - Contactos, Cuentas, Negocios, Actividades:
    - Engranaje con flecha (`⚙ ▾`) como desplegable.
    - Menu con acciones: Guardar vista, Eliminar vista y Exportar.
    - Alineado en la misma linea de barra de busqueda y bloque `Vista`.
- Tecnico:
  - `src/components/contacts-table.tsx`
  - `src/components/investors-table.tsx`
  - `src/components/deals-board.tsx`
  - `src/components/activities-table.tsx`
  - `src/app/globals.css`

## 2026-02-20
- Resumen: mejora UX en asignacion masiva de propietario en Contactos.
- Modulos:
  - Contactos:
    - El bloque de bulk asignar pasa a flujo desplegable.
    - Nuevo boton: "Asignar multiples contactos".
    - Al abrir: muestra seleccionados, dropdown de propietario y accion de asignacion.
- Tecnico:
  - `src/components/contacts-table.tsx`

## 2026-02-20
- Resumen: ajuste de nomenclatura en Contactos para usar "Propietario" en lugar de "Owner".
- Modulos:
  - Contactos:
    - "Asignar owner..." -> "Asignar propietario...".
    - "Owner:" -> "Propietario:" en timeline.
    - "Sin owner" -> "Sin propietario" en selector y vista.
    - Mensaje de error de asignacion actualizado a "No se pudo asignar propietario".
- Tecnico:
  - `src/components/contacts-table.tsx`

## 2026-02-20
- Resumen: ajuste visual de barras de herramientas en vistas CRM para compactar la configuracion.
- Modulos:
  - Contactos, Cuentas, Negocios, Actividades:
    - El titulo de "Configuracion" se reemplaza por icono de engranaje.
    - El bloque de configuracion pasa a la derecha y debajo de "Vista".
    - Los 4 botones de acciones quedan en rejilla 2x2 (dos arriba, dos abajo).
- Tecnico:
  - `src/components/contacts-table.tsx`
  - `src/components/investors-table.tsx`
  - `src/components/deals-board.tsx`
  - `src/components/activities-table.tsx`
  - `src/app/globals.css`

## 2026-02-20
- Resumen: mejoras de CRM en navegacion, usabilidad y control de acceso.
- Modulos:
  - Contactos:
    - Boton renombrado a "Posibles duplicados" con estilo de texto rojizo.
    - Seccion de duplicados operativa.
  - Listados CRM (Contactos, Cuentas, Negocios, Actividades):
    - Barra separada en secciones "Vista" y "Configuracion".
    - Opciones de configuracion: Editar columnas, Guardar vista, Eliminar vista, Exportar.
  - Reporte financiacion:
    - Agregado campo "Monto estimado" por fila.
    - El total superior ahora usa "Monto estimado total".
    - Eliminados del resumen: suma minima, suma maxima y rango.
  - Mi cuenta:
    - Correccion de textos: "contrasena" a "contraseña".
  - Seguridad y permisos:
    - Importaciones y Exportaciones restringidas solo a Admin (menu, paginas y APIs).
- Tecnico:
  - UI principal:
    - `src/components/contacts-table.tsx`
    - `src/components/investors-table.tsx`
    - `src/components/deals-board.tsx`
    - `src/components/activities-table.tsx`
    - `src/components/app-shell.tsx`
    - `src/app/globals.css`
  - Rutas/paginas:
    - `src/app/contacts/page.tsx`
    - `src/app/reporte-financiacion/page.tsx`
    - `src/app/mi-cuenta/page.tsx`
    - `src/app/imports/page.tsx`
    - `src/app/exports/page.tsx`
  - APIs:
    - `src/app/api/imports/route.ts`
    - `src/app/api/imports/status/route.ts`
    - `src/app/api/exports/csv/route.ts`

## 2026-02-20
- Resumen: mejoras fuertes en el modulo de Sugerencias, Bugs y Notas para trazabilidad, accesibilidad y operativa diaria.
- Modulos:
  - Sugerencias, Bugs y Notas:
    - `Prioridad` e `Impacto` pasan a columnas reales de BD.
    - Eliminado `Modulo` del flujo de alta.
    - Tabs secundarios unificados con el mismo estilo visual que tabs principales.
    - Chips de color para `Estado`, `Prioridad` e `Impacto` en listado y detalle.
    - Ordenacion util: por defecto `Prioridad DESC` y despues `Ultima actividad DESC`.
    - Ordenacion clicable desde cabeceras (`Prioridad`, `Ultima actividad`).
    - Acciones en lote solo para admin: cerrar, cambiar estado y etiquetar.
    - Plantillas rapidas de creacion por tipo (`mejora`, `bug`, `nota`).
    - Reapertura obligando motivo cuando una entrada cerrada pasa a estado abierto.
  - ChangeLog:
    - Seccion automatica de versiones generada desde sugerencias resueltas.
- Tecnico:
  - UI/paginas:
    - `src/app/sugerencias/page.tsx`
    - `src/app/sugerencias/[id]/page.tsx`
    - `src/app/changelog/page.tsx`
    - `src/app/globals.css`
  - Migraciones:
    - `supabase/migrations/20260220_phase12_suggestions_priority_impact.sql`
    - `supabase/migrations/20260220_phase13_suggestions_tags.sql`
