import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageCrmAdmin } from "@/lib/auth/authorize";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { writeAuditEntry } from "@/lib/db/audit";

type MergePayload = {
  keep_id?: string;
  remove_id?: string;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageCrmAdmin(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const payload = (await request.json().catch(() => null)) as MergePayload | null;
  const keepId = Number(payload?.keep_id ?? 0);
  const removeId = Number(payload?.remove_id ?? 0);
  if (!Number.isFinite(keepId) || !Number.isFinite(removeId) || keepId <= 0 || removeId <= 0 || keepId === removeId) {
    return NextResponse.json({ error: "IDs invalidos" }, { status: 400 });
  }

  const db = createSourceCrmServerClient();
  const { data: records, error: fetchError } = await db
    .from("contactos")
    .select("*")
    .in("contact_id", [keepId, removeId]);
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!records || records.length !== 2) return NextResponse.json({ error: "No se encontraron ambos contactos" }, { status: 404 });

  const keep = records.find((r) => r.contact_id === keepId);
  const remove = records.find((r) => r.contact_id === removeId);
  if (!keep || !remove) return NextResponse.json({ error: "Datos de merge invalidos" }, { status: 400 });

  const merged = {
    persona_contacto: keep.persona_contacto ?? remove.persona_contacto ?? null,
    compania: keep.compania ?? remove.compania ?? null,
    company_id: keep.company_id ?? remove.company_id ?? null,
    email: keep.email ?? remove.email ?? null,
    telefono: keep.telefono ?? remove.telefono ?? null,
    rol: keep.rol ?? remove.rol ?? null,
    otro_contacto: keep.otro_contacto ?? remove.otro_contacto ?? null,
    linkedin: keep.linkedin ?? remove.linkedin ?? null,
    prioritario: keep.prioritario ?? remove.prioritario ?? null,
    owner_user_id: keep.owner_user_id ?? remove.owner_user_id ?? null,
    owner_email: keep.owner_email ?? remove.owner_email ?? null,
    comentarios: [keep.comentarios, remove.comentarios].filter(Boolean).join(" | "),
    updated_at: new Date().toISOString()
  };

  const { error: updateError } = await db.from("contactos").update(merged).eq("contact_id", keepId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { error: deleteError } = await db.from("contactos").delete().eq("contact_id", removeId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  await writeAuditEntry({
    entityType: "contact",
    entityId: String(keepId),
    action: "merge",
    changedByUserId: user.id,
    changedByEmail: user.email,
    metadata: { removedId: removeId }
  });

  return NextResponse.json({ ok: true, keep_id: keepId, remove_id: removeId });
}

