# 01 - Producto y Alcance

## Objetivo del CRM
Construir un CRM interno para SUMMAX que permita centralizar, limpiar, gestionar y accionar oportunidades de inversión (fondos e inversores) con trazabilidad completa desde archivo fuente.

## Alcance MVP
- Importación prioritaria del Excel del repositorio: `260211 Mapping SUMMAX lista larga FINAL CC-BR.xlsx`.
- Importación complementaria de CSV canónico con cabecera fija.
- Gestión de fondos e inversores con contactos vinculados.
- Dashboard general (global) y dashboard personal por usuario.
- Alta manual guiada de fondos/contactos.
- Exportación CSV general y detallada.
- Login por usuario y control de acceso por permisos.

## Fuera de alcance MVP (Fase 2+)
- Integraciones externas (email sync, calendario, webhooks complejos).
- Soporte móvil/responsive completo.
- Automatizaciones avanzadas de cadencias multi-canal.
- Multi-tenant (más de una empresa aislada).

## Requisitos cerrados
1. Import Excel del repo como prioridad.
2. Import CSV canónico como vía complementaria.
3. Dashboard general + dashboard personal.
4. Wizard para alta manual.
5. Export CSV general y CSV detallado.

## Defaults fijados
- Stack: `Next.js + Supabase + Vercel`.
- Tenant único interno.
- Owner opcional.
- Activity feed opcional por feature flag.
- Sin integraciones externas en MVP.

## Change Log
- 2026-02-12: Documento inicial aprobado.

