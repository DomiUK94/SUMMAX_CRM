import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/auth/permissions";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

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

export async function GET(request: Request) {
  const appUser = await getCurrentUser();
  const sourceCrm = createSourceCrmServerClient();
  if (!canManageUsers(appUser)) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "detail" ? "detail" : "general";

  if (mode === "detail") {
    const { data } = await sourceCrm
      .from("contactos")
      .select("contact_id, company_id, compania, persona_contacto, rol, email, telefono, linkedin, comentarios, prioritario, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20000);

    const csv = toCsv(data ?? []);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="summax-detail-${new Date().toISOString().slice(0, 10)}.csv"`
      }
    });
  }

  const { data } = await sourceCrm
    .from("inversion")
    .select("company_id, vertical, compania, direccion, estrategia, linkedin, web, portfolio, comentarios, encaje_summax, motivo, inversion_minima, inversion_maxima, prioridad, sede, tamano_empresa, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20000);

  const csv = toCsv(data ?? []);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="summax-general-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
