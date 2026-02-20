import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageCrmAdmin } from "@/lib/auth/authorize";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type ContactLite = {
  contact_id: number;
  persona_contacto: string | null;
  compania: string | null;
  email: string | null;
  telefono: string | null;
  updated_at: string | null;
};

function normalizeText(value: string | null): string {
  return String(value ?? "").trim().toLowerCase();
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManageCrmAdmin(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const db = createSourceCrmServerClient();
  const { data, error } = await db
    .from("contactos")
    .select("contact_id, persona_contacto, compania, email, telefono, updated_at")
    .order("updated_at", { ascending: false })
    .limit(3000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as ContactLite[];
  const groups = new Map<string, ContactLite[]>();

  rows.forEach((row) => {
    const email = normalizeText(row.email);
    const phone = normalizeText(row.telefono);
    const nameCompany = `${normalizeText(row.persona_contacto)}|${normalizeText(row.compania)}`;
    const keys = [email ? `email:${email}` : "", phone ? `phone:${phone}` : "", nameCompany !== "|" ? `name_company:${nameCompany}` : ""].filter(
      Boolean
    );

    keys.forEach((key) => {
      const arr = groups.get(key) ?? [];
      arr.push(row);
      groups.set(key, arr);
    });
  });

  const duplicates = Array.from(groups.entries())
    .filter(([, list]) => list.length > 1)
    .map(([rule, list]) => ({
      rule,
      records: list.sort((a, b) => (a.updated_at && b.updated_at ? +new Date(b.updated_at) - +new Date(a.updated_at) : 0))
    }))
    .slice(0, 120);

  return NextResponse.json({ groups: duplicates });
}

