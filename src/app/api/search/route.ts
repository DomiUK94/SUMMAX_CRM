import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canWriteCrm } from "@/lib/auth/authorize";
import { createDimServerClient } from "@/lib/supabase/dim";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ q, contacts: [], investors: [], products: [], business: [], tasks: [], files: [] });

  const pattern = `%${q}%`;
  const db = createSourceCrmServerClient();
  const dim = createDimServerClient();

  const [contactsRes, investorsRes, productsRes, leadsRes, opportunitiesRes, tasksRes, entityFilesRes, draftFilesRes] = await Promise.all([
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
    dim
      .from("product")
      .select("id, code, name, product_family, active, updated_at")
      .or(`code.ilike.${pattern},name.ilike.${pattern},product_family.ilike.${pattern}`)
      .order("name", { ascending: true })
      .limit(8),
    db
      .from("leads")
      .select("id, name, owner_email, resolution, updated_at")
      .or(`name.ilike.${pattern},owner_email.ilike.${pattern},notes.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(8),
    db
      .from("opportunities")
      .select("id, name, owner_email, resolution, updated_at")
      .or(`name.ilike.${pattern},owner_email.ilike.${pattern},notes.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(8),
    dim
      .from("task")
      .select("id, name, entity_type, task_kind, updated_at")
      .or(`name.ilike.${pattern},code.ilike.${pattern},task_kind.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(8),
    db
      .from("entity_files")
      .select("id, entity_type, entity_id, file_name, uploaded_by_email, created_at")
      .or(`file_name.ilike.${pattern},uploaded_by_email.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(8),
    db
      .from("draft_files")
      .select("id, file_name, uploaded_by_email, created_at, language")
      .or(`file_name.ilike.${pattern},uploaded_by_email.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(8)
  ]);

  return NextResponse.json({
    q,
    contacts: contactsRes.data ?? [],
    investors: investorsRes.data ?? [],
    products: productsRes.data ?? [],
    business: [
      ...((leadsRes.data ?? []).map((lead) => ({ ...lead, business_type: "lead" }))),
      ...((opportunitiesRes.data ?? []).map((opportunity) => ({ ...opportunity, business_type: "opportunity" })))
    ],
    tasks: tasksRes.data ?? [],
    files: [
      ...(entityFilesRes.data ?? []).map((file) => ({
        ...file,
        file_kind: "entity"
      })),
      ...(draftFilesRes.data ?? []).map((file) => ({
        ...file,
        file_kind: "draft"
      }))
    ]
  });
}

