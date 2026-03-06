import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type RowPayload = Record<string, string>;

function clean(v: unknown): string {
  return String(v ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normKey(v: unknown): string {
  return clean(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseIntOrNull(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toRecord(headers: string[], row: string[]): RowPayload {
  const payload: RowPayload = {};
  headers.forEach((h, i) => {
    payload[h] = row[i] ?? "";
  });
  return payload;
}

function getByAliases(payload: RowPayload, aliases: string[]): string {
  const normalized = new Map<string, string>();
  for (const [k, v] of Object.entries(payload)) {
    normalized.set(normKey(k), clean(v));
  }
  for (const alias of aliases) {
    const found = normalized.get(normKey(alias));
    if (found) return found;
  }
  return "";
}

function detectHeader(rows: string[][]): { index: number; headers: string[] } {
  const maxProbe = Math.min(rows.length, 12);
  let bestIdx = 0;
  let bestScore = -1;
  const keyTokens = [
    "company_id",
    "companyid",
    "compania",
    "contact_id",
    "tipo_fondo",
    "sector",
    "mercados_area_geografica"
  ];

  for (let i = 0; i < maxProbe; i += 1) {
    const rowKeys = (rows[i] ?? []).map((v) => normKey(v));
    const score = keyTokens.reduce((acc, token) => (rowKeys.some((k) => k.includes(normKey(token))) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return { index: bestIdx, headers: rows[bestIdx] ?? [] };
}

async function upsertInversion(payload: RowPayload, sheetName: string) {
  const db = createSourceCrmServerClient();
  const companyId = parseIntOrNull(getByAliases(payload, ["Company_ID", "CompanyID"]));
  if (!companyId) return { inserted: 0, merged: 0, warning: 1, error: 0 };

  const record = {
    company_id: companyId,
    vertical: getByAliases(payload, ["Vertical"]),
    compania: getByAliases(payload, ["Compañia", "Compania"]),
    direccion: getByAliases(payload, ["Dirección", "Direccion"]),
    estrategia: getByAliases(payload, ["Estrategia"]),
    linkedin: getByAliases(payload, ["LinkedIn", "LinkedIn "]),
    web: getByAliases(payload, ["Web", "Web "]),
    portfolio: getByAliases(payload, ["Portfolio"]),
    comentarios: getByAliases(payload, ["Comentarios"]),
    encaje_summax: getByAliases(payload, ["Encaje SUMMAX"]),
    motivo: getByAliases(payload, ["Motivo"]),
    inversion_minima: getByAliases(payload, ["Inversion Minima"]),
    inversion_maxima: getByAliases(payload, ["Inversion Maxima"]),
    prioridad: getByAliases(payload, ["Prioridad"]),
    sede: getByAliases(payload, ["Sede"]),
    tamano_empresa: getByAliases(payload, ["Tamaño Empresa", "Tamano Empresa"]),
    updated_at: new Date().toISOString()
  };

  if (!record.compania) return { inserted: 0, merged: 0, warning: 1, error: 0 };

  const { data: existing } = await db.from("inversion").select("company_id").eq("company_id", companyId).maybeSingle();
  const { error } = await db.from("inversion").upsert(record, { onConflict: "company_id" });
  if (error) return { inserted: 0, merged: 0, warning: 0, error: 1 };
  return existing ? { inserted: 0, merged: 1, warning: 0, error: 0 } : { inserted: 1, merged: 0, warning: 0, error: 0 };
}

async function upsertContactos(payload: RowPayload) {
  const db = createSourceCrmServerClient();
  const companyId = parseIntOrNull(getByAliases(payload, ["Company_ID", "CompanyID"]));
  const contactId = parseIntOrNull(getByAliases(payload, ["Contact_ID", "ContactID"]));
  if (!companyId || !contactId) return { inserted: 0, merged: 0, warning: 1, error: 0 };

  const { data: inversion } = await db.from("inversion").select("company_id").eq("company_id", companyId).maybeSingle();
  if (!inversion) return { inserted: 0, merged: 0, warning: 1, error: 0 };

  const record = {
    contact_id: contactId,
    company_id: companyId,
    compania: getByAliases(payload, ["Compañia", "Compania"]),
    persona_contacto: getByAliases(payload, ["Persona de contacto"]),
    rol: getByAliases(payload, ["Rol"]),
    otro_contacto: getByAliases(payload, ["Otro contacto"]),
    telefono: getByAliases(payload, ["Teléfono", "Telefono"]),
    email: getByAliases(payload, ["email", "Email"]),
    linkedin: getByAliases(payload, ["LinkedIn", "Linkedin"]),
    comentarios: getByAliases(payload, ["Comentarios"]),
    prioritario: getByAliases(payload, ["Prioritario?"]),
    updated_at: new Date().toISOString()
  };

  const { data: existing } = await db.from("contactos").select("contact_id").eq("contact_id", contactId).maybeSingle();
  const { error } = await db.from("contactos").upsert(record, { onConflict: "contact_id" });
  if (error) return { inserted: 0, merged: 0, warning: 0, error: 1 };
  return existing ? { inserted: 0, merged: 1, warning: 0, error: 0 } : { inserted: 1, merged: 0, warning: 0, error: 0 };
}

async function upsertTipoFondo(payload: RowPayload) {
  const db = createSourceCrmServerClient();
  const companyId = parseIntOrNull(getByAliases(payload, ["Company_ID", "CompanyID"]));
  const tipo = getByAliases(payload, ["Tipo_Fondo", "Tipo Fondo"]);
  if (!companyId || !tipo) return { inserted: 0, merged: 0, warning: 1, error: 0 };

  const { data: inversion } = await db.from("inversion").select("company_id").eq("company_id", companyId).maybeSingle();
  if (!inversion) return { inserted: 0, merged: 0, warning: 1, error: 0 };

  const record = {
    company_id: companyId,
    tipo_fondo: tipo,
    excepciones: getByAliases(payload, ["Excepciones"])
  };

  const { data: existing } = await db
    .from("tipo_fondo")
    .select("company_id")
    .eq("company_id", companyId)
    .eq("tipo_fondo", tipo)
    .maybeSingle();
  const { error } = await db.from("tipo_fondo").upsert(record, { onConflict: "company_id,tipo_fondo" });
  if (error) return { inserted: 0, merged: 0, warning: 0, error: 1 };
  return existing ? { inserted: 0, merged: 1, warning: 0, error: 0 } : { inserted: 1, merged: 0, warning: 0, error: 0 };
}

async function upsertSector(payload: RowPayload) {
  const db = createSourceCrmServerClient();
  const companyId = parseIntOrNull(getByAliases(payload, ["Company_ID", "CompanyID"]));
  const sector = getByAliases(payload, ["Sector"]);
  if (!companyId || !sector) return { inserted: 0, merged: 0, warning: 1, error: 0 };

  const { data: inversion } = await db.from("inversion").select("company_id").eq("company_id", companyId).maybeSingle();
  if (!inversion) return { inserted: 0, merged: 0, warning: 1, error: 0 };

  const record = {
    company_id: companyId,
    sector,
    sector_consolidado: getByAliases(payload, ["Sector_Consolidado"])
  };
  const { data: existing } = await db
    .from("sector")
    .select("company_id")
    .eq("company_id", companyId)
    .eq("sector", sector)
    .maybeSingle();
  const { error } = await db.from("sector").upsert(record, { onConflict: "company_id,sector" });
  if (error) return { inserted: 0, merged: 0, warning: 0, error: 1 };
  return existing ? { inserted: 0, merged: 1, warning: 0, error: 0 } : { inserted: 1, merged: 0, warning: 0, error: 0 };
}

async function upsertMapaArea(payload: RowPayload) {
  const db = createSourceCrmServerClient();
  const companyId = parseIntOrNull(getByAliases(payload, ["Company_ID", "CompanyID"]));
  const area = getByAliases(payload, ["Mercados_Area_Geografica", "Area_Geografica"]);
  if (!companyId || !area) return { inserted: 0, merged: 0, warning: 1, error: 0 };

  const { data: inversion } = await db.from("inversion").select("company_id").eq("company_id", companyId).maybeSingle();
  if (!inversion) return { inserted: 0, merged: 0, warning: 1, error: 0 };

  const record = { company_id: companyId, area_geografica: area };
  const { data: existing } = await db
    .from("mapa_area_geografica")
    .select("company_id")
    .eq("company_id", companyId)
    .eq("area_geografica", area)
    .maybeSingle();
  const { error } = await db.from("mapa_area_geografica").upsert(record, { onConflict: "company_id,area_geografica" });
  if (error) return { inserted: 0, merged: 0, warning: 0, error: 1 };
  return existing ? { inserted: 0, merged: 1, warning: 0, error: 0 } : { inserted: 1, merged: 0, warning: 0, error: 0 };
}

async function upsertBySheet(sheetName: string, payload: RowPayload) {
  switch (sheetName) {
    case "Inversion":
      return upsertInversion(payload, sheetName);
    case "Contactos":
      return upsertContactos(payload);
    case "Tipo_Fondo":
      return upsertTipoFondo(payload);
    case "Sector":
      return upsertSector(payload);
    case "Mercados_Area_Geografica":
      return upsertMapaArea(payload);
    default:
      return { inserted: 0, merged: 0, warning: 1, error: 0 };
  }
}

export async function POST(request: Request) {
  const appUser = await getCurrentUser();
  if (!appUser || !canManageUsers(appUser)) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const supabase = createSupabaseServerClient();

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  const sourceType = file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";
  if (sourceType !== "xlsx") {
    return NextResponse.json({ error: "xlsx_required_for_sourcecrm_import" }, { status: 400 });
  }

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      source_type: sourceType,
      filename: file.name,
      status: "processing",
      created_by_user_id: appUser.id
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: "cannot_create_batch" }, { status: 500 });
  }

  let inserted = 0;
  let merged = 0;
  let warning = 0;
  let error = 0;
  let rowsProcessed = 0;
  const allowedSheets = new Set(["Inversion", "Contactos", "Tipo_Fondo", "Sector", "Mercados_Area_Geografica"]);

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    for (const sheetName of workbook.SheetNames) {
      if (!allowedSheets.has(sheetName)) continue;
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
      if (!rows.length) continue;

      const { index, headers } = detectHeader(rows);
      for (let i = index + 1; i < rows.length; i += 1) {
        const payload = toRecord(headers, rows[i] ?? []);
        const result = await upsertBySheet(sheetName, payload);

        inserted += result.inserted;
        merged += result.merged;
        warning += result.warning;
        error += result.error;
        rowsProcessed += 1;

        await supabase.from("import_rows_raw").insert({
          batch_id: batch.id,
          sheet_name: sheetName,
          row_number: i + 1,
          raw_payload_json: payload,
          normalized_payload_json: payload,
          dedupe_key: `${sheetName}-${i + 1}`,
          resolution: result.error ? "error" : result.merged ? "merged" : result.inserted ? "inserted" : "warning",
          error_json: result.error ? { code: "upsert_failed" } : null
        });
      }
    }

    await supabase
      .from("import_batches")
      .update({
        status: "completed",
        inserted_count: inserted,
        merged_count: merged,
        warning_count: warning,
        error_count: error,
        summary_json: { rowsProcessed, targetSchema: "sourcecrm" },
        updated_at: new Date().toISOString()
      })
      .eq("id", batch.id);

    return NextResponse.redirect(new URL("/imports", request.url));
  } catch (e) {
    await supabase
      .from("import_batches")
      .update({
        status: "failed",
        error_count: error + 1,
        summary_json: {
          rowsProcessed,
          reason: e instanceof Error ? e.message : "unknown",
          targetSchema: "sourcecrm"
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", batch.id);

    return NextResponse.redirect(new URL("/imports", request.url));
  }
}
