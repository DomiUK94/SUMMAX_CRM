import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractDomain, normalizeText, parseCsv } from "@/lib/utils/normalize";

type RowPayload = Record<string, string>;

const ALIASES: Record<string, string[]> = {
  investor_name: ["potencial inversor", "nombre fondo", "fondo", "fund", "nombre"],
  contact_name: ["persona de contacto", "contact", "contacto", "full_name"],
  email: ["correo", "email", "e-mail", "contactos- email", "email / contact"],
  phone: ["telefono", "tel", "telephone"],
  website: ["pagina web", "web", "website"],
  strategy: ["estrategia"],
  sector: ["sector"],
  status: ["status", "estado"],
  notes: ["comments", "notas", "motivo", "why they fit"]
};

function toRecord(headers: string[], row: string[]): RowPayload {
  const payload: RowPayload = {};
  headers.forEach((h, i) => {
    const key = h.trim();
    payload[key] = row[i] ?? "";
  });
  return payload;
}

function canonicalFromPayload(payload: RowPayload): RowPayload {
  const normalized = Object.fromEntries(Object.entries(payload).map(([k, v]) => [normalizeText(k), String(v ?? "").trim()]));
  const out: RowPayload = {};

  for (const [target, keys] of Object.entries(ALIASES)) {
    for (const key of keys) {
      const val = normalized[normalizeText(key)];
      if (val) {
        out[target] = val;
        break;
      }
    }
  }

  return out;
}

function detectHeader(rows: string[][]): { index: number; headers: string[] } {
  const maxProbe = Math.min(rows.length, 10);
  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < maxProbe; i += 1) {
    const row = rows[i].map((c) => normalizeText(c));
    const score = Object.values(ALIASES).flat().reduce((acc, alias) => (row.includes(normalizeText(alias)) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return { index: bestIdx, headers: rows[bestIdx] ?? [] };
}

async function upsertInvestorAndContact(params: {
  canonical: RowPayload;
  sheetName: string;
  createdByUserId: string;
  createdByEmail: string;
}) {
  const supabase = createSupabaseServerClient();
  const investorName = params.canonical.investor_name?.trim();
  if (!investorName) {
    return { inserted: 0, merged: 0, warning: 1, error: 0, investorId: null as string | null };
  }

  const normalizedName = normalizeText(investorName);
  const website = params.canonical.website ?? "";
  const websiteDomain = extractDomain(website);

  const existingQuery = supabase.from("investors").select("id").eq("normalized_name", normalizedName);
  const { data: existing } = websiteDomain
    ? await existingQuery.eq("website_domain", websiteDomain).maybeSingle()
    : await existingQuery.is("website_domain", null).maybeSingle();

  let investorId: string;
  let inserted = 0;
  let merged = 0;

  if (existing?.id) {
    investorId = existing.id;
    merged += 1;
    await supabase
      .from("investors")
      .update({
        strategy: params.canonical.strategy || undefined,
        sector: params.canonical.sector || undefined,
        website: website || undefined,
        status_name: params.canonical.status || undefined,
        notes: params.canonical.notes || undefined,
        updated_at: new Date().toISOString()
      })
      .eq("id", investorId);
  } else {
    const { data: created, error } = await supabase
      .from("investors")
      .insert({
        name: investorName,
        normalized_name: normalizedName,
        category: params.sheetName,
        website: website || null,
        website_domain: websiteDomain || null,
        strategy: params.canonical.strategy ?? null,
        sector: params.canonical.sector ?? null,
        status_name: params.canonical.status ?? "Nuevo",
        notes: params.canonical.notes ?? null
      })
      .select("id")
      .single();

    if (error || !created) {
      return { inserted: 0, merged: 0, warning: 0, error: 1, investorId: null as string | null };
    }

    investorId = created.id;
    inserted += 1;
  }

  const contactName = params.canonical.contact_name?.trim();
  if (contactName) {
    const email = params.canonical.email?.trim() ?? "";
    const existingContact = email
      ? await supabase.from("contacts").select("id").eq("email", email).maybeSingle()
      : await supabase
          .from("contacts")
          .select("id")
          .eq("normalized_full_name", normalizeText(contactName))
          .eq("investor_id", investorId)
          .maybeSingle();

    if (existingContact.data?.id) {
      merged += 1;
    } else {
      await supabase.from("contacts").insert({
        investor_id: investorId,
        investor_name: investorName,
        full_name: contactName,
        normalized_full_name: normalizeText(contactName),
        email: email || null,
        phone: params.canonical.phone ?? null,
        owner_user_id: params.createdByUserId,
        owner_email: params.createdByEmail,
        status_name: params.canonical.status ?? "Nuevo",
        next_step: null,
        due_date: null,
        priority_level: 1
      });
      inserted += 1;
    }
  }

  return { inserted, merged, warning: 0, error: 0, investorId };
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  const sourceType = file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      source_type: sourceType,
      filename: file.name,
      status: "processing",
      created_by_user_id: user.id
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

  try {
    if (sourceType === "csv") {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length > 0) {
        const headers = rows[0];
        for (let i = 1; i < rows.length; i += 1) {
          const payload = toRecord(headers, rows[i]);
          const canonical = canonicalFromPayload(payload);
          const result = await upsertInvestorAndContact({
            canonical,
            sheetName: "CSV",
            createdByUserId: user.id,
            createdByEmail: user.email ?? ""
          });

          inserted += result.inserted;
          merged += result.merged;
          warning += result.warning;
          error += result.error;
          rowsProcessed += 1;

          await supabase.from("import_rows_raw").insert({
            batch_id: batch.id,
            sheet_name: "CSV",
            row_number: i + 1,
            raw_payload_json: payload,
            normalized_payload_json: canonical,
            dedupe_key: normalizeText(canonical.investor_name ?? ""),
            resolution: result.error ? "error" : result.merged ? "merged" : "inserted",
            error_json: result.error ? { code: "upsert_failed" } : null
          });
        }
      }
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
        if (!rows.length) continue;

        const { index, headers } = detectHeader(rows);
        for (let i = index + 1; i < rows.length; i += 1) {
          const payload = toRecord(headers, rows[i] ?? []);
          const canonical = canonicalFromPayload(payload);
          const result = await upsertInvestorAndContact({
            canonical,
            sheetName,
            createdByUserId: user.id,
            createdByEmail: user.email ?? ""
          });

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
            normalized_payload_json: canonical,
            dedupe_key: normalizeText(canonical.investor_name ?? ""),
            resolution: result.error ? "error" : result.merged ? "merged" : "inserted",
            error_json: result.error ? { code: "upsert_failed" } : null
          });
        }
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
        summary_json: { rowsProcessed },
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
          reason: e instanceof Error ? e.message : "unknown"
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", batch.id);

    return NextResponse.redirect(new URL("/imports", request.url));
  }
}
