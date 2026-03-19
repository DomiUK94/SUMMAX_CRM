import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/auth/permissions";
import { createSourceCrmAdminClient } from "@/lib/supabase/sourcecrm-admin";

type ExportTableKey = "inversion" | "contactos" | "prospects" | "leads" | "opportunities";
type TableConfig = {
  key: ExportTableKey;
  label: string;
  sheetName: string;
  select: string;
  searchFields: string[];
  supportsOwner: boolean;
  supportsResolution: boolean;
};

const MAX_EXPORT_ROWS = 20000;

const TABLE_CONFIGS: Record<ExportTableKey, TableConfig> = {
  inversion: {
    key: "inversion",
    label: "Companias",
    sheetName: "Companias",
    select: "company_id, vertical, compania, direccion, estrategia, linkedin, web, portfolio, comentarios, encaje_summax, motivo, inversion_minima, inversion_maxima, prioridad, sede, tamano_empresa, updated_at",
    searchFields: ["compania", "vertical", "estrategia", "comentarios", "web"],
    supportsOwner: false,
    supportsResolution: false
  },
  contactos: {
    key: "contactos",
    label: "Contactos",
    sheetName: "Contactos",
    select: "contact_id, company_id, compania, persona_contacto, rol, email, telefono, linkedin, comentarios, es_financiador, es_preescriptor, owner_email, updated_at",
    searchFields: ["persona_contacto", "compania", "email", "rol", "comentarios"],
    supportsOwner: true,
    supportsResolution: false
  },
  prospects: {
    key: "prospects",
    label: "Prospectos",
    sheetName: "Prospectos",
    select: "id, company_id, contact_id, owner_email, status, resolution, notes, opened_at, closed_at, updated_at",
    searchFields: ["owner_email", "status", "notes"],
    supportsOwner: true,
    supportsResolution: true
  },
  leads: {
    key: "leads",
    label: "Leads",
    sheetName: "Leads",
    select: "id, company_id, contact_id, name, owner_email, current_state_id, resolution, notes, opened_at, converted_at, closed_at, updated_at",
    searchFields: ["name", "owner_email", "notes"],
    supportsOwner: true,
    supportsResolution: true
  },
  opportunities: {
    key: "opportunities",
    label: "Opportunities",
    sheetName: "Opportunities",
    select: "id, lead_id, company_id, contact_id, product_id, name, owner_email, current_state_id, resolution, estimated_amount, closed_amount, notes, opened_at, closed_at, updated_at",
    searchFields: ["name", "owner_email", "notes"],
    supportsOwner: true,
    supportsResolution: true
  }
};

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    if (text.includes('"') || text.includes(",") || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  });
  return lines.join("\n");
}

function applySharedFilters(query: any, config: TableConfig, url: URL) {
  const q = url.searchParams.get("q")?.trim() ?? "";
  const ownerEmail = url.searchParams.get("owner_email")?.trim() ?? "";
  const resolution = url.searchParams.get("resolution")?.trim() ?? "";
  const updatedFrom = url.searchParams.get("updated_from")?.trim() ?? "";
  const updatedTo = url.searchParams.get("updated_to")?.trim() ?? "";

  let nextQuery = query;

  if (q && config.searchFields.length > 0) {
    nextQuery = nextQuery.or(config.searchFields.map((field) => `${field}.ilike.%${q}%`).join(","));
  }
  if (ownerEmail && config.supportsOwner) {
    nextQuery = nextQuery.ilike("owner_email", `%${ownerEmail}%`);
  }
  if (resolution && config.supportsResolution) {
    nextQuery = nextQuery.eq("resolution", resolution);
  }
  if (updatedFrom) {
    nextQuery = nextQuery.gte("updated_at", `${updatedFrom}T00:00:00`);
  }
  if (updatedTo) {
    nextQuery = nextQuery.lte("updated_at", `${updatedTo}T23:59:59.999`);
  }

  return nextQuery;
}

async function loadTableRows(config: TableConfig, url: URL) {
  const sourceCrm = createSourceCrmAdminClient();
  let query = sourceCrm.from(config.key).select(config.select).order("updated_at", { ascending: false }).limit(MAX_EXPORT_ROWS);
  query = applySharedFilters(query, config, url);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown) as Record<string, unknown>[];
}

function buildWorkbook(tableRows: Array<{ config: TableConfig; rows: Record<string, unknown>[] }>) {
  const workbook = XLSX.utils.book_new();

  tableRows.forEach(({ config, rows }) => {
    const normalizedRows = rows.length > 0 ? rows : [{ info: "Sin datos para los filtros seleccionados" }];
    const sheet = XLSX.utils.json_to_sheet(normalizedRows);
    XLSX.utils.book_append_sheet(workbook, sheet, config.sheetName.slice(0, 31));
  });

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export async function GET(request: Request) {
  const appUser = await getCurrentUser();
  if (!canManageUsers(appUser)) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "detail" ? "detail" : url.searchParams.get("mode") === "advanced" ? "advanced" : "general";

  if (mode === "advanced") {
    const selectedTables = Array.from(new Set(url.searchParams.getAll("table").filter((value): value is ExportTableKey => value in TABLE_CONFIGS)));
    if (selectedTables.length === 0) {
      return new NextResponse("Selecciona al menos una tabla para exportar.", { status: 400 });
    }

    const tableRows = await Promise.all(selectedTables.map(async (key) => ({ config: TABLE_CONFIGS[key], rows: await loadTableRows(TABLE_CONFIGS[key], url) })));
    const workbook = buildWorkbook(tableRows);

    return new NextResponse(workbook, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="summax-export-avanzado-${new Date().toISOString().slice(0, 10)}.xlsx"`
      }
    });
  }

  const sourceCrm = createSourceCrmAdminClient();

  if (mode === "detail") {
    const { data } = await sourceCrm
      .from("contactos")
      .select(TABLE_CONFIGS.contactos.select)
      .order("updated_at", { ascending: false })
      .limit(MAX_EXPORT_ROWS);

    const csv = toCsv(((data ?? []) as unknown) as Record<string, unknown>[]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="summax-detail-${new Date().toISOString().slice(0, 10)}.csv"`
      }
    });
  }

  const { data } = await sourceCrm
    .from("inversion")
    .select(TABLE_CONFIGS.inversion.select)
    .order("updated_at", { ascending: false })
    .limit(MAX_EXPORT_ROWS);

  const csv = toCsv(((data ?? []) as unknown) as Record<string, unknown>[]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="summax-general-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
