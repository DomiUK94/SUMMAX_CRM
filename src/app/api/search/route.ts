import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canWriteCrm } from "@/lib/auth/authorize";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ q, contacts: [], investors: [], deals: [], activities: [] });

  const pattern = `%${q}%`;
  const db = createSourceCrmServerClient();

  const [contactsRes, investorsRes, dealsRes, activitiesRes] = await Promise.all([
    db
      .from("contactos")
      .select("contact_id, persona_contacto, compania, email, telefono, owner_email")
      .or(`persona_contacto.ilike.${pattern},compania.ilike.${pattern},email.ilike.${pattern},telefono.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(8),
    db
      .from("inversion")
      .select("company_id, compania, vertical, web")
      .or(`compania.ilike.${pattern},vertical.ilike.${pattern},web.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(8),
    db
      .from("inversion")
      .select("company_id, compania, prioridad, inversion_maxima")
      .or(`compania.ilike.${pattern},prioridad.ilike.${pattern},inversion_maxima.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(8),
    db
      .from("activities")
      .select("id, title, entity_type, occurred_at")
      .or(`title.ilike.${pattern},body.ilike.${pattern},activity_type.ilike.${pattern}`)
      .order("occurred_at", { ascending: false })
      .limit(8)
  ]);

  return NextResponse.json({
    q,
    contacts: contactsRes.data ?? [],
    investors: investorsRes.data ?? [],
    deals: dealsRes.data ?? [],
    activities: activitiesRes.data ?? []
  });
}

